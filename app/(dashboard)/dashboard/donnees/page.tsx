import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getCanonicalIntegrationData } from "@/lib/supabase/cached";
import { getBarColor } from "@/lib/score-utils";
import { filterBusinessIntegrations } from "@/lib/integrations/integration-score";
import { ExpandableIntegrationsList } from "@/components/expandable-integrations-list";
import Link from "next/link";

export default async function DonneesPage() {
  const orgId = await getOrgId();
  if (!orgId) return null;

  const supabase = await createSupabaseServerClient();
  const { integrations: hsIntegrations } = await getCanonicalIntegrationData();
  const businessIntegrations = filterBusinessIntegrations(hsIntegrations);

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
