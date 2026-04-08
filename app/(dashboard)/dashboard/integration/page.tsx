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
  let trackingSample = 0;
  let onlineContacts = 0;
  let offlineContacts = 0;
  let withPageViews = 0;
  let withSessions = 0;
  let withFormSubmissions = 0;
  let withMarketingEmails = 0;

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

      // Contact tracking data (sample 100)
      const trackingRes = await fetch(
        `https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=hs_analytics_source,hs_analytics_num_page_views,hs_analytics_num_visits,num_conversion_events,hs_email_first_send_date`,
        { headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` } },
      );
      if (trackingRes.ok) {
        const trackingData = await trackingRes.json();
        (trackingData.results ?? []).forEach((c: Record<string, unknown>) => {
          const p = c.properties as Record<string, string | null>;
          trackingSample++;
          const src = p.hs_analytics_source || "";
          if (["ORGANIC_SEARCH", "PAID_SEARCH", "PAID_SOCIAL", "SOCIAL_MEDIA", "EMAIL_MARKETING", "REFERRALS", "DIRECT_TRAFFIC"].includes(src)) onlineContacts++;
          else offlineContacts++;
          if (Number(p.hs_analytics_num_page_views) > 0) withPageViews++;
          if (Number(p.hs_analytics_num_visits) > 0) withSessions++;
          if (Number(p.num_conversion_events) > 0) withFormSubmissions++;
          if (p.hs_email_first_send_date) withMarketingEmails++;
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

      {/* Tracking et adoption digitale */}
      {trackingSample > 0 && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-orange-500" />Adoption digitale
            <span className="text-sm font-normal text-slate-400">(échantillon de {trackingSample} contacts)</span>
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <article className="card p-4 text-center">
              <p className="text-xs text-slate-500">Source online</p>
              <p className={`mt-1 text-2xl font-bold ${onlineContacts > 0 ? "text-emerald-600" : "text-red-500"}`}>{onlineContacts}</p>
            </article>
            <article className="card p-4 text-center">
              <p className="text-xs text-slate-500">Source offline</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{offlineContacts}</p>
            </article>
            <article className="card p-4 text-center">
              <p className="text-xs text-slate-500">Pages vues</p>
              <p className={`mt-1 text-2xl font-bold ${withPageViews > 0 ? "text-slate-900" : "text-red-500"}`}>{withPageViews}</p>
            </article>
            <article className="card p-4 text-center">
              <p className="text-xs text-slate-500">Sessions web</p>
              <p className={`mt-1 text-2xl font-bold ${withSessions > 0 ? "text-slate-900" : "text-red-500"}`}>{withSessions}</p>
            </article>
            <article className="card p-4 text-center">
              <p className="text-xs text-slate-500">Soumissions formulaire</p>
              <p className={`mt-1 text-2xl font-bold ${withFormSubmissions > 0 ? "text-slate-900" : "text-red-500"}`}>{withFormSubmissions}</p>
            </article>
            <article className="card p-4 text-center">
              <p className="text-xs text-slate-500">Email marketing reçu</p>
              <p className={`mt-1 text-2xl font-bold ${withMarketingEmails > 0 ? "text-slate-900" : "text-red-500"}`}>{withMarketingEmails}</p>
            </article>
          </div>
        </div>
      )}

      {/* Insights IA Intégration */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
            <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
            <path d="M10 21v1a2 2 0 0 0 4 0v-1" />
          </svg>
          Insights IA Intégration
        </h2>
        <div className="space-y-3">

          {/* Tracking online */}
          {trackingSample > 0 && onlineContacts === 0 && (
            <article className="rounded-xl border border-red-200 bg-red-50 p-5">
              <div className="flex items-center gap-2">
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">Critique</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">Tracking</span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-900">Aucun contact tracké en ligne</h3>
              <p className="mt-1.5 text-sm text-slate-700">
                100% des contacts proviennent de sources offline. Le tracking HubSpot (script de suivi, formulaires, landing pages) n&apos;est pas actif ou pas installé sur votre site web.
              </p>
              <div className="mt-3 rounded-lg bg-white/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommandation</p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  Installer le code de suivi HubSpot sur votre site, activer les formulaires HubSpot et connecter vos landing pages pour commencer à tracker les sources online (SEO, Ads, Social, Email).
                </p>
              </div>
              <div className="mt-3">
                <a href={`https://app.hubspot.com/settings/${HUBSPOT_PORTAL}/website/tracking-code`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500">
                  Installer le tracking HubSpot
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </div>
            </article>
          )}

          {/* Deals non assignés */}
          {(dealsPerOwner["(non assigné)"] ?? 0) > 0 && (
            <article className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center gap-2">
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">Attention</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">Attribution</span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-900">
                {dealsPerOwner["(non assigné)"]}% des transactions sans propriétaire
              </h3>
              <p className="mt-1.5 text-sm text-slate-700">
                {dealsPerOwner["(non assigné)"]} transactions sur 100 ne sont assignées à aucun commercial. Impossible de mesurer la performance individuelle et de piloter l&apos;équipe.
              </p>
              <div className="mt-3 rounded-lg bg-white/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommandation</p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  Mettre en place un workflow d&apos;attribution automatique des deals ou rendre le champ propriétaire obligatoire à la création.
                </p>
              </div>
              <div className="mt-3">
                <a href={`${HS.workflows}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500">
                  Créer un workflow d&apos;attribution
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </div>
            </article>
          )}

          {/* Utilisateurs inactifs */}
          {(() => {
            const now = Date.now();
            const inactive = owners.filter((o) => {
              // We check teams — owners without teams or with many teams but no deals
              const ownerDeals = Object.entries(dealsPerOwner).find(([k]) => k !== "(non assigné)" && owners.some((ow) => ow.email === o.email));
              return !ownerDeals;
            });
            const activeOwners = owners.length - inactive.length;
            return inactive.length > owners.length * 0.5 ? (
              <article className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">Attention</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">Adoption</span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-slate-900">
                  {owners.length - Object.keys(dealsPerOwner).filter((k) => k !== "(non assigné)").length} utilisateurs sans transaction assignée
                </h3>
                <p className="mt-1.5 text-sm text-slate-700">
                  Sur {owners.length} utilisateurs CRM, seuls {Object.keys(dealsPerOwner).filter((k) => k !== "(non assigné)").length} ont des transactions à leur nom. Les autres n&apos;utilisent pas activement le pipeline.
                </p>
                <div className="mt-3 rounded-lg bg-white/60 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommandation</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    Former les utilisateurs inactifs à la création et au suivi des transactions. Désactiver les comptes non utilisés pour nettoyer le portail.
                  </p>
                </div>
                <div className="mt-3">
                  <a href={`https://app.hubspot.com/settings/${HUBSPOT_PORTAL}/users`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500">
                    Gérer les utilisateurs
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                </div>
              </article>
            ) : null;
          })()}

          {/* Positif si tracking actif */}
          {onlineContacts > 0 && (
            <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-center gap-2">
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">Positif</span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-900">Tracking online actif : {onlineContacts} contacts trackés</h3>
              <p className="mt-1.5 text-sm text-slate-700">
                {Math.round((onlineContacts / trackingSample) * 100)}% des contacts proviennent de sources digitales. Continuez à investir dans les canaux online performants.
              </p>
            </article>
          )}
        </div>
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
