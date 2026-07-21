export const dynamic = "force-dynamic";
export const revalidate = 0;

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getConnectableTool, getCategoryLabel } from "@/lib/integrations/connect-catalog";
import { getConnector } from "@/lib/integrations/sync/registry";
import { BrandLogo } from "@/components/brand-logo";
import { ToolSyncOrchestrator } from "@/components/tool-sync-orchestrator";
import { ResyncToolButton } from "@/components/resync-tool-button";

// Entités synchronisées affichables (compteurs source_links par type).
const ENTITY_LABELS: Array<{ type: string; label: string; icon: string }> = [
  { type: "contact", label: "Contacts", icon: "👤" },
  { type: "company", label: "Entreprises", icon: "🏢" },
  { type: "deal", label: "Deals", icon: "💼" },
  { type: "invoice", label: "Factures clients", icon: "🧾" },
  { type: "supplier_invoice", label: "Factures fournisseurs", icon: "📥" },
  { type: "subscription", label: "Abonnements", icon: "🔁" },
  { type: "ticket", label: "Tickets", icon: "🎫" },
];

export default async function OutilSyncPage({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  const { tool: toolKey } = await params;
  const tool = getConnectableTool(toolKey);
  if (!tool) notFound();

  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;

  const supabase = await createSupabaseServerClient();

  // HubSpot a sa propre gestion détaillée (OAuth, snapshot, mappings).
  if (toolKey === "hubspot") redirect("/dashboard/parametres/integrations");

  const { data: integration } = await supabase
    .from("integrations")
    .select("id, updated_at, created_at")
    .eq("organization_id", orgId)
    .eq("provider", toolKey)
    .eq("is_active", true)
    .maybeSingle();

  // Pas connecté → funnel de connexion de l'outil.
  if (!integration) redirect(`/dashboard/integration/connect/${toolKey}`);

  const hasConnector = Boolean(getConnector(toolKey));

  // Compteurs de données synchronisées (source_links par type d'entité)
  // + 5 dernières synchronisations.
  const [entityCounts, { data: lastSyncs }] = await Promise.all([
    Promise.all(
      ENTITY_LABELS.map(async (e) => {
        const { count } = await supabase
          .from("source_links")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("provider", toolKey)
          .eq("entity_type", e.type);
        return { ...e, count: count ?? 0 };
      }),
    ),
    supabase
      .from("sync_logs")
      .select("entity_type, entity_count, status, error_message, started_at, completed_at")
      .eq("organization_id", orgId)
      .eq("source", toolKey)
      .order("started_at", { ascending: false })
      .limit(5),
  ]);

  const nonEmpty = entityCounts.filter((e) => e.count > 0);
  const lastSync = (lastSyncs ?? [])[0] ?? null;

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      {/* Orchestrateur : détecte ?sync={tool} posé par le CTA et lance la sync */}
      <Suspense><ToolSyncOrchestrator /></Suspense>

      <Link href="/dashboard/integration/mes-outils" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
        Retour à mes outils
      </Link>

      {/* En-tête outil */}
      <div className="card p-6">
        <div className="flex items-start gap-4">
          <BrandLogo domain={tool.domain} alt={tool.label} fallback={tool.icon} size={56} />
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{getCategoryLabel(tool.category)}</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">{tool.label}</h1>
            <p className="mt-1 text-sm text-slate-500">{tool.description}</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">✓ Connecté</span>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {hasConnector ? (
            <ResyncToolButton toolKey={toolKey} />
          ) : (
            <p className="text-xs text-slate-400">Synchronisation manuelle non disponible pour cet outil (données lues en direct).</p>
          )}
          <Link
            href={`/dashboard/integration/connect/${toolKey}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Mettre à jour les identifiants
          </Link>
          <Link
            href="/dashboard/parametres/integrations"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Fréquence & mappings
          </Link>
        </div>
        {lastSync && (
          <p className="mt-3 text-xs text-slate-400">
            Dernière synchronisation :{" "}
            {new Date(lastSync.completed_at ?? lastSync.started_at).toLocaleString("fr-FR")} ·{" "}
            {lastSync.status === "success" ? "✓ réussie" : lastSync.status === "error" ? `✗ échec${lastSync.error_message ? ` — ${lastSync.error_message}` : ""}` : lastSync.status}
          </p>
        )}
      </div>

      {/* Données synchronisées */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900">Données synchronisées</h2>
        {nonEmpty.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Aucune donnée importée pour l&apos;instant.
            {hasConnector ? " Clique sur « Relancer la synchronisation » pour importer." : ""}
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {nonEmpty.map((e) => (
              <div key={e.type} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-xs text-slate-500">{e.icon} {e.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{e.count.toLocaleString("fr-FR")}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historique des synchronisations */}
      {(lastSyncs ?? []).length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-card-border px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Dernières synchronisations</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <th className="px-6 py-2">Date</th>
                <th className="px-6 py-2">Entités</th>
                <th className="px-6 py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {(lastSyncs ?? []).map((s, i) => (
                <tr key={i} className="border-b border-card-border last:border-0">
                  <td className="px-6 py-2.5 text-slate-700">
                    {new Date(s.completed_at ?? s.started_at).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-6 py-2.5 text-slate-500">
                    {s.entity_count > 0 ? `${s.entity_count.toLocaleString("fr-FR")} ${s.entity_type}` : s.entity_type}
                  </td>
                  <td className="px-6 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.status === "success" ? "bg-emerald-50 text-emerald-700" : s.status === "error" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"
                    }`}>
                      {s.status === "success" ? "Réussie" : s.status === "error" ? "Échec" : s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
