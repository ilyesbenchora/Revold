export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getCanonicalIntegrationData, getHubspotEcosystemCounts } from "@/lib/supabase/cached";
import { getBarColor } from "@/lib/score-utils";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { filterBusinessIntegrations } from "@/lib/integrations/integration-score";
import { ExpandableIntegrationsList } from "@/components/expandable-integrations-list";
import Link from "next/link";

type CustomPropStat = { objectType: string; label: string; total: number; custom: number };

async function fetchCustomProperties(token: string): Promise<CustomPropStat[]> {
  const objectTypes = [
    { key: "contacts", label: "Contacts" },
    { key: "companies", label: "Entreprises" },
    { key: "deals", label: "Transactions" },
  ];
  const results: CustomPropStat[] = [];
  for (const ot of objectTypes) {
    try {
      const res = await fetch(`https://api.hubapi.com/crm/v3/properties/${ot.key}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = await res.json();
      const props = (data.results ?? []) as Array<{ hubspotDefined: boolean }>;
      const custom = props.filter((p) => !p.hubspotDefined).length;
      results.push({ objectType: ot.key, label: ot.label, total: props.length, custom });
    } catch {}
  }
  return results;
}

export default async function DonneesPage() {
  const orgId = await getOrgId();
  if (!orgId) return null;

  const supabase = await createSupabaseServerClient();
  const [{ integrations: hsIntegrations }, ecosystem] = await Promise.all([
    getCanonicalIntegrationData(),
    getHubspotEcosystemCounts(),
  ]);
  const businessIntegrations = filterBusinessIntegrations(hsIntegrations);

  // Fetch custom properties from HubSpot
  const hubspotToken = await getHubSpotToken(supabase, orgId);
  let propStats: CustomPropStat[] = [];
  if (hubspotToken) {
    propStats = await fetchCustomProperties(hubspotToken);
  }
  const totalCustomProps = propStats.reduce((s, p) => s + p.custom, 0);
  const totalAllProps = propStats.reduce((s, p) => s + p.total, 0);

  // Quick summary per object
  const [
    { count: tc }, { count: contactsWithPhone }, { count: contactsWithCompany },
    { count: tco }, { count: companiesWithDomain },
    { count: td }, { count: dealsWithAmount },
  ] = await Promise.all([
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).not("phone", "is", null),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).not("company_id", "is", null),
    supabase.from("companies").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("companies").select("*", { count: "exact", head: true }).eq("organization_id", orgId).not("domain", "is", null),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).gt("amount", 0),
  ]);

  const total = (n: number | null) => n ?? 0;
  const pct = (filled: number | null, t: number) => t > 0 ? Math.round((total(filled) / t) * 100) : 0;

  const summaries = [
    {
      label: "Contacts",
      href: "/dashboard/donnees/contacts",
      count: total(tc),
      color: "bg-blue-500",
      metrics: [
        { label: "Téléphone", pct: pct(contactsWithPhone, total(tc)) },
        { label: "Entreprise liée", pct: pct(contactsWithCompany, total(tc)) },
      ],
    },
    {
      label: "Entreprises",
      href: "/dashboard/donnees/entreprises",
      count: total(tco),
      color: "bg-violet-500",
      metrics: [
        { label: "Domaine", pct: pct(companiesWithDomain, total(tco)) },
      ],
    },
    {
      label: "Transactions",
      href: "/dashboard/donnees/transactions",
      count: total(td),
      color: "bg-orange-500",
      metrics: [
        { label: "Montant", pct: pct(dealsWithAmount, total(td)) },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Object summary cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {summaries.map((s) => (
          <Link key={s.label} href={s.href} className="card p-5 transition hover:shadow-md group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${s.color}`} />
                <span className="text-sm font-semibold text-slate-900 group-hover:text-accent">{s.label}</span>
              </div>
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{s.count.toLocaleString("fr-FR")}</span>
            </div>
            <div className="mt-3 space-y-2">
              {s.metrics.map((m) => (
                <div key={m.label}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">{m.label}</span>
                    <span className={`font-semibold ${m.pct >= 80 ? "text-emerald-600" : m.pct >= 50 ? "text-amber-600" : "text-red-500"}`}>{m.pct} %</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${getBarColor(m.pct)}`} style={{ width: `${m.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-slate-400 group-hover:text-accent">Voir le détail →</p>
          </Link>
        ))}
      </div>

      {/* Écosystème HubSpot complet — counts via les 41 scopes optional */}
      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Écosystème HubSpot complet</h2>
            <p className="text-[11px] text-slate-500">
              Tous les objets et features HubSpot accessibles via votre OAuth.
              Les zéros peuvent indiquer un scope non accordé ou un objet non utilisé.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[
            { label: "Tickets", count: ecosystem.tickets, group: "Service" },
            { label: "Conversations", count: ecosystem.conversations, group: "Service" },
            { label: "Feedback (CSAT/NPS)", count: ecosystem.feedbackSubmissions, group: "Service" },
            { label: "Leads", count: ecosystem.leads, group: "Sales" },
            { label: "Devis", count: ecosystem.quotes, group: "Sales" },
            { label: "Line items", count: ecosystem.lineItems, group: "Sales" },
            { label: "Sequences", count: ecosystem.sequences, group: "Sales" },
            { label: "Forecasts", count: ecosystem.forecasts, group: "Sales" },
            { label: "Goals", count: ecosystem.goals, group: "Sales" },
            { label: "Factures", count: ecosystem.invoices, group: "Revenue" },
            { label: "Subscriptions", count: ecosystem.subscriptions, group: "Revenue" },
            { label: "Marketing campaigns", count: ecosystem.marketingCampaigns, group: "Marketing" },
            { label: "Marketing events", count: ecosystem.marketingEvents, group: "Marketing" },
            { label: "Forms", count: ecosystem.forms, group: "Marketing" },
            { label: "Listings (immo)", count: ecosystem.listings, group: "Custom" },
            { label: "Projects", count: ecosystem.projects, group: "Custom" },
            { label: "Custom objects", count: ecosystem.customObjects, group: "Custom" },
            { label: "Listes", count: ecosystem.lists, group: "Workspace" },
            { label: "Pipelines", count: ecosystem.pipelines, group: "Workspace" },
            { label: "Workflows", count: ecosystem.workflows, group: "Workspace" },
            { label: "Workflows actifs", count: ecosystem.workflowsActive, group: "Workspace" },
            { label: "Utilisateurs", count: ecosystem.users, group: "Workspace" },
            { label: "Équipes", count: ecosystem.teams, group: "Workspace" },
            { label: "Rendez-vous", count: ecosystem.appointments, group: "Workspace" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-slate-400">{item.group}</span>
                <span
                  className={`text-2xl font-bold tabular-nums ${
                    item.count > 0 ? "text-slate-900" : "text-slate-300"
                  }`}
                >
                  {item.count.toLocaleString("fr-FR")}
                </span>
              </div>
              <p className="mt-1 text-xs font-medium text-slate-700">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Propriétés personnalisées HubSpot */}
      {propStats.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Propriétés personnalisées</h2>
              <p className="text-[11px] text-slate-500">Champs créés par votre équipe dans HubSpot</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-accent tabular-nums">{totalCustomProps}</p>
              <p className="text-[10px] text-slate-400">sur {totalAllProps} propriétés</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {propStats.map((p) => (
              <div key={p.objectType} className="rounded-lg bg-slate-50 p-3">
                <p className="text-[10px] font-medium text-slate-500">{p.label}</p>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-lg font-bold text-slate-900 tabular-nums">{p.custom}</span>
                  <span className="text-[10px] text-slate-400">custom</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${p.total > 0 ? (p.custom / p.total) * 100 : 0}%` }} />
                </div>
                <p className="mt-1 text-[9px] text-slate-400">{p.total - p.custom} natives · {p.custom} personnalisées</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Applications connectées */}
      {businessIntegrations.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-violet-500" />Applications connectées à HubSpot
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">{businessIntegrations.length}</span>
          </h2>
          <ExpandableIntegrationsList totalCount={businessIntegrations.length} visibleByDefault={4}>
            {businessIntegrations.map((int) => (
              <article key={int.key} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{int.icon}</span>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{int.label}</h3>
                      <p className="text-xs text-slate-400">{int.vendor}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Propriétés</p>
                    <p className="text-lg font-bold text-slate-900">{int.totalProperties}</p>
                  </div>
                </div>
                {int.totalProperties > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Enrichissement</span>
                      <span className={`font-bold ${int.enrichmentRate >= 50 ? "text-emerald-600" : int.enrichmentRate >= 20 ? "text-amber-600" : "text-orange-500"}`}>{int.enrichmentRate}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${getBarColor(int.enrichmentRate)}`} style={{ width: `${Math.min(100, int.enrichmentRate)}%` }} />
                    </div>
                  </div>
                )}
              </article>
            ))}
          </ExpandableIntegrationsList>
        </div>
      )}
    </div>
  );
}
