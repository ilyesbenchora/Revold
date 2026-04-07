import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getLatestKpi } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";

function getScoreLabel(score: number) {
  if (score >= 80) return { label: "Excellent", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (score >= 50) return { label: "Moyen", className: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: "Insuffisant", className: "bg-red-50 text-red-700 border-red-200" };
}

function getBarColor(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

type Integration = {
  id: string;
  provider: string;
  is_active: boolean;
  created_at: string;
  portal_id: string | null;
  metadata: Record<string, unknown> | null;
};

type SyncLog = {
  id: string;
  source: string;
  direction: string;
  status: string;
  entity_count: number;
  created_at: string;
  error_message: string | null;
};

export default async function IntegrationPage() {
  const orgId = await getOrgId();
  const supabase = await createSupabaseServerClient();
  const latestKpi = await getLatestKpi();

  const [integrationsRes, syncLogsRes] = await Promise.all([
    supabase.from("integrations").select("*").eq("organization_id", orgId),
    supabase.from("sync_logs").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(20),
  ]);
  const integrations = integrationsRes.data as Integration[] | null;
  const syncLogs = syncLogsRes.data as SyncLog[] | null;

  const crmScore = Number(latestKpi?.crm_ops_score) || 0;
  const dataCompleteness = Number(latestKpi?.data_completeness) || 0;

  const activeIntegrations = (integrations ?? []).filter((i) => i.is_active);
  const totalIntegrations = integrations?.length ?? 0;

  // Calculate integration health score
  const successfulSyncs = (syncLogs ?? []).filter((l) => l.status === "success" || l.status === "completed").length;
  const totalSyncs = syncLogs?.length ?? 0;
  const syncSuccessRate = totalSyncs > 0 ? Math.round((successfulSyncs / totalSyncs) * 100) : 0;

  const integrationScore = totalIntegrations > 0
    ? Math.round((dataCompleteness * 0.4) + (syncSuccessRate * 0.3) + ((activeIntegrations.length / Math.max(1, totalIntegrations)) * 100 * 0.3))
    : 0;

  // HubSpot OAuth URL
  const hubspotClientId = process.env.HUBSPOT_CLIENT_ID ?? "";
  const hubspotRedirectUri = process.env.HUBSPOT_REDIRECT_URI ?? "";
  const hubspotScopes = "crm.objects.deals.read crm.objects.contacts.read crm.objects.companies.read crm.objects.owners.read";
  const hubspotAuthUrl = hubspotClientId
    ? `https://app.hubspot.com/oauth/authorize?client_id=${hubspotClientId}&redirect_uri=${encodeURIComponent(hubspotRedirectUri)}&scope=${encodeURIComponent(hubspotScopes)}&state=${orgId ?? ""}`
    : "";

  // Known CRM tools
  const crmTools = [
    {
      name: "HubSpot",
      provider: "hubspot",
      description: "CRM, Marketing Hub, Sales Hub",
      icon: "🟠",
      authUrl: hubspotAuthUrl,
    },
    {
      name: "Salesforce",
      provider: "salesforce",
      description: "CRM, Sales Cloud",
      icon: "☁️",
      authUrl: "",
    },
  ];

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Intégration</h1>
        <p className="mt-1 text-sm text-slate-500">
          Outils intégrés au CRM, utilisation et complétude des données.
        </p>
      </header>

      {/* Score */}
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
          <p className="mt-2 text-sm text-slate-500">
            Santé des intégrations : connectivité, fiabilité des syncs et complétude des données.
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Outils connectés</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{activeIntegrations.length}</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Complétude CRM</p>
          <p className={`mt-1 text-3xl font-bold ${
            dataCompleteness >= 80 ? "text-emerald-600" :
            dataCompleteness >= 50 ? "text-amber-500" : "text-red-500"
          }`}>{dataCompleteness}%</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Taux de sync</p>
          <p className={`mt-1 text-3xl font-bold ${
            syncSuccessRate >= 80 ? "text-emerald-600" :
            syncSuccessRate >= 50 ? "text-amber-500" : "text-red-500"
          }`}>{syncSuccessRate}%</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Score CRM Ops</p>
          <p className={`mt-1 text-3xl font-bold ${
            crmScore >= 80 ? "text-emerald-600" :
            crmScore >= 50 ? "text-amber-500" : "text-red-500"
          }`}>{crmScore}</p>
        </article>
      </div>

      {/* CRM Tools */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-violet-500" />
          Outils CRM
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {crmTools.map((tool) => {
            const integration = (integrations ?? []).find((i) => i.provider === tool.provider);
            const isConnected = integration?.is_active ?? false;
            const toolSyncs = (syncLogs ?? []).filter((l) => l.source === tool.provider);
            const lastSync = toolSyncs[0];
            const toolSuccessRate = toolSyncs.length > 0
              ? Math.round(toolSyncs.filter((l) => l.status === "success" || l.status === "completed").length / toolSyncs.length * 100)
              : 0;

            return (
              <article key={tool.provider} className="card p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{tool.icon}</span>
                    <div>
                      <h3 className="font-semibold text-slate-900">{tool.name}</h3>
                      <p className="text-xs text-slate-400">{tool.description}</p>
                    </div>
                  </div>
                  {isConnected ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      Connecté
                    </span>
                  ) : tool.authUrl ? (
                    <a
                      href={tool.authUrl}
                      className="inline-block rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition"
                    >
                      Connecter
                    </a>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                      Bientôt
                    </span>
                  )}
                </div>

                {isConnected && (
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-400">Fiabilité sync</p>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                            <div
                              className={`h-1.5 rounded-full ${getBarColor(toolSuccessRate)}`}
                              style={{ width: `${toolSuccessRate}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-slate-600">{toolSuccessRate}%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Dernière sync</p>
                        <p className="mt-1 text-sm font-medium text-slate-700">
                          {lastSync
                            ? new Date(lastSync.created_at).toLocaleDateString("fr-FR", {
                                day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                              })
                            : "—"}
                        </p>
                      </div>
                    </div>
                    {lastSync && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          lastSync.status === "success" || lastSync.status === "completed"
                            ? "bg-emerald-500"
                            : lastSync.status === "error"
                            ? "bg-red-500"
                            : "bg-amber-500"
                        }`} />
                        <span className="text-slate-500">
                          {lastSync.entity_count} entités synchronisées
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {!isConnected && (
                  <p className="mt-4 text-xs text-slate-400">
                    Connectez {tool.name} dans les paramètres pour activer la synchronisation.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </div>

      {/* Sync History */}
      {syncLogs && syncLogs.length > 0 && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Historique des synchronisations
          </h2>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Entités</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {syncLogs.slice(0, 10).map((log) => (
                  <tr key={log.id} className="border-b border-card-border last:border-0">
                    <td className="px-4 py-3 font-medium capitalize text-slate-800">{log.source}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        log.status === "success" || log.status === "completed"
                          ? "bg-emerald-50 text-emerald-700"
                          : log.status === "error"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-700"
                      }`}>
                        {log.status === "success" || log.status === "completed" ? "Terminé" :
                         log.status === "error" ? "Erreur" : "En cours"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{log.entity_count}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(log.created_at).toLocaleDateString("fr-FR", {
                        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalIntegrations === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">
            Aucune intégration configurée. Connectez votre CRM dans les paramètres pour commencer.
          </p>
        </div>
      )}
    </section>
  );
}
