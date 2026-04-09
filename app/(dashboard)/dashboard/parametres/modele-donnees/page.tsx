import { ParametresTabs } from "@/components/parametres-tabs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

// Field authority matrix — defines which source wins for each business field
// when multiple tools have the same data. This is the heart of Revold's
// multi-source canonical entity model.
const FIELD_AUTHORITY = [
  { entity: "Contact", field: "email", priority: ["Stripe", "HubSpot", "Pipedrive", "Zoho", "Salesforce"], rationale: "L'email facturé est toujours vérifié → source de vérité" },
  { entity: "Contact", field: "phone", priority: ["HubSpot", "Pipedrive", "Aircall", "Kaspr"], rationale: "Le commercial qualifie le téléphone dans le CRM" },
  { entity: "Contact", field: "title", priority: ["LinkedIn Sales Nav", "HubSpot", "Kaspr"], rationale: "LinkedIn est la source la plus à jour pour les titres" },
  { entity: "Contact", field: "owner", priority: ["HubSpot", "Pipedrive"], rationale: "L'attribution commerciale est gérée dans le CRM principal" },
  { entity: "Company", field: "name", priority: ["HubSpot", "Pipedrive", "Stripe"], rationale: "Le commercial qualifie le nom officiel" },
  { entity: "Company", field: "domain", priority: ["Kaspr", "Dropcontact", "HubSpot"], rationale: "Les outils d'enrichissement sont les plus fiables" },
  { entity: "Company", field: "industry", priority: ["LinkedIn Sales Nav", "Kaspr", "HubSpot"], rationale: "Source d'enrichissement plus fraîche que la saisie manuelle" },
  { entity: "Company", field: "annual_revenue", priority: ["LinkedIn Sales Nav", "ZoomInfo", "HubSpot"], rationale: "Les bases d'enrichissement B2B" },
  { entity: "Deal", field: "stage", priority: ["HubSpot", "Pipedrive", "Salesforce"], rationale: "Le pipeline est piloté dans le CRM" },
  { entity: "Deal", field: "amount", priority: ["Stripe", "Pennylane", "HubSpot"], rationale: "Le montant facturé > montant forecast" },
  { entity: "Deal", field: "close_date", priority: ["Stripe", "Pennylane", "HubSpot"], rationale: "La date de paiement est la close_date réelle" },
  { entity: "Invoice", field: "all", priority: ["Stripe", "Pennylane", "Sellsy", "Axonaut", "QuickBooks"], rationale: "Toujours la source originale, jamais HubSpot" },
  { entity: "Subscription", field: "mrr", priority: ["Stripe", "Pennylane"], rationale: "Le MRR n'existe que dans l'outil de facturation" },
  { entity: "Ticket", field: "all", priority: ["Zendesk", "Intercom", "Freshdesk", "Crisp"], rationale: "Toujours la source ticketing native" },
];

const ENTITY_RESOLUTION_RULES = [
  {
    rule: "Match par email exact",
    description: "Deux contacts avec le même email lowercase sont fusionnés automatiquement",
    confidence: "100%",
    enabled: true,
  },
  {
    rule: "Match par domaine entreprise",
    description: "Companies avec le même domaine web sont fusionnées (ex: acme.com)",
    confidence: "95%",
    enabled: true,
  },
  {
    rule: "Match par nom entreprise + fuzzy",
    description: "Distance de Levenshtein < 3 + même pays (Acme Inc / Acme Corp)",
    confidence: "75%",
    enabled: false,
  },
  {
    rule: "Match manuel (réconciliation UI)",
    description: "Les non-matchés sont présentés à l'utilisateur dans une queue de réconciliation",
    confidence: "Validation humaine",
    enabled: false,
  },
];

const DEDUP_RULES = [
  { entity: "Contact", criteria: "email lowercase", action: "Merge auto" },
  { entity: "Company", criteria: "domain ou name normalisé", action: "Merge auto" },
  { entity: "Deal", criteria: "external_id par source", action: "Upsert via source_links" },
  { entity: "Invoice", criteria: "stripe_id / pennylane_id", action: "Upsert via source_links" },
];

export default async function ParametresModeleDonneesPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;

  const supabase = await createSupabaseServerClient();
  const [{ count: sourceLinksCount }, { count: contactsCount }, { count: companiesCount }] = await Promise.all([
    supabase.from("source_links").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("companies").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
  ]);

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500">
          Modèle de données canonique et règles de résolution multi-sources qui pilotent l&apos;ensemble de Revold.
        </p>
      </header>

      <ParametresTabs />

      {/* Stats du modèle canonique */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Liens sources</p>
          <p className="mt-1 text-3xl font-bold text-violet-600">{sourceLinksCount ?? 0}</p>
          <p className="mt-1 text-xs text-slate-400">External ID → Revold</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Contacts canoniques</p>
          <p className="mt-1 text-3xl font-bold text-blue-600">{(contactsCount ?? 0).toLocaleString("fr-FR")}</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Sociétés canoniques</p>
          <p className="mt-1 text-3xl font-bold text-indigo-600">{(companiesCount ?? 0).toLocaleString("fr-FR")}</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Sources connectées</p>
          <p className="mt-1 text-3xl font-bold text-emerald-600">14</p>
          <p className="mt-1 text-xs text-slate-400">Connecteurs disponibles</p>
        </article>
      </div>

      {/* Field authority */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-violet-500" />Priorité des sources par champ
        </h2>
        <p className="text-sm text-slate-500">
          Quand plusieurs outils ont la même donnée pour un champ, Revold utilise cette table d&apos;autorité pour décider quelle source fait foi.
        </p>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <th className="px-5 py-2">Entité</th>
                <th className="px-5 py-2">Champ</th>
                <th className="px-5 py-2">Ordre de priorité</th>
                <th className="px-5 py-2">Pourquoi</th>
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
                        <span key={p}>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${idx === 0 ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"}`}>
                            {idx + 1}. {p}
                          </span>
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

      {/* Entity resolution rules */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-blue-500" />Règles de résolution d&apos;entités
        </h2>
        <p className="text-sm text-slate-500">
          Comment Revold décide qu&apos;un contact Stripe et un contact HubSpot sont la même personne.
        </p>
        <div className="space-y-3">
          {ENTITY_RESOLUTION_RULES.map((rule, i) => (
            <article key={i} className="card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{rule.rule}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${rule.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {rule.enabled ? "Actif" : "Inactif"}
                    </span>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                      Confiance : {rule.confidence}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{rule.description}</p>
                </div>
                <button disabled className="rounded-lg border border-card-border bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-400">
                  Configurer
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Dedup rules */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />Règles de déduplication
        </h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <th className="px-5 py-2">Entité</th>
                <th className="px-5 py-2">Critère de match</th>
                <th className="px-5 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {DEDUP_RULES.map((r, i) => (
                <tr key={i} className="border-b border-card-border last:border-0">
                  <td className="px-5 py-2.5 font-medium text-slate-800">{r.entity}</td>
                  <td className="px-5 py-2.5 font-mono text-xs text-slate-600">{r.criteria}</td>
                  <td className="px-5 py-2.5">
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{r.action}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sync schedule */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-amber-500" />Fréquence de synchronisation
        </h2>
        <div className="card p-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-500">Sync HubSpot</label>
              <select disabled className="mt-1 w-full rounded-lg border border-card-border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <option>Toutes les heures</option>
                <option>Toutes les 4 heures</option>
                <option>1 fois par jour</option>
                <option>Manuelle uniquement</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Sync billing (Stripe, Pennylane…)</label>
              <select disabled className="mt-1 w-full rounded-lg border border-card-border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <option>Webhooks temps réel</option>
                <option>Toutes les heures</option>
                <option>1 fois par jour</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Sync support (Zendesk, Intercom…)</label>
              <select disabled className="mt-1 w-full rounded-lg border border-card-border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <option>Toutes les heures</option>
                <option>Toutes les 4 heures</option>
                <option>1 fois par jour</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Calcul des KPIs</label>
              <select disabled className="mt-1 w-full rounded-lg border border-card-border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <option>1 fois par jour (recommandé)</option>
                <option>2 fois par jour</option>
                <option>Temps réel (Enterprise)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
