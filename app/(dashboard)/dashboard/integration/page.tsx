import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";
import { getScoreLabel, getBarColor } from "@/lib/score-utils";
import { HubSpotSyncOrchestrator } from "@/components/hubspot-sync-orchestrator";
import { Suspense } from "react";
import Link from "next/link";

const HUBSPOT_PORTAL = "48372600";

export default async function IntegrationPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const hubspotTokenConfigured = !!process.env.HUBSPOT_ACCESS_TOKEN;

  // Fetch owners directly from HubSpot API for live data
  let owners: Array<{ email: string; firstName: string; lastName: string; teams: string[] }> = [];
  let teamDistribution: Record<string, number> = {};
  let contactSourceDetail: Record<string, number> = {};
  let dealSourceDetail: Record<string, number> = {};

  if (hubspotTokenConfigured) {
    try {
      // Owners
      const ownerRes = await fetch("https://api.hubapi.com/crm/v3/owners?limit=100", {
        headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` },
      });
      if (ownerRes.ok) {
        const ownerData = await ownerRes.json();
        owners = (ownerData.results ?? []).map((o: Record<string, unknown>) => ({
          email: o.email as string,
          firstName: (o.firstName as string) || "",
          lastName: (o.lastName as string) || "",
          teams: ((o.teams as Array<{ name: string }>) ?? []).map((t) => t.name),
        }));
        owners.forEach((o) => {
          o.teams.forEach((t) => { teamDistribution[t] = (teamDistribution[t] || 0) + 1; });
          if (o.teams.length === 0) teamDistribution["Sans équipe"] = (teamDistribution["Sans équipe"] || 0) + 1;
        });
      }

      // Contact sources (sample 100)
      const contactRes = await fetch(
        `https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=hs_object_source_label,hs_object_source_detail_1`,
        { headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` } },
      );
      if (contactRes.ok) {
        const contactData = await contactRes.json();
        (contactData.results ?? []).forEach((c: Record<string, unknown>) => {
          const props = c.properties as Record<string, string | null>;
          const src = props.hs_object_source_detail_1 || props.hs_object_source_label || "Autre";
          contactSourceDetail[src] = (contactSourceDetail[src] || 0) + 1;
        });
      }

      // Deal sources (sample 100)
      const dealRes = await fetch(
        `https://api.hubapi.com/crm/v3/objects/deals?limit=100&properties=hs_object_source_label,hs_object_source_detail_1`,
        { headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` } },
      );
      if (dealRes.ok) {
        const dealData = await dealRes.json();
        (dealData.results ?? []).forEach((d: Record<string, unknown>) => {
          const props = d.properties as Record<string, string | null>;
          const src = props.hs_object_source_detail_1 || props.hs_object_source_label || "Autre";
          dealSourceDetail[src] = (dealSourceDetail[src] || 0) + 1;
        });
      }
    } catch {
      // Silently fail — page still renders with DB data
    }
  }

  // DB counts
  const [
    { count: totalContacts },
    { count: totalCompanies },
    { count: totalDeals },
    { data: syncLogs },
    { data: integrations },
  ] = await Promise.all([
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("companies").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("sync_logs").select("*").eq("organization_id", orgId).order("started_at", { ascending: false }).limit(5),
    supabase.from("integrations").select("provider, is_active").eq("organization_id", orgId),
  ]);

  const activeIntegrations = (integrations ?? []).filter((i) => i.is_active);
  const sortedContactSources = Object.entries(contactSourceDetail).sort((a, b) => b[1] - a[1]);
  const sortedDealSources = Object.entries(dealSourceDetail).sort((a, b) => b[1] - a[1]);
  const sortedTeams = Object.entries(teamDistribution).sort((a, b) => b[1] - a[1]);
  const totalSourceContacts = sortedContactSources.reduce((s, [, v]) => s + v, 0);
  const totalSourceDeals = sortedDealSources.reduce((s, [, v]) => s + v, 0);

  const integrationScore = hubspotTokenConfigured
    ? Math.round(
        (activeIntegrations.length > 0 ? 40 : 0) +
        (owners.length > 10 ? 30 : owners.length > 5 ? 20 : 10) +
        (sortedContactSources.length > 1 ? 30 : sortedContactSources.length === 1 ? 15 : 0)
      )
    : 0;

  return (
    <section className="space-y-8">
      <Suspense><HubSpotSyncOrchestrator /></Suspense>

      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Intégration</h1>
        <p className="mt-1 text-sm text-slate-500">Connexions CRM, utilisateurs et sources d&apos;acquisition.</p>
      </header>

      <div className="card flex flex-col items-center gap-6 p-6 md:flex-row">
        <ProgressScore label="Score Intégration" score={integrationScore} colorClass="stroke-violet-500" />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-slate-900">{integrationScore}</span>
            <span className="text-sm text-slate-400">/100</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getScoreLabel(integrationScore).className}`}>
              {getScoreLabel(integrationScore).label}
            </span>
          </div>
        </div>
      </div>

      {/* Sync button */}
      {hubspotTokenConfigured && (
        <Link href="/dashboard/integration?sync=true"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
          Synchroniser maintenant
        </Link>
      )}

      {/* Vue d'ensemble */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Intégrations actives</p>
          <p className="mt-1 text-3xl font-bold text-emerald-600">{activeIntegrations.length}</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Utilisateurs CRM</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{owners.length}</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Équipes</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{Object.keys(teamDistribution).filter((k) => k !== "Sans équipe").length}</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Données synchronisées</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{((totalContacts ?? 0) + (totalCompanies ?? 0) + (totalDeals ?? 0)).toLocaleString("fr-FR")}</p>
        </article>
      </div>

      {/* Utilisateurs par équipe */}
      {sortedTeams.length > 0 && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-violet-500" />Utilisateurs par équipe
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {sortedTeams.map(([team, count]) => (
              <article key={team} className="card p-4">
                <p className="text-sm font-medium text-slate-800">{team}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{count}</p>
                <p className="text-xs text-slate-400">utilisateur{count > 1 ? "s" : ""}</p>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* Sources d'acquisition des contacts */}
      {sortedContactSources.length > 0 && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-blue-500" />Sources d&apos;acquisition des contacts
            <span className="text-sm font-normal text-slate-400">(échantillon de {totalSourceContacts})</span>
          </h2>
          <div className="card overflow-hidden">
            <div className="divide-y divide-card-border">
              {sortedContactSources.map(([source, count]) => {
                const pct = totalSourceContacts > 0 ? Math.round((count / totalSourceContacts) * 100) : 0;
                return (
                  <div key={source} className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-800">{source}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{count}</span>
                        <span className="text-xs text-slate-400">{pct}%</span>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Sources d'acquisition des deals */}
      {sortedDealSources.length > 0 && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />Sources de création des transactions
            <span className="text-sm font-normal text-slate-400">(échantillon de {totalSourceDeals})</span>
          </h2>
          <div className="card overflow-hidden">
            <div className="divide-y divide-card-border">
              {sortedDealSources.map(([source, count]) => {
                const pct = totalSourceDeals > 0 ? Math.round((count / totalSourceDeals) * 100) : 0;
                return (
                  <div key={source} className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-800">{source}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{count}</span>
                        <span className="text-xs text-slate-400">{pct}%</span>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Utilisateurs CRM */}
      {owners.length > 0 && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />Utilisateurs du portail
            <span className="text-sm font-normal text-slate-400">({owners.length})</span>
          </h2>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                  <th className="px-5 py-2">Utilisateur</th>
                  <th className="px-5 py-2">Email</th>
                  <th className="px-5 py-2">Équipes</th>
                </tr>
              </thead>
              <tbody>
                {owners.slice(0, 15).map((o) => (
                  <tr key={o.email} className="border-b border-card-border last:border-0">
                    <td className="px-5 py-2.5 font-medium text-slate-800">
                      {o.firstName} {o.lastName}
                    </td>
                    <td className="px-5 py-2.5 text-slate-500">{o.email}</td>
                    <td className="px-5 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {o.teams.length > 0 ? o.teams.map((t) => (
                          <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{t}</span>
                        )) : (
                          <span className="text-xs text-slate-400">Sans équipe</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {owners.length > 15 && (
              <div className="border-t border-card-border px-5 py-2 text-center">
                <a href={`https://app.hubspot.com/settings/${HUBSPOT_PORTAL}/users`} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">
                  Voir les {owners.length} utilisateurs dans HubSpot
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sync logs */}
      {syncLogs && syncLogs.length > 0 && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-slate-400" />Dernières synchronisations
          </h2>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                  <th className="px-5 py-2">Type</th>
                  <th className="px-5 py-2">Statut</th>
                  <th className="px-5 py-2">Entités</th>
                  <th className="px-5 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {syncLogs.map((log) => (
                  <tr key={log.id} className="border-b border-card-border last:border-0">
                    <td className="px-5 py-2.5 font-medium capitalize text-slate-800">{log.entity_type || log.source}</td>
                    <td className="px-5 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        log.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                        log.status === "failed" || log.status === "partial" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {log.status === "completed" ? "Terminé" : log.status === "failed" ? "Erreur" : log.status}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-slate-600">{log.entity_count}</td>
                    <td className="px-5 py-2.5 text-slate-500">{new Date(log.started_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!hubspotTokenConfigured && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">Aucune intégration configurée. Ajoutez votre token HubSpot dans les variables d&apos;environnement.</p>
        </div>
      )}
    </section>
  );
}
