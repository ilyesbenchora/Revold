import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getLatestKpi } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";
import { KpiChart } from "@/components/kpi-chart";

function getScoreLabel(score: number) {
  if (score >= 80) return { label: "Excellent", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (score >= 50) return { label: "Moyen", className: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: "Insuffisant", className: "bg-red-50 text-red-700 border-red-200" };
}

type Activity = {
  id: string;
  type: string;
  subject: string | null;
  contact_id: string | null;
  occurred_at: string;
};

type Contact = {
  id: string;
  is_mql: boolean;
  is_sql: boolean;
  company_id: string | null;
  created_at: string;
};

export default async function PerformanceMarketingPage() {
  const orgId = await getOrgId();
  const supabase = await createSupabaseServerClient();
  const k = await getLatestKpi();
  const marketingScore = Number(k?.marketing_score) || 0;

  const [
    { data: snapshots },
    { data: allContacts },
    { data: emailActivities },
  ] = await Promise.all([
    supabase
      .from("kpi_snapshots")
      .select("snapshot_date, mql_to_sql_rate, lead_velocity_rate, funnel_leakage_rate")
      .eq("organization_id", orgId)
      .order("snapshot_date", { ascending: true })
      .limit(7),
    supabase
      .from("contacts")
      .select("id, is_mql, is_sql, company_id, created_at")
      .eq("organization_id", orgId),
    supabase
      .from("activities")
      .select("id, type, subject, contact_id, occurred_at")
      .eq("organization_id", orgId)
      .eq("type", "email"),
  ]);

  const contacts = (allContacts ?? []) as Contact[];
  const emails = (emailActivities ?? []) as Activity[];

  const totalContacts = contacts.length;
  const mqlCount = contacts.filter((c) => c.is_mql).length;
  const sqlCount = contacts.filter((c) => c.is_sql).length;

  // ── Formulaires: contacts grouped by source (company = source proxy) ──
  // Contacts with a company = came via a form/attribution, without = organic
  const withCompany = contacts.filter((c) => c.company_id != null);
  const withoutCompany = contacts.filter((c) => c.company_id == null);

  // Group contacts by company_id as "form sources"
  const sourceMap = new Map<string, { count: number; mqls: number; sqls: number }>();
  withCompany.forEach((c) => {
    const key = c.company_id!;
    const entry = sourceMap.get(key) || { count: 0, mqls: 0, sqls: 0 };
    entry.count++;
    if (c.is_mql) entry.mqls++;
    if (c.is_sql) entry.sqls++;
    sourceMap.set(key, entry);
  });

  const topSources = Array.from(sourceMap.entries())
    .sort((a, b) => b[1].sqls - a[1].sqls || b[1].mqls - a[1].mqls)
    .slice(0, 5);

  const formConversionRate = withCompany.length > 0
    ? Math.round((withCompany.filter((c) => c.is_mql).length / withCompany.length) * 100)
    : 0;

  // ── Emails marketing ──
  const totalEmails = emails.length;

  // Group emails by subject to find most performant
  const emailsBySubject = new Map<string, number>();
  emails.forEach((e) => {
    const subject = e.subject || "Sans objet";
    emailsBySubject.set(subject, (emailsBySubject.get(subject) || 0) + 1);
  });
  const topEmails = Array.from(emailsBySubject.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Emails with contact (engaged) vs without
  const emailsWithContact = emails.filter((e) => e.contact_id != null).length;
  const emailEngagementRate = totalEmails > 0 ? Math.round((emailsWithContact / totalEmails) * 100) : 0;

  const kpis = [
    { label: "MQL → SQL", value: k?.mql_to_sql_rate ? `${k.mql_to_sql_rate}%` : "—", description: "Taux de conversion des MQL en SQL" },
    { label: "Vélocité leads", value: k?.lead_velocity_rate ? `+${k.lead_velocity_rate}%` : "—", description: "Croissance mensuelle du volume de leads" },
    { label: "Fuite funnel", value: k?.funnel_leakage_rate ? `${k.funnel_leakage_rate}%` : "—", description: "Taux de perte dans le funnel marketing" },
  ];

  const chartData = (snapshots ?? []).map((s) => ({
    date: new Date(s.snapshot_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    mqlToSql: Number(s.mql_to_sql_rate),
    leadVelocity: Number(s.lead_velocity_rate),
  }));

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Performance Marketing</h1>
        <p className="mt-1 text-sm text-slate-500">
          KPIs de performance de l&apos;équipe marketing et du funnel d&apos;acquisition.
        </p>
      </header>

      {/* Score */}
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
          <p className="mt-2 text-sm text-slate-500">
            Performance globale marketing basée sur la conversion, la vélocité et la rétention funnel.
          </p>
        </div>
      </div>

      {/* Funnel */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-amber-500" />Funnel
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Contacts totaux</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{totalContacts}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">MQL</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{mqlCount}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">SQL</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{sqlCount}</p>
          </article>
        </div>
      </div>

      {/* KPIs */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-orange-500" />KPIs Marketing
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {kpis.map((kpi) => (
            <article key={kpi.label} className="card p-5">
              <p className="text-xs text-slate-500">{kpi.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{kpi.value}</p>
              <p className="mt-2 text-xs text-slate-400">{kpi.description}</p>
            </article>
          ))}
        </div>
      </div>

      {/* Formulaires */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-violet-500" />Formulaires
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Soumissions totales</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{withCompany.length}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Contacts non attribués</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{withoutCompany.length}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Taux de conversion</p>
            <p className={`mt-1 text-3xl font-bold ${formConversionRate >= 20 ? "text-emerald-600" : formConversionRate >= 10 ? "text-amber-500" : "text-red-500"}`}>
              {formConversionRate}%
            </p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Sources d&apos;origine</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{sourceMap.size}</p>
          </article>
        </div>

        {/* Top sources */}
        {topSources.length > 0 && (
          <div className="card overflow-hidden">
            <div className="border-b border-card-border px-5 py-3">
              <p className="text-sm font-semibold text-slate-700">Sources d&apos;origine les plus performantes</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                  <th className="px-5 py-2">#</th>
                  <th className="px-5 py-2">Source</th>
                  <th className="px-5 py-2">Contacts</th>
                  <th className="px-5 py-2">MQL</th>
                  <th className="px-5 py-2">SQL</th>
                </tr>
              </thead>
              <tbody>
                {topSources.map(([sourceId, data], i) => (
                  <tr key={sourceId} className="border-b border-card-border last:border-0">
                    <td className="px-5 py-2.5 text-slate-400">{i + 1}</td>
                    <td className="px-5 py-2.5 font-medium text-slate-800">Source {i + 1}</td>
                    <td className="px-5 py-2.5 text-slate-600">{data.count}</td>
                    <td className="px-5 py-2.5 text-slate-600">{data.mqls}</td>
                    <td className="px-5 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${data.sqls > 0 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {data.sqls}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Emails Marketing */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-blue-500" />Emails Marketing
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Emails envoyés</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{totalEmails}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Avec contact associé</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{emailsWithContact}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Taux d&apos;engagement</p>
            <p className={`mt-1 text-3xl font-bold ${emailEngagementRate >= 50 ? "text-emerald-600" : emailEngagementRate >= 25 ? "text-amber-500" : "text-red-500"}`}>
              {emailEngagementRate}%
            </p>
          </article>
        </div>

        {/* Top emails */}
        {topEmails.length > 0 && (
          <div className="card overflow-hidden">
            <div className="border-b border-card-border px-5 py-3">
              <p className="text-sm font-semibold text-slate-700">Emails marketing les plus performants</p>
            </div>
            <div className="divide-y divide-card-border">
              {topEmails.map(([subject, count], i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs font-medium text-blue-700">{i + 1}</span>
                    <span className="text-sm font-medium text-slate-800">{subject}</span>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{count} envoi{count > 1 ? "s" : ""}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Charts */}
      {chartData.length > 1 && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-amber-500" />Tendances
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <KpiChart data={chartData.map((d) => ({ date: d.date, value: d.mqlToSql }))} label="MQL → SQL (%)" color="#f59e0b" format={(v) => `${v}%`} />
            <KpiChart data={chartData.map((d) => ({ date: d.date, value: d.leadVelocity }))} label="Vélocité leads (%)" color="#d97706" format={(v) => `+${v}%`} />
          </div>
        </div>
      )}

      {!k && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">Aucune donnée disponible.</p>
        </div>
      )}
    </section>
  );
}
