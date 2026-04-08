import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";
import { getScoreLabel } from "@/lib/score-utils";

const sourceLabels: Record<string, string> = {
  INTEGRATION: "Intégration native (Outlook, Gmail, etc.)",
  EMAIL_INTEGRATION: "Intégration Email (Gmail/Outlook)",
  IMPORT: "Import de fichier (CSV/Excel)",
  CRM_UI: "Création manuelle CRM",
  FORM: "Formulaires HubSpot",
  API: "API HubSpot",
  MOBILE_IOS: "Application mobile iOS",
  INTERNAL_PROCESSING: "Traitement interne HubSpot",
  MARKETING_EMAIL: "Email marketing",
  WORKFLOW: "Workflow HubSpot",
  CONTACTS_WEB: "Site web (tracking HubSpot)",
};
const nativeKeys = ["INTEGRATION", "EMAIL_INTEGRATION", "FORM", "MARKETING_EMAIL", "WORKFLOW", "CONTACTS_WEB"];

export default async function PerformanceMarketingPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();

  // Fetch contact sources from HubSpot Search API
  let contactSourcesGlobal: Array<{ source: string; count: number }> = [];
  if (process.env.HUBSPOT_ACCESS_TOKEN) {
    const sourcesToCheck = ["INTEGRATION", "EMAIL_INTEGRATION", "IMPORT", "CRM_UI", "FORM", "API", "MOBILE_IOS", "INTERNAL_PROCESSING", "MARKETING_EMAIL", "WORKFLOW", "CONTACTS_WEB"];
    try {
      const counts = await Promise.all(sourcesToCheck.map(async (src) => {
        const res = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/search`, {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            filterGroups: [{ filters: [{ propertyName: "hs_object_source", operator: "EQ", value: src }] }],
            limit: 1,
          }),
        });
        if (!res.ok) return { source: src, count: 0 };
        const data = await res.json();
        return { source: src, count: data.total ?? 0 };
      }));
      contactSourcesGlobal = counts.filter((c) => c.count > 0).sort((a, b) => b.count - a.count);
    } catch {
      // Fail silently
    }
  }

  const totalSourceContacts = contactSourcesGlobal.reduce((s, c) => s + c.count, 0);
  const nativeIntegrations = contactSourcesGlobal.filter((s) => nativeKeys.includes(s.source));
  const totalNative = nativeIntegrations.reduce((s, i) => s + i.count, 0);
  const nativeShare = totalSourceContacts > 0 ? Math.round((totalNative / totalSourceContacts) * 100) : 0;

  const [
    { count: totalContacts },
    { count: leadContacts },
    { count: opportunityContacts },
    { count: contactsWithCompany },
    { count: contactsOrphans },
    { count: totalDeals },
    { count: contactsWithDeals },
    { data: recentContacts },
  ] = await Promise.all([
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_mql", false).eq("is_sql", false),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_sql", true),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).not("company_id", "is", null),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("company_id", null),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    // Contacts qui sont dans une opportunité (is_sql = true = lifecycle opportunity/customer)
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_sql", true),
    supabase.from("contacts").select("id, full_name, email, is_mql, is_sql, created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(10),
  ]);

  const total = totalContacts ?? 0;
  const leads = leadContacts ?? 0;
  const opportunities = opportunityContacts ?? 0;
  const withCompany = contactsWithCompany ?? 0;
  const orphans = contactsOrphans ?? 0;
  const deals = totalDeals ?? 0;
  const recent = recentContacts ?? [];

  // Taux de conversion : Lead → Opportunité
  const conversionRate = total > 0 ? Math.round((opportunities / total) * 100) : 0;
  // Taux d'attribution : contacts rattachés à une entreprise
  const attributionRate = total > 0 ? Math.round((withCompany / total) * 100) : 0;
  // Ratio contacts par transaction
  const contactsPerDeal = deals > 0 ? (total / deals).toFixed(1) : "—";

  const marketingScore = Math.round(
    Math.min(100, conversionRate * 3) * 0.35 +
    attributionRate * 0.35 +
    (deals > 0 ? Math.min(100, (total / deals) * 10) : 0) * 0.30
  );

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Performance Marketing</h1>
        <p className="mt-1 text-sm text-slate-500">
          Analyse du funnel, de l&apos;attribution et de la qualité des contacts.
        </p>
      </header>

      <div className="card flex flex-col items-center gap-6 p-6 md:flex-row">
        <ProgressScore label="Score Marketing" score={marketingScore} colorClass="stroke-amber-500" />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-slate-900">{marketingScore}</span>
            <span className="text-sm text-slate-400">/100</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getScoreLabel(marketingScore).className}`}>
              {getScoreLabel(marketingScore).label}
            </span>
          </div>
        </div>
      </div>

      {/* Funnel */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-amber-500" />Funnel de conversion
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Contacts totaux</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{total.toLocaleString("fr-FR")}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Leads</p>
            <p className="mt-1 text-3xl font-bold text-blue-600">{leads.toLocaleString("fr-FR")}</p>
            <p className="mt-1 text-xs text-slate-400">{total > 0 ? `${Math.round((leads / total) * 100)}%` : ""} du total</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Opportunités</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{opportunities.toLocaleString("fr-FR")}</p>
            <p className="mt-1 text-xs text-slate-400">{total > 0 ? `${Math.round((opportunities / total) * 100)}%` : ""} du total</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Conversion Lead vers Opportunité</p>
            <p className={`mt-1 text-3xl font-bold ${conversionRate >= 25 ? "text-emerald-600" : conversionRate >= 10 ? "text-yellow-600" : "text-orange-500"}`}>{conversionRate}%</p>
          </article>
        </div>
      </div>

      {/* Qualité des données contacts */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-violet-500" />Qualité et attribution des contacts
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Contacts attribués</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{withCompany.toLocaleString("fr-FR")}</p>
            <p className="mt-1 text-xs text-slate-400">Rattachés à une entreprise</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Contacts orphelins</p>
            <p className={`mt-1 text-3xl font-bold ${orphans > total * 0.3 ? "text-red-500" : "text-slate-900"}`}>{orphans.toLocaleString("fr-FR")}</p>
            <p className="mt-1 text-xs text-slate-400">Sans entreprise</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Taux d&apos;attribution</p>
            <p className={`mt-1 text-3xl font-bold ${attributionRate >= 80 ? "text-emerald-600" : attributionRate >= 50 ? "text-yellow-600" : "text-orange-500"}`}>{attributionRate}%</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Contacts par transaction</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{contactsPerDeal}</p>
            <p className="mt-1 text-xs text-slate-400">Ratio contacts sur deals</p>
          </article>
        </div>
      </div>

      {/* Intégrations natives utilisées */}
      {nativeIntegrations.length > 0 && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-violet-500" />Intégrations natives utilisées
            <span className="text-sm font-normal text-slate-400">{totalNative.toLocaleString("fr-FR")} contacts ({nativeShare}%)</span>
          </h2>
          <p className="text-sm text-slate-500">Contacts créés via des intégrations connectées au portail HubSpot.</p>
          <div className="card overflow-hidden">
            <div className="divide-y divide-card-border">
              {nativeIntegrations.map((s) => {
                const pct = totalNative > 0 ? Math.round((s.count / totalNative) * 100) : 0;
                return (
                  <div key={s.source} className="px-5 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{sourceLabels[s.source] ?? s.source}</p>
                        <p className="text-xs text-slate-400">{s.source}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900">{s.count.toLocaleString("fr-FR")}</p>
                        <p className="text-xs text-slate-400">{pct}% des intégrations natives</p>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Toutes les sources de contacts */}
      {contactSourcesGlobal.length > 0 && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-blue-500" />Toutes les sources d&apos;acquisition
            <span className="text-sm font-normal text-slate-400">{totalSourceContacts.toLocaleString("fr-FR")} contacts</span>
          </h2>
          <div className="card overflow-hidden">
            <div className="divide-y divide-card-border">
              {contactSourcesGlobal.map((s) => {
                const pct = totalSourceContacts > 0 ? Math.round((s.count / totalSourceContacts) * 100) : 0;
                const isNative = nativeKeys.includes(s.source);
                return (
                  <div key={s.source} className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-800">{sourceLabels[s.source] ?? s.source}</p>
                        {isNative && <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-xs font-medium text-violet-700">Native</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{s.count.toLocaleString("fr-FR")}</span>
                        <span className="text-xs text-slate-400">{pct}%</span>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
                      <div className={`h-1.5 rounded-full ${isNative ? "bg-violet-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Derniers contacts */}
      {recent.length > 0 && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />Derniers contacts ajoutés
          </h2>
          <div className="card overflow-hidden">
            <div className="divide-y divide-card-border">
              {recent.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{c.full_name}</p>
                    <p className="text-xs text-slate-400">{c.email}</p>
                  </div>
                  <div className="text-right">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.is_sql ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}>
                      {c.is_sql ? "Opportunité" : "Lead"}
                    </span>
                    {c.created_at && <p className="mt-1 text-xs text-slate-400">{new Date(c.created_at).toLocaleDateString("fr-FR")}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
