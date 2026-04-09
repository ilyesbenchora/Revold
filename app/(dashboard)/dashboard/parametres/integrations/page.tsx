import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { ParametresTabs } from "@/components/parametres-tabs";
import { CONNECTABLE_TOOLS, getCategoryLabel } from "@/lib/integrations/connect-catalog";
import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";

export default async function ParametresIntegrationsPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;

  const supabase = await createSupabaseServerClient();
  const [{ data: integrations }, { data: syncLogs }] = await Promise.all([
    supabase.from("integrations").select("*").eq("organization_id", orgId).order("updated_at", { ascending: false }),
    supabase.from("sync_logs").select("*").eq("organization_id", orgId).order("started_at", { ascending: false }).limit(10),
  ]);

  const connected = (integrations ?? []).filter((i) => i.is_active);
  const inactive = (integrations ?? []).filter((i) => !i.is_active);
  const logs = syncLogs ?? [];

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500">Gestion des intégrations connectées à Revold et historique de synchronisation.</p>
      </header>

      <ParametresTabs />

      {/* HubSpot */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-orange-500" />HubSpot (CRM principal)
        </h2>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#FF7A59"><path d="M18.164 7.93V5.084a2.198 2.198 0 0 0 1.267-1.978v-.067A2.2 2.2 0 0 0 17.238.845h-.067a2.2 2.2 0 0 0-2.193 2.194v.067a2.198 2.198 0 0 0 1.267 1.978V7.93a6.215 6.215 0 0 0-2.952 1.3L5.51 3.146a2.476 2.476 0 1 0-1.16 1.578l7.658 5.96a6.235 6.235 0 0 0 .094 7.027l-2.33 2.33a2.013 2.013 0 0 0-.581-.093 2.04 2.04 0 1 0 2.04 2.04 2.013 2.013 0 0 0-.094-.581l2.305-2.305a6.247 6.247 0 1 0 4.722-11.173zm-1.106 9.371a3.205 3.205 0 1 1 3.205-3.205 3.208 3.208 0 0 1-3.205 3.205z"/></svg>
              <div>
                <p className="text-sm font-semibold text-slate-900">HubSpot</p>
                <p className="text-xs text-slate-500">Private App Token</p>
              </div>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${process.env.HUBSPOT_ACCESS_TOKEN ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {process.env.HUBSPOT_ACCESS_TOKEN ? "✓ Connecté" : "Non configuré"}
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Le token HubSpot est configuré via la variable d&apos;environnement <code className="rounded bg-slate-100 px-1 py-0.5">HUBSPOT_ACCESS_TOKEN</code> sur Vercel.
            Pour le changer, allez dans Vercel → Settings → Environment Variables.
          </p>
        </div>
      </div>

      {/* Outils connectés à Revold */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />Outils connectés à Revold
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{connected.length}</span>
        </h2>
        {connected.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-slate-500">Aucun outil connecté directement à Revold.</p>
            <Link href="/dashboard/integration" className="mt-3 inline-flex text-sm font-medium text-accent hover:underline">
              Connecter un outil →
            </Link>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                  <th className="px-5 py-2">Outil</th>
                  <th className="px-5 py-2">Catégorie</th>
                  <th className="px-5 py-2">Statut</th>
                  <th className="px-5 py-2">Dernière sync</th>
                  <th className="px-5 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {connected.map((int) => {
                  const tool = CONNECTABLE_TOOLS[int.provider];
                  return (
                    <tr key={int.id} className="border-b border-card-border last:border-0">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          {tool && <BrandLogo domain={tool.domain} alt={tool.label} fallback={tool.icon} size={24} />}
                          <span className="font-medium text-slate-800">{tool?.label ?? int.provider}</span>
                        </div>
                      </td>
                      <td className="px-5 py-2.5 text-slate-500">
                        {tool ? getCategoryLabel(tool.category) : "—"}
                      </td>
                      <td className="px-5 py-2.5">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Actif</span>
                      </td>
                      <td className="px-5 py-2.5 text-slate-500">
                        {int.updated_at ? new Date(int.updated_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="px-5 py-2.5">
                        <Link href={`/dashboard/integration/connect/${int.provider}`} className="text-xs font-medium text-accent hover:underline">
                          Reconfigurer
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historique de synchronisation */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-slate-400" />Historique de synchronisation
        </h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <th className="px-5 py-2">Source</th>
                <th className="px-5 py-2">Direction</th>
                <th className="px-5 py-2">Statut</th>
                <th className="px-5 py-2">Entités</th>
                <th className="px-5 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-4 text-center text-slate-400">Aucune synchronisation enregistrée.</td></tr>
              ) : logs.map((log) => (
                <tr key={log.id} className="border-b border-card-border last:border-0">
                  <td className="px-5 py-2.5 font-medium capitalize text-slate-800">{log.source}</td>
                  <td className="px-5 py-2.5 text-slate-500">{log.direction === "inbound" ? "← Import" : "→ Export"}</td>
                  <td className="px-5 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      log.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                      log.status === "failed" ? "bg-red-50 text-red-700" :
                      "bg-amber-50 text-amber-700"
                    }`}>{log.status === "completed" ? "Terminé" : log.status === "failed" ? "Erreur" : log.status}</span>
                  </td>
                  <td className="px-5 py-2.5 text-slate-600">{log.entity_count}</td>
                  <td className="px-5 py-2.5 text-slate-500">
                    {log.started_at ? new Date(log.started_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inactive integrations */}
      {inactive.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-slate-300" />Intégrations inactives
          </h2>
          <div className="card overflow-hidden">
            <div className="divide-y divide-card-border">
              {inactive.map((int) => {
                const tool = CONNECTABLE_TOOLS[int.provider];
                return (
                  <div key={int.id} className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-slate-500">{tool?.label ?? int.provider}</span>
                    <Link href={`/dashboard/integration/connect/${int.provider}`} className="text-xs font-medium text-accent hover:underline">
                      Reconnecter
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
