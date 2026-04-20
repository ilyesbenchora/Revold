export const dynamic = "force-dynamic";

import { ParametresTabs } from "@/components/parametres-tabs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CONNECTABLE_TOOLS } from "@/lib/integrations/connect-catalog";
import { PROVIDER_IDENTIFIERS, CANONICAL_IDENTIFIERS } from "@/lib/integrations/identifier-catalog";
import { ResolutionRules, type Rule } from "@/components/resolution-rules";
import { IdentifierMappingForm } from "@/components/identifier-mapping-form";
import { FieldAuthorityEditor } from "@/components/field-authority-editor";
import { DedupRules, type DedupRule } from "@/components/dedup-rules";
import { SyncFrequencyForm } from "@/components/sync-frequency-form";
import Link from "next/link";

// ── Default field authority ──
const DEFAULT_FIELD_AUTHORITY = [
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

// ── Default resolution rules ──
const DEFAULT_RESOLUTION_RULES: Rule[] = [
  {
    id: "siren_match", rule: "Match par SIREN", entity: "Company", confidence: 99, enabled: false,
    description: "Le SIREN (9 chiffres INSEE) identifie une personne morale française de manière unique et permanente.",
    warning: "Un même groupe peut avoir plusieurs SIRENs (1 par entité juridique : holding, filiale, SCI…).",
    configFields: [
      { label: "Source SIREN prioritaire", type: "select", options: ["Pennylane (natif)", "Sellsy (natif)", "Axonaut (natif)", "Stripe (customer.metadata.siren)", "HubSpot (champ custom)", "Import CSV"], value: "Pennylane (natif)" },
      { label: "Gestion multi-entités", type: "select", options: ["1 SIREN = 1 company (strict)", "Grouper par racine SIREN (même groupe)", "Demander confirmation"], value: "1 SIREN = 1 company (strict)" },
    ],
  },
  {
    id: "vat_match", rule: "Match par n° TVA intracommunautaire", entity: "Company", confidence: 97, enabled: false,
    description: "Le n° TVA (FR + 11 chiffres) est attribué par l'administration fiscale. Fiable sauf micro-entreprises et restructurations.",
    warning: "Les micro-entreprises et associations n'ont pas de TVA. Formats incohérents entre outils.",
    configFields: [
      { label: "Validation du format", type: "select", options: ["Stricte (regex FR/DE/BE/ES/IT/NL)", "Souple (juste présence)"], value: "Stricte (regex FR/DE/BE/ES/IT/NL)" },
      { label: "Normalisation", type: "select", options: ["Retirer espaces + tirets", "Format exact"], value: "Retirer espaces + tirets" },
    ],
  },
  {
    id: "siret_match", rule: "Match par SIRET", entity: "Company", confidence: 90, enabled: false,
    description: "SIRET (14 chiffres = SIREN + NIC). Moins stable que le SIREN. Utilisé en complément.",
    warning: "Préférer le SIREN. Le SIRET sert de fallback (9 premiers chiffres = SIREN).",
    configFields: [
      { label: "Fallback si SIREN absent", type: "select", options: ["Extraire le SIREN du SIRET (9 premiers chiffres)", "Ignorer"], value: "Extraire le SIREN du SIRET (9 premiers chiffres)" },
    ],
  },
  {
    id: "exact_email", rule: "Match par email exact", entity: "Contact", confidence: 85, enabled: false,
    description: "Match sur email lowercase normalisé. Fiable entre CRM et support. Entre CRM et billing, l'email facturé ≠ email commercial.",
    warning: "facturation@acme.com (Stripe) ≠ jean@acme.com (HubSpot).",
    configFields: [
      { label: "Emails génériques", type: "select", options: ["Bloquer (info@, contact@, support@, facturation@, admin@)", "Avertir seulement", "Autoriser"], value: "Bloquer (info@, contact@, support@, facturation@, admin@)" },
      { label: "Match CRM ↔ Billing", type: "select", options: ["Email + SIREN obligatoire", "Email + domaine obligatoire", "Désactivé entre CRM et billing"], value: "Email + SIREN obligatoire" },
      { label: "Match CRM ↔ Support", type: "select", options: ["Email exact (recommandé)", "Email + domaine", "Désactivé"], value: "Email exact (recommandé)" },
    ],
  },
  {
    id: "external_id_match", rule: "Match par ID client externe", entity: "Contact + Company", confidence: 100, enabled: true,
    description: "Chaque outil attribue un ID unique. Revold crée ces liens automatiquement dans source_links. Toujours actif.",
    warning: null,
    configFields: [
      { label: "Remplissage automatique", type: "select", options: ["Oui — Revold écrit l'ID dans le CRM après le 1er match", "Non — uniquement lecture"], value: "Oui — Revold écrit l'ID dans le CRM après le 1er match" },
    ],
  },
  {
    id: "domain_match", rule: "Match par domaine web", entity: "Company", confidence: 75, enabled: false,
    description: "Companies avec le même domaine web normalisé. Fiable à 75% — holding et filiale peuvent avoir des domaines différents.",
    warning: "Un rebranding change le domaine dans le CRM mais pas dans le billing. Combiner avec SIREN.",
    configFields: [
      { label: "Exclure domaines personnels", type: "select", options: ["Oui (gmail, hotmail, yahoo, outlook, orange, free…)", "Non"], value: "Oui (gmail, hotmail, yahoo, outlook, orange, free…)" },
      { label: "Exiger un second identifiant", type: "select", options: ["Oui (domaine + SIREN ou TVA)", "Non (domaine seul)"], value: "Oui (domaine + SIREN ou TVA)" },
    ],
  },
];

// ── Default dedup rules ──
const DEFAULT_DEDUP_RULES: DedupRule[] = [
  { id: "contact_email", entity: "Contact", criteria: "email corporate (hors génériques)", secondaryCriteria: "domaine + nom (entre CRM et billing)", action: "Merge auto", warning: "Ne PAS matcher l'email billing avec l'email du signataire", enabled: false },
  { id: "company_siren", entity: "Company", criteria: "SIREN exact (France)", secondaryCriteria: "VAT + domaine + nom normalisé", action: "Merge auto", warning: "Un groupe avec 3 filiales = 3 SIRENs", enabled: false },
  { id: "company_intl_vat", entity: "Company (int.)", criteria: "VAT number (hors France)", secondaryCriteria: "domaine + nom + pays", action: "Merge auto", warning: "Le VAT change en cas de restructuration dans certains pays UE", enabled: false },
  { id: "deal_external_id", entity: "Deal", criteria: "external_id par source", secondaryCriteria: "company_id + amount + mois de close", action: "Upsert via source_links", warning: null, enabled: false },
  { id: "invoice_source_id", entity: "Invoice", criteria: "source_id (stripe_id / pennylane_id)", secondaryCriteria: "number + montant + date", action: "Upsert via source_links", warning: "Un avoir peut avoir le même montant qu'une facture", enabled: false },
  { id: "ticket_source_id", entity: "Ticket", criteria: "source_id (zendesk_id / intercom_id)", secondaryCriteria: "external_number + opened_at", action: "Upsert via source_links", warning: null, enabled: false },
];

export default async function ParametresModeleDonneesPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;

  const supabase = await createSupabaseServerClient();
  const snapshot = await getHubspotSnapshot();

  // Counts contacts/companies = HubSpot live (source de vérité)
  const contactsCount = snapshot.totalContacts;
  const companiesCount = snapshot.totalCompanies;

  // Configuration & resolution rules restent en Supabase (état app)
  let sourceLinksCount = 0;
  let connectedProviders: string[] = [];
  let savedRuleConfigs: Array<{ rule_id: string; enabled: boolean; config: Record<string, string> }> = [];
  let savedMappings: Array<{ provider: string; canonical_field: string; provider_field: string }> = [];
  let savedAuthority: Array<{ entity: string; field: string; priority: string[] }> = [];
  let savedFrequencies: Record<string, string> = {};
  let matchStats: Record<string, number> = {};

  try {
    const [sl, integ, ruleConfigs, mappings, authority, freqs, matchData] = await Promise.all([
      supabase.from("source_links").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("integrations").select("provider").eq("organization_id", orgId).eq("is_active", true),
      supabase.from("entity_resolution_config").select("rule_id, enabled, config").eq("organization_id", orgId),
      supabase.from("identifier_field_mapping").select("provider, canonical_field, provider_field").eq("organization_id", orgId),
      supabase.from("field_authority_config").select("entity, field, priority").eq("organization_id", orgId),
      supabase.from("sync_config").select("category, frequency").eq("organization_id", orgId),
      supabase.from("source_links").select("match_method").eq("organization_id", orgId),
    ]);

    sourceLinksCount = sl.count ?? 0;
    connectedProviders = (integ.data ?? []).map((i) => i.provider);
    savedRuleConfigs = (ruleConfigs.data ?? []) as typeof savedRuleConfigs;
    savedMappings = (mappings.data ?? []) as typeof savedMappings;
    savedAuthority = (authority.data ?? []) as typeof savedAuthority;
    for (const f of (freqs.data ?? []) as Array<{ category: string; frequency: string }>) {
      savedFrequencies[f.category] = f.frequency;
    }
    for (const row of (matchData.data ?? []) as Array<{ match_method: string }>) {
      matchStats[row.match_method] = (matchStats[row.match_method] ?? 0) + 1;
    }
  } catch {}

  // ── Merge saved state into defaults ──
  const hsToken = await getHubSpotToken(supabase, orgId);
  const hasHubSpot = connectedProviders.includes("hubspot") || !!hsToken;
  const allProviders = hasHubSpot ? ["hubspot", ...connectedProviders.filter((p) => p !== "hubspot")] : connectedProviders;

  // Resolution rules: merge saved enabled/config into defaults
  const mergedRules: Rule[] = DEFAULT_RESOLUTION_RULES.map((rule) => {
    const saved = savedRuleConfigs.find((s) => s.rule_id === rule.id);
    if (!saved) return rule;
    return {
      ...rule,
      enabled: saved.enabled,
      configFields: rule.configFields.map((cf) => ({
        ...cf,
        value: (saved.config as Record<string, string>)[cf.label] ?? cf.value,
      })),
    };
  });

  // Dedup rules: merge saved enabled state
  const mergedDedupRules: DedupRule[] = DEFAULT_DEDUP_RULES.map((rule) => {
    const saved = savedRuleConfigs.find((s) => s.rule_id === `dedup_${rule.id}`);
    if (!saved) return rule;
    return { ...rule, enabled: saved.enabled };
  });

  // Field authority: merge saved priority orders
  const mergedAuthority = DEFAULT_FIELD_AUTHORITY.map((row) => {
    const saved = savedAuthority.find((s) => s.entity === row.entity && s.field === row.field);
    if (!saved) return row;
    return { ...row, priority: saved.priority };
  });

  // Identifier mapping rows (only connected tools)
  const identifierRows = allProviders
    .map((provider) => {
      const tool = CONNECTABLE_TOOLS[provider] ?? (provider === "hubspot" ? { label: "HubSpot", icon: "🟠", domain: "hubspot.com" } : null);
      const ids = PROVIDER_IDENTIFIERS[provider];
      if (!tool || !ids) return null;
      return { provider, label: tool.label, icon: tool.icon, domain: tool.domain, identifiers: ids };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // Match stats for display
  const totalMatched = Object.values(matchStats).reduce((s, v) => s + v, 0);
  const matchBySiren = matchStats["siren"] ?? 0;
  const matchByVat = matchStats["vat_number"] ?? 0;
  const matchByEmail = matchStats["exact_email"] ?? 0;
  const matchByDomain = matchStats["domain"] ?? 0;
  const matchByLink = matchStats["existing_link"] ?? 0;
  const matchCreated = matchStats["created"] ?? 0;

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500">
          Modèle de données canonique et règles de résolution multi-sources.
        </p>
      </header>

      <ParametresTabs />

      {/* Bandeau pilote HubSpot-only : clarifie que les mentions Stripe/Pennylane
          /Sellsy/Axonaut concernent une intégration future, pas l'état actuel. */}
      {connectedProviders.length === 1 && connectedProviders[0] === "hubspot" && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-sm text-blue-900">
          <p className="font-medium">Mode HubSpot uniquement</p>
          <p className="mt-1 text-xs leading-relaxed">
            Cette page affiche les règles de résolution multi-sources pour la couche cross-source
            (Stripe, Pennylane, Sellsy, Zendesk…). Vous n&apos;avez actuellement que HubSpot connecté,
            donc seules les règles HubSpot sont actives. Les autres outils s&apos;activent automatiquement
            dès leur connexion future.
          </p>
        </div>
      )}

      {/* ── KPIs + Matching Stats ── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        <article className="card p-4 text-center">
          <p className="text-[10px] font-medium uppercase text-slate-500">Liens sources</p>
          <p className="mt-1 text-2xl font-bold text-violet-600">{sourceLinksCount}</p>
        </article>
        <article className="card p-4 text-center">
          <p className="text-[10px] font-medium uppercase text-slate-500">Contacts</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">{contactsCount.toLocaleString("fr-FR")}</p>
        </article>
        <article className="card p-4 text-center">
          <p className="text-[10px] font-medium uppercase text-slate-500">Sociétés</p>
          <p className="mt-1 text-2xl font-bold text-indigo-600">{companiesCount.toLocaleString("fr-FR")}</p>
        </article>
        <article className="card p-4 text-center">
          <p className="text-[10px] font-medium uppercase text-slate-500">Outils connectés</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{allProviders.length}</p>
        </article>
        <article className="card p-4 text-center">
          <p className="text-[10px] font-medium uppercase text-slate-500">Rapprochements</p>
          <p className="mt-1 text-2xl font-bold text-fuchsia-600">{totalMatched}</p>
        </article>
        <article className="card p-4 text-center">
          <p className="text-[10px] font-medium uppercase text-slate-500">Règles actives</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {mergedRules.filter((r) => r.enabled).length}/{mergedRules.length}
          </p>
        </article>
      </div>

      {/* ── Matching stats detail ── */}
      {totalMatched > 0 && (
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Répartition des rapprochements</p>
          <div className="flex flex-wrap gap-3">
            {matchBySiren > 0 && <StatBadge label="SIREN" count={matchBySiren} total={totalMatched} color="emerald" />}
            {matchByVat > 0 && <StatBadge label="TVA" count={matchByVat} total={totalMatched} color="blue" />}
            {matchByEmail > 0 && <StatBadge label="Email" count={matchByEmail} total={totalMatched} color="indigo" />}
            {matchByDomain > 0 && <StatBadge label="Domaine" count={matchByDomain} total={totalMatched} color="amber" />}
            {matchByLink > 0 && <StatBadge label="ID existant" count={matchByLink} total={totalMatched} color="violet" />}
            {matchCreated > 0 && <StatBadge label="Nouveaux" count={matchCreated} total={totalMatched} color="slate" />}
          </div>
        </div>
      )}

      {/* ── Mapping identifiants ── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-fuchsia-500" />Mapping des identifiants
        </h2>
        <p className="text-sm text-slate-500">
          Pour chaque outil connecté, indiquez dans quel champ se trouvent les identifiants d&apos;entreprise.
        </p>
        {identifierRows.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-slate-500">Aucun outil connecté.</p>
            <Link href="/dashboard/integration" className="mt-3 inline-flex text-sm font-medium text-accent hover:underline">Connecter un outil →</Link>
          </div>
        ) : (
          <IdentifierMappingForm rows={identifierRows} savedMappings={savedMappings} />
        )}
      </div>

      {/* ── Identifiants canoniques ── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-indigo-500" />Identifiants de rapprochement
        </h2>
        <p className="text-sm text-slate-500">
          Hiérarchie des identifiants fiables (&gt;75% confiance) utilisés pour rapprocher les entreprises.
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
                    }`}>{ci.confidence} %</span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{ci.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Règles de résolution ── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-blue-500" />Règles de résolution d&apos;entités
        </h2>
        <p className="text-sm text-slate-500">
          Activez les règles de rapprochement selon vos outils. La première qui matche gagne.
        </p>
        <ResolutionRules rules={mergedRules} />
      </div>

      {/* ── Matrice d'autorité ── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />Matrice d&apos;autorité des champs
        </h2>
        <p className="text-sm text-slate-500">
          Quand deux outils ont une valeur différente pour le même champ, lequel gagne ?
          Utilisez les flèches ▲▼ pour réordonner.
        </p>
        <FieldAuthorityEditor rows={mergedAuthority} />
      </div>

      {/* ── Déduplication ── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-red-500" />Règles de déduplication
        </h2>
        <p className="text-sm text-slate-500">
          Actions automatiques quand deux enregistrements sont détectés comme doublons.
        </p>
        <DedupRules rules={mergedDedupRules} />
      </div>

      {/* ── Fréquences de sync ── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-slate-400" />Fréquences de synchronisation
        </h2>
        <SyncFrequencyForm saved={savedFrequencies} />
      </div>
    </section>
  );
}

// ── Stat badge helper ──
function StatBadge({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = Math.round(count / total * 100);
  const colors: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    indigo: "bg-indigo-50 text-indigo-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <div className={`rounded-lg px-3 py-2 ${colors[color] ?? colors.slate}`}>
      <p className="text-lg font-bold">{count}</p>
      <p className="text-[10px] font-medium">{label} ({pct} %)</p>
    </div>
  );
}
