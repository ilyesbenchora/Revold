import { ParametresTabs } from "@/components/parametres-tabs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { CONNECTABLE_TOOLS } from "@/lib/integrations/connect-catalog";
import { PROVIDER_IDENTIFIERS, CANONICAL_IDENTIFIERS } from "@/lib/integrations/identifier-catalog";
import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";

const inputClass = "w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const selectClass = inputClass;

// ── Field authority matrix (CRM-first for pipeline, billing-first for $) ──
const FIELD_AUTHORITY = [
  { entity: "Contact", field: "email", priority: ["Stripe", "HubSpot", "Pipedrive", "Zoho", "Salesforce"], rationale: "L'email facturé est vérifié → source de vérité" },
  { entity: "Contact", field: "phone", priority: ["HubSpot", "Pipedrive", "Aircall"], rationale: "Le commercial qualifie le téléphone dans le CRM" },
  { entity: "Contact", field: "title", priority: ["HubSpot", "Pipedrive"], rationale: "Le commercial renseigne le poste" },
  { entity: "Contact", field: "owner", priority: ["HubSpot", "Pipedrive"], rationale: "L'attribution commerciale est gérée dans le CRM principal" },
  { entity: "Company", field: "name", priority: ["HubSpot", "Pipedrive", "Stripe"], rationale: "Le commercial qualifie le nom officiel" },
  { entity: "Company", field: "domain", priority: ["HubSpot", "Pipedrive"], rationale: "Le CRM est la source principale du domaine" },
  { entity: "Company", field: "siren", priority: ["Pennylane", "Sellsy", "Axonaut", "HubSpot"], rationale: "L'outil comptable a le SIREN officiel" },
  { entity: "Company", field: "vat_number", priority: ["Pennylane", "Sellsy", "Stripe", "QuickBooks"], rationale: "L'outil de facturation a le n° TVA vérifié" },
  { entity: "Deal", field: "stage", priority: ["HubSpot", "Pipedrive", "Salesforce"], rationale: "Le pipeline est piloté dans le CRM" },
  { entity: "Deal", field: "amount", priority: ["Stripe", "Pennylane", "HubSpot"], rationale: "Le montant facturé > montant forecast" },
  { entity: "Deal", field: "close_date", priority: ["Stripe", "Pennylane", "HubSpot"], rationale: "La date de paiement est la close_date réelle" },
  { entity: "Invoice", field: "all", priority: ["Stripe", "Pennylane", "Sellsy", "Axonaut", "QuickBooks"], rationale: "Toujours la source originale" },
  { entity: "Subscription", field: "mrr", priority: ["Stripe", "Pennylane"], rationale: "Le MRR n'existe que dans le billing" },
  { entity: "Ticket", field: "all", priority: ["Zendesk", "Intercom", "Freshdesk", "Crisp"], rationale: "Toujours la source ticketing native" },
];

// ── Resolution rules (only Tier 1 + Tier 2 = fiable) ──
const RESOLUTION_RULES = [
  {
    id: "siren_match",
    rule: "Match par SIREN",
    entity: "Company",
    description: "Le SIREN (9 chiffres INSEE) identifie une personne morale française de manière unique et permanente. C'est l'ID le plus fiable dans un contexte multi-outils B2B FR.",
    confidence: 99,
    enabled: false,
    warning: "Un même groupe peut avoir plusieurs SIRENs (1 par entité juridique : holding, filiale, SCI…).",
    configFields: [
      { label: "Source SIREN prioritaire", type: "select", options: ["Pennylane (natif)", "Sellsy (natif)", "Axonaut (natif)", "Stripe (customer.metadata.siren)", "HubSpot (champ custom)", "Import CSV"], value: "Pennylane (natif)" },
      { label: "Gestion multi-entités", type: "select", options: ["1 SIREN = 1 company (strict)", "Grouper par racine SIREN (même groupe)", "Demander confirmation"], value: "1 SIREN = 1 company (strict)" },
    ],
  },
  {
    id: "vat_match",
    rule: "Match par n° TVA intracommunautaire",
    entity: "Company",
    description: "Le n° TVA (FR + 11 chiffres) est attribué par l'administration fiscale. Fiable sauf micro-entreprises (pas de TVA) et restructurations.",
    confidence: 97,
    enabled: false,
    warning: "Les micro-entreprises et associations n'ont pas de TVA. Formats incohérents entre outils (avec/sans espaces).",
    configFields: [
      { label: "Validation du format", type: "select", options: ["Stricte (regex FR/DE/BE/ES/IT/NL)", "Souple (juste présence)"], value: "Stricte (regex FR/DE/BE/ES/IT/NL)" },
      { label: "Normalisation", type: "select", options: ["Retirer espaces + tirets", "Format exact"], value: "Retirer espaces + tirets" },
    ],
  },
  {
    id: "siret_match",
    rule: "Match par SIRET (établissement)",
    entity: "Company",
    description: "SIRET (14 chiffres = SIREN + NIC). Moins stable que le SIREN car change au déménagement. Utilisé en complément.",
    confidence: 90,
    enabled: false,
    warning: "Préférer le SIREN. Le SIRET sert de fallback (on peut en extraire le SIREN = 9 premiers chiffres).",
    configFields: [
      { label: "Fallback si SIREN absent", type: "select", options: ["Extraire le SIREN du SIRET (9 premiers chiffres)", "Ignorer"], value: "Extraire le SIREN du SIRET (9 premiers chiffres)" },
    ],
  },
  {
    id: "exact_email",
    rule: "Match par email exact",
    entity: "Contact",
    description: "Match sur email lowercase normalisé. Fiable entre CRM et support (le contact crée le ticket). Entre CRM et billing, l'email facturé ≠ email commercial — il faut croiser avec SIREN.",
    confidence: 85,
    enabled: false,
    warning: "facturation@acme.com (Stripe) ≠ jean@acme.com (HubSpot). Ne PAS matcher ces deux emails entre CRM et billing.",
    configFields: [
      { label: "Emails génériques", type: "select", options: ["Bloquer (info@, contact@, support@, facturation@, comptabilite@, admin@)", "Avertir seulement", "Autoriser"], value: "Bloquer (info@, contact@, support@, facturation@, comptabilite@, admin@)" },
      { label: "Match CRM ↔ Billing", type: "select", options: [
        "Email + SIREN obligatoire (le plus fiable)",
        "Email + domaine obligatoire",
        "Désactivé entre CRM et billing",
      ], value: "Email + SIREN obligatoire (le plus fiable)" },
      { label: "Match CRM ↔ Support", type: "select", options: [
        "Email exact (recommandé)",
        "Email + domaine",
        "Désactivé",
      ], value: "Email exact (recommandé)" },
    ],
  },
  {
    id: "external_id_match",
    rule: "Match par ID client externe",
    entity: "Contact + Company",
    description: "Chaque outil attribue un ID unique (cus_XXX Stripe, client_id Pennylane…). Si cet ID est stocké dans le CRM, le rapprochement est 100% fiable. Revold crée ces liens automatiquement dans la table source_links.",
    confidence: 100,
    enabled: true,
    warning: "Ce match est automatique via la table source_links de Revold. Aucune configuration manuelle requise sauf si vous voulez écrire l'ID dans le CRM (writeback).",
    configFields: [
      { label: "Remplissage automatique", type: "select", options: [
        "Oui — Revold écrit l'ID dans le CRM après le 1er match (recommandé)",
        "Non — uniquement lecture",
      ], value: "Oui — Revold écrit l'ID dans le CRM après le 1er match (recommandé)" },
    ],
  },
  {
    id: "domain_match",
    rule: "Match par domaine web",
    entity: "Company",
    description: "Companies avec le même domaine web normalisé. Fiable à 75% seulement car holding et filiale peuvent avoir des domaines différents.",
    confidence: 75,
    enabled: false,
    warning: "Un rebranding change le domaine dans le CRM mais pas dans l'outil comptable → le match échoue. Combiner avec SIREN.",
    configFields: [
      { label: "Exclure domaines personnels", type: "select", options: ["Oui (gmail, hotmail, yahoo, outlook, orange, free…)", "Non"], value: "Oui (gmail, hotmail, yahoo, outlook, orange, free…)" },
      { label: "Exiger un second identifiant", type: "select", options: ["Oui (domaine + SIREN ou TVA)", "Non (domaine seul)"], value: "Oui (domaine + SIREN ou TVA)" },
    ],
  },
  {
    id: "manual_reconciliation",
    rule: "Réconciliation manuelle (queue)",
    entity: "Tous",
    description: "Les enregistrements non-matchés sont placés dans une queue pour validation humaine.",
    confidence: null,
    enabled: true,
    warning: null,
    configFields: [
      { label: "Seuil auto-match minimum", type: "input", value: "80%" },
      { label: "Alerter si queue > N items", type: "input", value: "50 items" },
      { label: "Notifier par email", type: "select", options: ["Oui (1x/jour)", "Non"], value: "Oui (1x/jour)" },
    ],
  },
];

// ── Dedup rules ──
const DEDUP_RULES = [
  { entity: "Contact", criteria: "email corporate (hors génériques)", secondaryCriteria: "domaine + nom (entre CRM et billing)", action: "Merge auto", warning: "Ne PAS matcher l'email billing (facturation@) avec l'email du signataire (jean@)", enabled: true },
  { entity: "Company", criteria: "SIREN exact (France)", secondaryCriteria: "VAT + domaine + nom normalisé", action: "Merge auto", warning: "Un groupe avec 3 filiales = 3 SIRENs → vérifier si c'est une filiale ou la même entité", enabled: true },
  { entity: "Company (int.)", criteria: "VAT number (hors France)", secondaryCriteria: "domaine + nom + pays", action: "Merge auto", warning: "Le VAT change en cas de restructuration dans certains pays UE", enabled: true },
  { entity: "Deal", criteria: "external_id par source", secondaryCriteria: "company_id + amount + mois de close", action: "Upsert via source_links", warning: null, enabled: true },
  { entity: "Invoice", criteria: "source_id (stripe_id / pennylane_id)", secondaryCriteria: "number + montant + date", action: "Upsert via source_links", warning: "Un avoir (credit note) peut avoir le même montant qu'une facture → vérifier le type", enabled: true },
  { entity: "Ticket", criteria: "source_id (zendesk_id / intercom_id)", secondaryCriteria: "external_number + opened_at", action: "Upsert via source_links", warning: null, enabled: true },
];

export default async function ParametresModeleDonneesPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;

  const supabase = await createSupabaseServerClient();
  let sourceLinksCount = 0;
  let contactsCount = 0;
  let companiesCount = 0;
  let connectedProviders: string[] = [];

  try {
    const [sl, co, cp, integ] = await Promise.all([
      supabase.from("source_links").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("companies").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("integrations").select("provider").eq("organization_id", orgId).eq("is_active", true),
    ]);
    sourceLinksCount = sl.count ?? 0;
    contactsCount = co.count ?? 0;
    companiesCount = cp.count ?? 0;
    connectedProviders = (integ.data ?? []).map((i) => i.provider);
  } catch {}

  // HubSpot is always "connected" if token exists (via env or integrations table)
  const hasHubSpot = connectedProviders.includes("hubspot") || !!process.env.HUBSPOT_ACCESS_TOKEN;
  const allProviders = hasHubSpot ? ["hubspot", ...connectedProviders.filter(p => p !== "hubspot")] : connectedProviders;

  // Build dynamic identifier mapping for connected tools only
  const identifierRows: Array<{
    provider: string;
    label: string;
    icon: string;
    domain: string;
    identifiers: typeof PROVIDER_IDENTIFIERS[string];
  }> = [];

  for (const provider of allProviders) {
    const tool = CONNECTABLE_TOOLS[provider] ?? (provider === "hubspot" ? { label: "HubSpot", icon: "🟠", domain: "hubspot.com" } : null);
    const ids = PROVIDER_IDENTIFIERS[provider];
    if (tool && ids) {
      identifierRows.push({
        provider,
        label: tool.label,
        icon: tool.icon,
        domain: tool.domain,
        identifiers: ids,
      });
    }
  }

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500">
          Modèle de données canonique et règles de résolution multi-sources.
          Ce paramétrage détermine comment Revold rapproche les entités entre vos outils.
        </p>
      </header>

      <ParametresTabs />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Liens sources</p>
          <p className="mt-1 text-3xl font-bold text-violet-600">{sourceLinksCount}</p>
          <p className="mt-1 text-xs text-slate-400">External ID → Revold</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Contacts canoniques</p>
          <p className="mt-1 text-3xl font-bold text-blue-600">{contactsCount.toLocaleString("fr-FR")}</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Sociétés canoniques</p>
          <p className="mt-1 text-3xl font-bold text-indigo-600">{companiesCount.toLocaleString("fr-FR")}</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Outils connectés</p>
          <p className="mt-1 text-3xl font-bold text-emerald-600">{allProviders.length}</p>
        </article>
      </div>

      {/* ── Mapping des identifiants par outil connecté ── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-fuchsia-500" />Mapping des identifiants
        </h2>
        <p className="text-sm text-slate-500">
          Pour chaque outil connecté, Revold doit savoir dans quel champ trouver les identifiants d&apos;entreprise (SIREN, TVA, ID client).
          Seuls vos outils connectés apparaissent ici.
        </p>

        {identifierRows.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-slate-500">Aucun outil connecté.</p>
            <Link href="/dashboard/integration" className="mt-3 inline-flex text-sm font-medium text-accent hover:underline">
              Connecter un outil →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {identifierRows.map((row) => (
              <div key={row.provider} className="card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <BrandLogo domain={row.domain} alt={row.label} fallback={row.icon} size={28} />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                    <p className="text-[10px] text-slate-400">{row.provider}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {row.identifiers.filter(id => id.canonicalField !== "external_id").map((id) => (
                    <div key={id.canonicalField}>
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
                        {id.label}
                        {id.native && (
                          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">NATIF</span>
                        )}
                        {!id.native && (
                          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">CUSTOM</span>
                        )}
                      </label>
                      <input
                        type="text"
                        defaultValue={id.defaultProviderField}
                        placeholder={id.defaultProviderField}
                        className={`${inputClass} mt-1`}
                        readOnly={id.native}
                      />
                      <p className="mt-0.5 text-[10px] text-slate-400">{id.hint}</p>
                    </div>
                  ))}
                </div>
                {/* External ID — always auto */}
                {row.identifiers.some(id => id.canonicalField === "external_id") && (
                  <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[10px] text-slate-500">
                      <span className="font-semibold">ID externe</span> : géré automatiquement par Revold via la table <code className="rounded bg-white px-1">source_links</code>.
                      Chaque {row.label} customer/company est lié à son entité Revold canonique dès la première sync.
                    </p>
                  </div>
                )}
              </div>
            ))}
            <div className="flex justify-end">
              <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500">
                Enregistrer le mapping
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Identifiants canoniques ── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-indigo-500" />Identifiants de rapprochement
        </h2>
        <p className="text-sm text-slate-500">
          La hiérarchie des identifiants utilisés pour rapprocher les entreprises entre outils.
          Seuls les identifiants fiables (&gt;75% confiance) sont retenus.
        </p>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <th className="px-5 py-2">Priorité</th>
                <th className="px-5 py-2">Identifiant</th>
                <th className="px-5 py-2">Confiance</th>
                <th className="px-5 py-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {CANONICAL_IDENTIFIERS.map((ci, idx) => (
                <tr key={ci.field} className="border-b border-card-border last:border-0">
                  <td className="px-5 py-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">{idx + 1}</span>
                  </td>
                  <td className="px-5 py-3 font-semibold text-slate-900">{ci.label}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      ci.confidence >= 97 ? "bg-emerald-100 text-emerald-700" :
                      ci.confidence >= 90 ? "bg-blue-100 text-blue-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {ci.confidence} %
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{ci.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Règles de résolution d'entités ── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-blue-500" />Règles de résolution d&apos;entités
        </h2>
        <p className="text-sm text-slate-500">
          Comment Revold rapproche une entité entre deux outils.
          Les règles s&apos;exécutent par ordre de priorité décroissante — la première qui matche gagne.
        </p>
        <div className="space-y-3">
          {RESOLUTION_RULES.map((rule, idx) => (
            <details key={rule.id} className="card overflow-hidden group" open={idx < 2}>
              <summary className="flex cursor-pointer items-center justify-between p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{idx + 1}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{rule.rule}</p>
                    <p className="text-xs text-slate-500">{rule.entity}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {rule.confidence !== null && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      rule.confidence >= 95 ? "bg-emerald-100 text-emerald-700" :
                      rule.confidence >= 80 ? "bg-blue-100 text-blue-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {rule.confidence} %
                    </span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    rule.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}>
                    {rule.enabled ? "Actif" : "Inactif"}
                  </span>
                </div>
              </summary>
              <div className="border-t border-card-border bg-slate-50/50 p-5 space-y-4">
                <p className="text-sm text-slate-600">{rule.description}</p>
                {rule.warning && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
                    <p className="text-xs font-medium text-amber-800">⚠ {rule.warning}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {rule.configFields.map((cf) => (
                    <div key={cf.label}>
                      <label className="text-xs font-medium text-slate-500">{cf.label}</label>
                      {cf.type === "select" ? (
                        <select defaultValue={cf.value} className={`${selectClass} mt-1`}>
                          {cf.options!.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input type="text" defaultValue={cf.value} className={`${inputClass} mt-1`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
        <div className="flex justify-end">
          <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500">
            Enregistrer les règles
          </button>
        </div>
      </div>

      {/* ── Matrice d'autorité des champs ── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />Matrice d&apos;autorité des champs
        </h2>
        <p className="text-sm text-slate-500">
          Quand deux outils ont une valeur différente pour le même champ, lequel gagne ?
          L&apos;outil en première position est la source de vérité.
        </p>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <th className="px-5 py-2">Entité</th>
                <th className="px-5 py-2">Champ</th>
                <th className="px-5 py-2">Priorité (1er = source de vérité)</th>
                <th className="px-5 py-2">Justification</th>
              </tr>
            </thead>
            <tbody>
              {FIELD_AUTHORITY.map((row) => (
                <tr key={`${row.entity}-${row.field}`} className="border-b border-card-border last:border-0">
                  <td className="px-5 py-2.5">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{row.entity}</span>
                  </td>
                  <td className="px-5 py-2.5 font-medium text-slate-800">{row.field}</td>
                  <td className="px-5 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {row.priority.map((src, i) => (
                        <span key={src} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          i === 0 ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                        }`}>
                          {i === 0 ? `🏆 ${src}` : src}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-2.5 text-xs text-slate-500">{row.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Règles de déduplication ── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-red-500" />Règles de déduplication
        </h2>
        <p className="text-sm text-slate-500">
          Actions automatiques quand deux enregistrements canoniques sont détectés comme doublons.
        </p>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <th className="px-5 py-2">Entité</th>
                <th className="px-5 py-2">Critère primaire</th>
                <th className="px-5 py-2">Critère secondaire</th>
                <th className="px-5 py-2">Action</th>
                <th className="px-5 py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {DEDUP_RULES.map((rule, i) => (
                <tr key={i} className="border-b border-card-border last:border-0">
                  <td className="px-5 py-2.5 font-medium text-slate-800">{rule.entity}</td>
                  <td className="px-5 py-2.5 text-slate-600">{rule.criteria}</td>
                  <td className="px-5 py-2.5 text-slate-500">{rule.secondaryCriteria}</td>
                  <td className="px-5 py-2.5">
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{rule.action}</span>
                  </td>
                  <td className="px-5 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      rule.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}>
                      {rule.enabled ? "Actif" : "Inactif"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Fréquences de synchronisation ── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-slate-400" />Fréquences de synchronisation
        </h2>
        <div className="card p-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-500">CRM (HubSpot, Pipedrive…)</label>
              <select defaultValue="hourly" className={`${selectClass} mt-1`}>
                <option value="hourly">Toutes les heures</option>
                <option value="4h">Toutes les 4 heures</option>
                <option value="daily">1x par jour</option>
                <option value="manual">Manuel uniquement</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Billing (Stripe, Pennylane…)</label>
              <select defaultValue="webhooks" className={`${selectClass} mt-1`}>
                <option value="webhooks">Webhooks (temps réel)</option>
                <option value="hourly">Toutes les heures</option>
                <option value="daily">1x par jour</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Support (Zendesk, Intercom…)</label>
              <select defaultValue="hourly" className={`${selectClass} mt-1`}>
                <option value="hourly">Toutes les heures</option>
                <option value="4h">Toutes les 4 heures</option>
                <option value="daily">1x par jour</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Calcul KPIs / scores</label>
              <select defaultValue="daily" className={`${selectClass} mt-1`}>
                <option value="daily">1x par jour</option>
                <option value="2xdaily">2x par jour</option>
                <option value="realtime">Temps réel (Enterprise)</option>
              </select>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500">
              Enregistrer les fréquences
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
