import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";
import { getScoreLabel } from "@/lib/score-utils";

export default async function PerformanceMarketingPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();

  // Counts from contacts + activities — all head:true for speed
  const [
    { count: totalContacts },
    { count: leadContacts },
    { count: opportunityContacts },
    { count: customerContacts },
    { count: contactsWithCompany },
    { count: contactsOrphans },
    { count: totalCalls },
    { count: totalEmails },
    { count: totalMeetings },
    { count: totalNotes },
    { count: totalTasks },
    { data: recentContacts },
  ] = await Promise.all([
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_mql", false).eq("is_sql", false),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_sql", true),
    // Customer = contacts who are SQL (opportunity/customer in HubSpot)
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_sql", true),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).not("company_id", "is", null),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("company_id", null),
    supabase.from("activities").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("type", "call"),
    supabase.from("activities").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("type", "email"),
    supabase.from("activities").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("type", "meeting"),
    supabase.from("activities").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("type", "note"),
    supabase.from("activities").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("type", "task"),
    supabase.from("contacts").select("id, full_name, email, is_mql, is_sql, created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(10),
  ]);

  const total = totalContacts ?? 0;
  const leads = leadContacts ?? 0;
  const opportunities = opportunityContacts ?? 0;
  const withCompany = contactsWithCompany ?? 0;
  const orphans = contactsOrphans ?? 0;
  const calls = totalCalls ?? 0;
  const emails = totalEmails ?? 0;
  const meetings = totalMeetings ?? 0;
  const notes = totalNotes ?? 0;
  const tasks = totalTasks ?? 0;
  const totalActivities = calls + emails + meetings + notes + tasks;
  const recent = recentContacts ?? [];

  // Conversion: Lead → Opportunity
  const conversionRate = total > 0 ? Math.round((opportunities / total) * 100) : 0;
  // Attribution: contacts with a company
  const attributionRate = total > 0 ? Math.round((withCompany / total) * 100) : 0;

  // Score marketing basé sur conversion + attribution + engagement
  const engagementScore = total > 0 ? Math.min(100, Math.round((totalActivities / total) * 20)) : 0;
  const marketingScore = Math.round(
    Math.min(100, conversionRate * 3) * 0.35 +
    attributionRate * 0.35 +
    engagementScore * 0.30
  );

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Performance Marketing</h1>
        <p className="mt-1 text-sm text-slate-500">
          Analyse du funnel, de l&apos;engagement et de l&apos;attribution des contacts.
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

      {/* Funnel contacts */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-amber-500" />Funnel contacts
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Contacts totaux</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{total.toLocaleString("fr-FR")}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Leads</p>
            <p className="mt-1 text-3xl font-bold text-blue-600">{leads.toLocaleString("fr-FR")}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Opportunités</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{opportunities.toLocaleString("fr-FR")}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Taux de conversion</p>
            <p className={`mt-1 text-3xl font-bold ${conversionRate >= 25 ? "text-emerald-600" : conversionRate >= 10 ? "text-yellow-600" : "text-orange-500"}`}>{conversionRate}%</p>
            <p className="mt-1 text-xs text-slate-400">Lead vers Opportunité</p>
          </article>
        </div>
      </div>

      {/* Attribution et qualité */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-violet-500" />Attribution et qualité des contacts
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Contacts attribués</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{withCompany.toLocaleString("fr-FR")}</p>
            <p className="mt-1 text-xs text-slate-400">Associés à une entreprise</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Contacts orphelins</p>
            <p className={`mt-1 text-3xl font-bold ${orphans > total * 0.3 ? "text-red-500" : "text-slate-900"}`}>{orphans.toLocaleString("fr-FR")}</p>
            <p className="mt-1 text-xs text-slate-400">Sans entreprise associée</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Taux d&apos;attribution</p>
            <p className={`mt-1 text-3xl font-bold ${attributionRate >= 80 ? "text-emerald-600" : attributionRate >= 50 ? "text-yellow-600" : "text-orange-500"}`}>{attributionRate}%</p>
          </article>
        </div>
      </div>

      {/* Engagement (activités) */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-blue-500" />Engagement commercial
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Appels</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{calls}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Emails</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{emails}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Réunions</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{meetings}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Notes</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{notes}</p>
          </article>
          <article className="card p-5 text-center">
            <p className="text-xs text-slate-500">Tâches</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{tasks}</p>
          </article>
        </div>
        <p className="text-sm text-slate-400">
          Total : {totalActivities} activités
          {total > 0 && ` · ${(totalActivities / total).toFixed(1)} par contact en moyenne`}
        </p>
      </div>

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
                      c.is_sql ? "bg-emerald-50 text-emerald-700" : c.is_mql ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"
                    }`}>
                      {c.is_sql ? "Opportunité" : c.is_mql ? "Qualifié" : "Lead"}
                    </span>
                    <p className="mt-1 text-xs text-slate-400">{c.created_at ? new Date(c.created_at).toLocaleDateString("fr-FR") : ""}</p>
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
