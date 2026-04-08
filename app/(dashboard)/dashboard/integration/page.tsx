import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";
import { getScoreLabel, getBarColor } from "@/lib/score-utils";
import { HubSpotSyncOrchestrator } from "@/components/hubspot-sync-orchestrator";
import { Suspense } from "react";
import Link from "next/link";

const HUBSPOT_PORTAL = "48372600";
const HS = {
  workflows: `https://app.hubspot.com/workflows/${HUBSPOT_PORTAL}`,
};

export default async function IntegrationPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const hubspotTokenConfigured = !!process.env.HUBSPOT_ACCESS_TOKEN;

  // Fetch live data from HubSpot API
  let owners: Array<{ email: string; firstName: string; lastName: string; teams: string[] }> = [];
  let teamDistribution: Record<string, number> = {};
  let contactSourcesGlobal: Array<{ source: string; count: number }> = [];
  let dealsPerOwner: Record<string, number> = {};

  // Helper to count records by source via Search API
  async function countBySource(object: "contacts", source: string): Promise<number> {
    const res = await fetch(`https://api.hubapi.com/crm/v3/objects/${object}/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: "hs_object_source", operator: "EQ", value: source }] }],
        limit: 1,
      }),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.total ?? 0;
  }

  // Mapping for human-readable source names
  const sourceLabels: Record<string, string> = {
    INTEGRATION: "Intégration native (Outlook, Gmail, etc.)",
    EMAIL_INTEGRATION: "Intégration Email (Gmail/Outlook)",
    IMPORT: "Import de fichier (CSV/Excel)",
    CRM_UI: "Création manuelle CRM",
    FORM: "Formulaires HubSpot",
    API: "API HubSpot",
    MOBILE_IOS: "Application mobile iOS",
    MOBILE_ANDROID: "Application mobile Android",
    INTERNAL_PROCESSING: "Traitement interne HubSpot",
    CRM_SETTING: "Paramètres CRM (auto-association)",
    MARKETING_EMAIL: "Email marketing",
    WORKFLOW: "Workflow HubSpot",
    BATCH_UPDATE: "Mise à jour par batch",
    CONTACTS_WEB: "Site web (tracking HubSpot)",
  };

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

      // Get TOTAL contacts count per source via Search API
      const sourcesToCheck = ["INTEGRATION", "EMAIL_INTEGRATION", "IMPORT", "CRM_UI", "FORM", "API", "MOBILE_IOS", "MOBILE_ANDROID", "INTERNAL_PROCESSING", "CRM_SETTING", "MARKETING_EMAIL", "WORKFLOW", "BATCH_UPDATE", "CONTACTS_WEB"];

      const contactCounts = await Promise.all(
        sourcesToCheck.map(async (src) => ({ source: src, count: await countBySource("contacts", src) })),
      );
      contactSourcesGlobal = contactCounts.filter((c) => c.count > 0).sort((a, b) => b.count - a.count);

      // Deal owner assignment (sample 100)
      const dealRes = await fetch(
        `https://api.hubapi.com/crm/v3/objects/deals?limit=100&properties=hubspot_owner_id`,
        { headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` } },
      );
      if (dealRes.ok) {
        const dealData = await dealRes.json();
        (dealData.results ?? []).forEach((d: Record<string, unknown>) => {
          const ownerId = (d.properties as Record<string, string | null>).hubspot_owner_id;
          dealsPerOwner[ownerId || "(non assigné)"] = (dealsPerOwner[ownerId || "(non assigné)"] || 0) + 1;
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
  const sortedTeams = Object.entries(teamDistribution).sort((a, b) => b[1] - a[1]);
  const totalSourceContacts = contactSourcesGlobal.reduce((s, c) => s + c.count, 0);

  // Native integrations: INTEGRATION, EMAIL_INTEGRATION, FORM, MARKETING_EMAIL, WORKFLOW, CONTACTS_WEB
  const nativeKeys = ["INTEGRATION", "EMAIL_INTEGRATION", "FORM", "MARKETING_EMAIL", "WORKFLOW", "CONTACTS_WEB"];
  const nativeIntegrations = contactSourcesGlobal.filter((s) => nativeKeys.includes(s.source));
  const totalNative = nativeIntegrations.reduce((s, i) => s + i.count, 0);
  const nativeShare = totalSourceContacts > 0 ? Math.round((totalNative / totalSourceContacts) * 100) : 0;

  const integrationScore = hubspotTokenConfigured
    ? Math.round(
        Math.min(50, nativeShare * 0.5) +
        (owners.length > 10 ? 25 : owners.length > 5 ? 15 : 5) +
        (nativeIntegrations.length > 1 ? 25 : nativeIntegrations.length === 1 ? 15 : 0)
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
        <ProgressScore label="Score Intégration" score={integrationScore} />
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
