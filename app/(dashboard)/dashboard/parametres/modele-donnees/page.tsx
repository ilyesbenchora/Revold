import { ParametresTabs } from "@/components/parametres-tabs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

const inputClass = "w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const selectClass = inputClass;

// ── Field authority matrix ──────────────────────────────────────
const FIELD_AUTHORITY = [
  { entity: "Contact", field: "email", priority: ["Stripe", "HubSpot", "Pipedrive", "Zoho", "Salesforce"], rationale: "L'email facturé est vérifié → source de vérité" },
  { entity: "Contact", field: "phone", priority: ["HubSpot", "Pipedrive", "Aircall", "Kaspr"], rationale: "Le commercial qualifie le téléphone dans le CRM" },
  { entity: "Contact", field: "title", priority: ["LinkedIn Sales Nav", "HubSpot", "Kaspr"], rationale: "LinkedIn est la source la plus à jour pour les titres" },
  { entity: "Contact", field: "owner", priority: ["HubSpot", "Pipedrive"], rationale: "L'attribution commerciale est gérée dans le CRM principal" },
  { entity: "Company", field: "name", priority: ["HubSpot", "Pipedrive", "Stripe"], rationale: "Le commercial qualifie le nom officiel" },
  { entity: "Company", field: "domain", priority: ["Kaspr", "Dropcontact", "HubSpot"], rationale: "Les outils d'enrichissement sont plus fiables" },
  { entity: "Company", field: "siren", priority: ["Pennylane", "Sellsy", "Axonaut", "HubSpot"], rationale: "L'outil comptable a le SIREN officiel" },
  { entity: "Company", field: "vat_number", priority: ["Pennylane", "Sellsy", "Stripe", "QuickBooks"], rationale: "L'outil de facturation a le n° TVA vérifié" },
  { entity: "Company", field: "industry", priority: ["LinkedIn Sales Nav", "Kaspr", "HubSpot"], rationale: "Source d'enrichissement plus fraîche" },
  { entity: "Company", field: "annual_revenue", priority: ["LinkedIn Sales Nav", "ZoomInfo", "HubSpot"], rationale: "Les bases d'enrichissement B2B" },
  { entity: "Deal", field: "stage", priority: ["HubSpot", "Pipedrive", "Salesforce"], rationale: "Le pipeline est piloté dans le CRM" },
  { entity: "Deal", field: "amount", priority: ["Stripe", "Pennylane", "HubSpot"], rationale: "Le montant facturé > montant forecast" },
  { entity: "Deal", field: "close_date", priority: ["Stripe", "Pennylane", "HubSpot"], rationale: "La date de paiement est la close_date réelle" },
  { entity: "Invoice", field: "all", priority: ["Stripe", "Pennylane", "Sellsy", "Axonaut", "QuickBooks"], rationale: "Toujours la source originale" },
  { entity: "Subscription", field: "mrr", priority: ["Stripe", "Pennylane"], rationale: "Le MRR n'existe que dans le billing" },
  { entity: "Ticket", field: "all", priority: ["Zendesk", "Intercom", "Freshdesk", "Crisp"], rationale: "Toujours la source ticketing native" },
];

// ── Entity resolution rules — now configurable ──────────────────
const RESOLUTION_RULES = [
  {
    id: "exact_email",
    rule: "Match par email exact",
    entity: "Contact",
    description: "Deux contacts avec le même email lowercase sont fusionnés automatiquement. C'est la règle la plus fiable.",
    confidence: 100,
    enabled: true,
    configFields: [
      { label: "Normalisation email", type: "select" as const, options: ["Lowercase + trim", "Lowercase + trim + remove dots (Gmail)", "Aucune"], value: "Lowercase + trim" },
      { label: "Ignorer les emails génériques", type: "select" as const, options: ["Oui (info@, contact@, support@)", "Non"], value: "Oui (info@, contact@, support@)" },
    ],
  },
  {
    id: "siren_match",
    rule: "Match par SIREN / SIRET",
    entity: "Company",
    description: "Deux entreprises avec le même SIREN (9 chiffres) ou SIRET (14 chiffres) sont la même entité juridique. Identifiant officiel INSEE, 100% fiable.",
    confidence: 100,
    enabled: true,
    configFields: [
      { label: "Activer le match SIREN", type: "select", options: ["Oui", "Non"], value: "Oui" },
      { label: "Activer le match SIRET", type: "select", options: ["Oui (spécifique à l'établissement)", "Non"], value: "Oui (spécifique à l'établissement)" },
      { label: "Source SIREN prioritaire", type: "select", options: ["Pennylane", "Sellsy", "Axonaut", "HubSpot (champ custom)", "Import CSV"], value: "Pennylane" },
    ],
  },
  {
    id: "vat_match",
    rule: "Match par n° TVA intracommunautaire",
    entity: "Company",
    description: "Le numéro de TVA (ex: FR12345678901) identifie une entreprise dans l'UE. Match fiable cross-border.",
    confidence: 100,
    enabled: true,
    configFields: [
      { label: "Activer le match TVA", type: "select", options: ["Oui", "Non"], value: "Oui" },
      { label: "Validation du format", type: "select", options: ["Stricte (regex par pays)", "Souple (présence du champ)"], value: "Stricte (regex par pays)" },
    ],
  },
  {
    id: "domain_match",
    rule: "Match par domaine web",
    entity: "Company",
    description: "Companies avec le même domaine web (ex: acme.com) sont fusionnées. Exclut les domaines génériques (gmail.com, hotmail.com).",
    confidence: 95,
    enabled: true,
    configFields: [
      { label: "Exclure les domaines perso", type: "select", options: ["Oui (gmail, hotmail, yahoo, outlook…)", "Non"], value: "Oui (gmail, hotmail, yahoo, outlook…)" },
      { label: "Normalisation", type: "select", options: ["Retirer www. et sous-domaines", "Domaine exact"], value: "Retirer www. et sous-domaines" },
    ],
  },
  {
    id: "linkedin_match",
    rule: "Match par URL LinkedIn",
    entity: "Contact + Company",
    description: "L'URL LinkedIn (profil ou page entreprise) est unique par entité. Match cross-source fiable si le champ est rempli.",
    confidence: 98,
    enabled: true,
    configFields: [
      { label: "Contact — linkedin_url", type: "select", options: ["Oui", "Non"], value: "Oui" },
      { label: "Company — linkedin_url", type: "select", options: ["Oui", "Non"], value: "Oui" },
      { label: "Normalisation URL", type: "select", options: ["Extraire le slug (/in/nom ou /company/slug)", "URL complète"], value: "Extraire le slug (/in/nom ou /company/slug)" },
    ],
  },
  {
    id: "phone_match",
    rule: "Match par téléphone (secondaire)",
    entity: "Contact",
    description: "Match sur le numéro de téléphone normalisé (E.164). Moins fiable que l'email car un numéro peut être partagé.",
    confidence: 80,
    enabled: false,
    configFields: [
      { label: "Format cible", type: "select", options: ["+33 (E.164 FR)", "+1 (E.164 US)", "Auto-détection"], value: "+33 (E.164 FR)" },
      { label: "Confiance minimum", type: "input", value: "80%" },
    ],
  },
  {
    id: "fuzzy_name",
    rule: "Match par nom entreprise (fuzzy)",
    entity: "Company",
    description: "Distance de Levenshtein < seuil + même pays. Rapproche 'Acme Inc' et 'Acme Corp'. Risque de faux positifs.",
    confidence: 70,
    enabled: false,
    configFields: [
      { label: "Seuil de distance", type: "input", value: "3 caractères" },
      { label: "Exiger le même pays", type: "select", options: ["Oui", "Non"], value: "Oui" },
      { label: "Ignorer les suffixes juridiques", type: "select", options: ["Oui (SAS, SARL, SA, GmbH, Ltd, Inc)", "Non"], value: "Oui (SAS, SARL, SA, GmbH, Ltd, Inc)" },
    ],
  },
  {
    id: "secondary_email",
    rule: "Match par email secondaire",
    entity: "Contact",
    description: "Si le contact a un secondary_email, tenter le match sur les deux adresses. Utile pour les personnes qui changent de job.",
    confidence: 90,
    enabled: true,
    configFields: [
      { label: "Activer", type: "select", options: ["Oui", "Non"], value: "Oui" },
    ],
  },
  {
    id: "manual_reconciliation",
    rule: "Réconciliation manuelle",
    entity: "Tous",
    description: "Les enregistrements non-matchés automatiquement sont présentés dans une queue de réconciliation. L'utilisateur valide manuellement.",
    confidence: null,
    enabled: true,
    configFields: [
      { label: "Seuil auto-match minimum", type: "input", value: "75%" },
      { label: "Alerter si queue > N items", type: "input", value: "50 items" },
    ],
  },
];

// ── Dedup rules ─────────────────────────────────────────────────
const DEDUP_RULES = [
  { entity: "Contact", criteria: "email lowercase", secondaryCriteria: "secondary_email, linkedin_url", action: "Merge auto", enabled: true },
  { entity: "Company", criteria: "SIREN exact", secondaryCriteria: "domain, vat_number, linkedin_url", action: "Merge auto", enabled: true },
  { entity: "Deal", criteria: "external_id par source", secondaryCriteria: "amount + close_date + company_id", action: "Upsert via source_links", enabled: true },
  { entity: "Invoice", criteria: "source_id (stripe_id, pennylane_id…)", secondaryCriteria: "number + amount + date", action: "Upsert via source_links", enabled: true },
  { entity: "Ticket", criteria: "source_id (zendesk_id, intercom_id…)", secondaryCriteria: "external_number + opened_at", action: "Upsert via source_links", enabled: true },
];

export default async function ParametresModeleDonneesPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;

  const supabase = await createSupabaseServerClient();
  let sourceLinksCount = 0;
  let contactsCount = 0;
  let companiesCount = 0;
  try {
    const [sl, co, cp] = await Promise.all([
      supabase.from("source_links").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("companies").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    ]);
    sourceLinksCount = sl.count ?? 0;
    contactsCount = co.count ?? 0;
    companiesCount = cp.count ?? 0;
  } catch {}

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500">
          Modèle de données canonique, règles de résolution multi-sources et déduplication.
          Ce paramétrage est l&apos;ADN de Revold — il détermine comment les outils communiquent entre eux.
        </p>
      </header>

      <ParametresTabs />

      {/* KPIs du modèle */}
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
          <p className="text-xs text-slate-500">Règles actives</p>
          <p className="mt-1 text-3xl font-bold text-emerald-600">
            {RESOLUTION_RULES.filter((r) => r.enabled).length}/{RESOLUTION_RULES.length}
          </p>
        </article>
      </div>

      {/* ── Identifiants uniques d'entreprise ── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-fuchsia-500" />Identifiants uniques d&apos;entreprise
        </h2>
        <p className="text-sm text-slate-500">
          Ces champs sont les clés de rapprochement les plus fiables entre outils.
          Quand Pennylane et HubSpot ont le même SIREN, c&apos;est la même entreprise — 100% certain.
        </p>
        <div className="card p-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-500">Champ SIREN dans HubSpot</label>
              <input type="text" defaultValue="siren" placeholder="siren (nom du champ custom HubSpot)" className={inputClass} />
              <p className="mt-1 text-[10px] text-slate-400">Nom de la propriété HubSpot qui contient le SIREN (9 chiffres)</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Champ SIRET dans HubSpot</label>
              <input type="text" defaultValue="siret" placeholder="siret" className={inputClass} />
              <p className="mt-1 text-[10px] text-slate-400">Nom de la propriété pour le SIRET (14 chiffres, établissement)</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Champ TVA dans HubSpot</label>
              <input type="text" defaultValue="vat_number" placeholder="vat_number" className={inputClass} />
              <p className="mt-1 text-[10px] text-slate-400">N° TVA intracommunautaire (ex: FR12345678901)</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Champ LinkedIn Company dans HubSpot</label>
              <input type="text" defaultValue="linkedin_company_page" placeholder="linkedin_company_page" className={inputClass} />
              <p className="mt-1 text-[10px] text-slate-400">URL de la page LinkedIn entreprise</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Champ SIREN dans Stripe (metadata key)</label>
              <input type="text" defaultValue="siren" placeholder="siren (dans customer.metadata)" className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Champ SIREN dans Pennylane</label>
              <input type="text" defaultValue="siren" placeholder="Automatique (champ natif Pennylane)" className={inputClass} />
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500">
              Enregistrer le mapping
            </button>
          </div>
        </div>
      </div>

      {/* ── Règles de résolution d'entités ── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-blue-500" />Règles de résolution d&apos;entités
        </h2>
        <p className="text-sm text-slate-500">
          Comment Revold décide qu&apos;un contact Stripe et un contact HubSpot sont la même personne,
          ou que deux sociétés dans Pennylane et HubSpot sont la même entreprise.
          Ordonnez les règles par fiabilité décroissante — la première match qui passe gagne.
        </p>
        <div className="space-y-3">
          {RESOLUTION_RULES.map((rule) => (
            <article key={rule.id} className="card overflow-hidden">
              <div className="flex items-start justify-between gap-4 p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">{rule.entity}</span>
                    <h3 className="text-sm font-semibold text-slate-900">{rule.rule}</h3>
                    {rule.confidence != null && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        rule.confidence >= 95 ? "bg-emerald-100 text-emerald-700" :
                        rule.confidence >= 80 ? "bg-blue-100 text-blue-700" :
                        "bg-amber-100 text-amber-700"
                      }`}>
                        {rule.confidence}% confiance
                      </span>
                    )}
                    {rule.confidence === null && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        Validation humaine
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{rule.description}</p>
                </div>
                <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                  <input type="checkbox" className="peer sr-only" defaultChecked={rule.enabled} />
                  <div className="h-5 w-9 rounded-full bg-slate-200 peer-checked:bg-emerald-500 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />
                </label>
              </div>
              {/* Configuration fields */}
              <div className="border-t border-card-border bg-slate-50/50 px-4 py-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {rule.configFields.map((f) => (
                    <div key={f.label}>
                      <label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{f.label}</label>
                      {"options" in f && f.options ? (
                        <select defaultValue={f.value} className={selectClass + " mt-1 text-xs"}>
                          {f.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input type="text" defaultValue={f.value} className={inputClass + " mt-1 text-xs"} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="flex justify-end">
          <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500">
            Enregistrer les règles
          </button>
        </div>
      </div>

      {/* ── Field authority matrix ── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-violet-500" />Priorité des sources par champ
        </h2>
        <p className="text-sm text-slate-500">
          Quand plusieurs outils ont la même donnée, Revold utilise cette matrice pour décider quelle source fait foi.
          L&apos;ordre de priorité est modifiable par glisser-déposer (bientôt).
        </p>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <th className="px-5 py-2">Entité</th>
                <th className="px-5 py-2">Champ</th>
                <th className="px-5 py-2">Ordre de priorité</th>
                <th className="px-5 py-2">Logique</th>
              </tr>
            </thead>
            <tbody>
              {FIELD_AUTHORITY.map((row, i) => (
                <tr key={i} className="border-b border-card-border last:border-0">
                  <td className="px-5 py-2.5">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{row.entity}</span>
                  </td>
                  <td className="px-5 py-2.5 font-mono text-xs text-slate-700">{row.field}</td>
                  <td className="px-5 py-2.5">
                    <div className="flex flex-wrap items-center gap-1">
                      {row.priority.map((p, idx) => (
                        <span key={p} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          idx === 0 ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"
                        }`}>
                          {idx + 1}. {p}
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

      {/* ── Dedup rules ── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />Règles de déduplication
        </h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <th className="px-5 py-2">Entité</th>
                <th className="px-5 py-2">Critère principal</th>
                <th className="px-5 py-2">Critères secondaires</th>
                <th className="px-5 py-2">Action</th>
                <th className="px-5 py-2">Actif</th>
              </tr>
            </thead>
            <tbody>
              {DEDUP_RULES.map((r, i) => (
                <tr key={i} className="border-b border-card-border last:border-0">
                  <td className="px-5 py-2.5 font-medium text-slate-800">{r.entity}</td>
                  <td className="px-5 py-2.5 font-mono text-xs text-slate-600">{r.criteria}</td>
                  <td className="px-5 py-2.5 text-xs text-slate-500">{r.secondaryCriteria}</td>
                  <td className="px-5 py-2.5">
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{r.action}</span>
                  </td>
                  <td className="px-5 py-2.5">
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input type="checkbox" className="peer sr-only" defaultChecked={r.enabled} />
                      <div className="h-5 w-9 rounded-full bg-slate-200 peer-checked:bg-emerald-500 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Sync schedule ── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-amber-500" />Fréquence de synchronisation
        </h2>
        <div className="card p-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-500">Sync CRM (HubSpot, Pipedrive…)</label>
              <select defaultValue="hourly" className={selectClass + " mt-1"}>
                <option value="hourly">Toutes les heures</option>
                <option value="4h">Toutes les 4 heures</option>
                <option value="daily">1 fois par jour</option>
                <option value="manual">Manuelle uniquement</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Sync billing (Stripe, Pennylane…)</label>
              <select defaultValue="webhook" className={selectClass + " mt-1"}>
                <option value="webhook">Webhooks temps réel</option>
                <option value="hourly">Toutes les heures</option>
                <option value="daily">1 fois par jour</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Sync support (Zendesk, Intercom…)</label>
              <select defaultValue="hourly" className={selectClass + " mt-1"}>
                <option value="hourly">Toutes les heures</option>
                <option value="4h">Toutes les 4 heures</option>
                <option value="daily">1 fois par jour</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Calcul des KPIs et scores</label>
              <select defaultValue="daily" className={selectClass + " mt-1"}>
                <option value="daily">1 fois par jour (recommandé)</option>
                <option value="twice">2 fois par jour</option>
                <option value="realtime">Temps réel (Enterprise)</option>
              </select>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500">
              Enregistrer la planification
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
