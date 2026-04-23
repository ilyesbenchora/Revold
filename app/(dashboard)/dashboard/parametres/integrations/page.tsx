import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { ParametresTabs } from "@/components/parametres-tabs";
import { CONNECTABLE_TOOLS, getCategoryLabel } from "@/lib/integrations/connect-catalog";
import { BrandLogo } from "@/components/brand-logo";
import { HubspotDisconnectButton } from "@/components/hubspot-disconnect-button";
import { SyncBlocksStatus } from "@/components/sync-blocks-status";
import { SyncParityBlock, type ParityRow } from "@/components/sync-parity-block";
import { ToolMappingSettings } from "@/components/tool-mapping-settings";
import {
  listConnectedTools,
  getToolKeysBatch,
} from "@/lib/integrations/tool-mappings";
import Link from "next/link";

const ALL_PAGE_KEYS = [
  "audit_donnees",
  "audit_automatisations",
  "audit_perf_ventes",
  "audit_perf_marketing",
  "audit_paiement_facturation",
  "audit_service_client",
  "audit_adoption",
  "dashboard",
  "simulation_ia",
  "coaching_ia",
];

// Toujours rendre fraîchement : l'état OAuth HubSpot change en temps réel
// après connect/disconnect, on ne veut surtout pas afficher un état mis en cache.
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<{ hs_connected?: string; hs_error?: string }>;

export default async function ParametresIntegrationsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;

  const supabase = await createSupabaseServerClient();
  const [{ data: integrations }, snapshot, mappingOptions, mappingValues, { data: parityRows }] = await Promise.all([
    supabase.from("integrations").select("*").eq("organization_id", orgId).order("updated_at", { ascending: false }),
    getHubspotSnapshot(),
    listConnectedTools(supabase, orgId),
    getToolKeysBatch(supabase, orgId, ALL_PAGE_KEYS),
    supabase
      .from("hubspot_sync_state")
      .select("object_type, records_in_supabase, records_in_hubspot, parity_drift, parity_status, last_full_sync_at, last_delta_sync_at, last_error")
      .eq("organization_id", orgId),
  ]);

  const parity: ParityRow[] = (parityRows ?? []) as ParityRow[];

  const connected = (integrations ?? []).filter((i) => i.is_active);
  const inactive = (integrations ?? []).filter((i) => !i.is_active);

  // État HubSpot : OAuth réel (refresh_token + portal_id) > env var (legacy) > non configuré.
  // Une ligne avec is_active=true mais sans refresh_token/portal_id est un seed/legacy
  // qu'on ignore pour la détection — sinon faux positif "Connecté (OAuth)".
  const hsRow = (integrations ?? []).find(
    (i) => i.provider === "hubspot" && i.is_active && i.refresh_token && i.portal_id,
  );
  type HsMeta = {
    hub_domain?: string;
    scopes?: string[];
    connected_at?: string;
    custom_objects?: Array<{ objectTypeId: string; name: string; labelSingular: string; labelPlural: string; propertyCount: number; createdAt: string | null }>;
    custom_objects_count?: number;
  };
  const hsMeta = (hsRow?.metadata as HsMeta | null) ?? null;
  // Fallback env var supprimé en Phase 8.1c (faille multi-tenant) — toujours false
  const hasEnvFallback = false;
  const hsState: "oauth" | "env" | "none" = hsRow ? "oauth" : hasEnvFallback ? "env" : "none";

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500">Gestion des intégrations connectées à Revold et état de synchronisation par bloc.</p>
      </header>

      <ParametresTabs />

      {/* Banners post-OAuth */}
      {params.hs_connected && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ HubSpot connecté avec succès — portail <strong>{params.hs_connected}</strong>.
        </div>
      )}
      {params.hs_error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Erreur HubSpot : {params.hs_error}
        </div>
      )}

      {/* HubSpot */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-orange-500" />HubSpot (CRM principal)
        </h2>
        <div className="card p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#FF7A59"><path d="M18.164 7.93V5.084a2.198 2.198 0 0 0 1.267-1.978v-.067A2.2 2.2 0 0 0 17.238.845h-.067a2.2 2.2 0 0 0-2.193 2.194v.067a2.198 2.198 0 0 0 1.267 1.978V7.93a6.215 6.215 0 0 0-2.952 1.3L5.51 3.146a2.476 2.476 0 1 0-1.16 1.578l7.658 5.96a6.235 6.235 0 0 0 .094 7.027l-2.33 2.33a2.013 2.013 0 0 0-.581-.093 2.04 2.04 0 1 0 2.04 2.04 2.013 2.013 0 0 0-.094-.581l2.305-2.305a6.247 6.247 0 1 0 4.722-11.173zm-1.106 9.371a3.205 3.205 0 1 1 3.205-3.205 3.208 3.208 0 0 1-3.205 3.205z"/></svg>
              <div>
                <p className="text-sm font-semibold text-slate-900">HubSpot</p>
                <p className="text-xs text-slate-500">
                  {hsState === "oauth"
                    ? `OAuth — ${hsMeta?.hub_domain ?? "portail connecté"}`
                    : hsState === "env"
                      ? "Private App Token (env var)"
                      : "Non connecté"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                hsState === "oauth" ? "bg-emerald-100 text-emerald-700"
                : hsState === "env" ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-500"
              }`}>
                {hsState === "oauth" ? "✓ Connecté (OAuth)"
                  : hsState === "env" ? "⚠ env var (legacy)"
                  : "Non configuré"}
              </span>
              {hsState === "oauth" ? (
                <HubspotDisconnectButton />
              ) : (
                <a
                  href="/api/integrations/hubspot/connect"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-orange-600"
                >
                  Connecter HubSpot
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </a>
              )}
            </div>
          </div>

          {hsState === "oauth" && hsMeta && (
            <>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4 text-xs">
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="font-medium text-slate-500">Portal ID</p>
                  <p className="mt-0.5 font-semibold text-slate-800">{hsRow?.portal_id ?? "—"}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="font-medium text-slate-500">Scopes accordés</p>
                  <p className="mt-0.5 font-semibold text-slate-800">{(hsMeta.scopes ?? []).length}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="font-medium text-slate-500">Custom objects</p>
                  <p className="mt-0.5 font-semibold text-slate-800">{snapshot.customObjectsCount}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="font-medium text-slate-500">Connecté le</p>
                  <p className="mt-0.5 font-semibold text-slate-800">
                    {hsMeta.connected_at ? new Date(hsMeta.connected_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </p>
                </div>
              </div>

              {/* Données HubSpot live accessibles via OAuth */}
              <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Données HubSpot live accessibles
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 text-xs">
                  <div><p className="text-slate-500">Contacts</p><p className="font-bold text-slate-900">{snapshot.totalContacts.toLocaleString("fr-FR")}</p></div>
                  <div><p className="text-slate-500">Companies</p><p className="font-bold text-slate-900">{snapshot.totalCompanies.toLocaleString("fr-FR")}</p></div>
                  <div><p className="text-slate-500">Deals</p><p className="font-bold text-slate-900">{snapshot.totalDeals.toLocaleString("fr-FR")}</p></div>
                  <div><p className="text-slate-500">Owners</p><p className="font-bold text-slate-900">{snapshot.ownersCount}</p></div>
                  <div><p className="text-slate-500">Pipelines</p><p className="font-bold text-slate-900">{snapshot.pipelines.length}</p></div>
                  <div><p className="text-slate-500">Workflows</p><p className="font-bold text-slate-900">{snapshot.workflowsActiveCount}/{snapshot.workflowsCount}</p></div>
                  <div><p className="text-slate-500">Tickets</p><p className="font-bold text-slate-900">{snapshot.totalTickets.toLocaleString("fr-FR")}</p></div>
                  <div><p className="text-slate-500">Invoices</p><p className="font-bold text-slate-900">{snapshot.totalInvoices.toLocaleString("fr-FR")}</p></div>
                  <div><p className="text-slate-500">Subscriptions</p><p className="font-bold text-slate-900">{snapshot.activeSubscriptions}/{snapshot.totalSubscriptions}</p></div>
                  <div><p className="text-slate-500">Quotes</p><p className="font-bold text-slate-900">{snapshot.totalQuotes}</p></div>
                  <div><p className="text-slate-500">Forms</p><p className="font-bold text-slate-900">{snapshot.formsCount}</p></div>
                  <div><p className="text-slate-500">Lists</p><p className="font-bold text-slate-900">{snapshot.listsCount}</p></div>
                  <div><p className="text-slate-500">Leads</p><p className="font-bold text-slate-900">{snapshot.leadsObjectCount}</p></div>
                  <div><p className="text-slate-500">Goals</p><p className="font-bold text-slate-900">{snapshot.goalsCount}</p></div>
                  <div><p className="text-slate-500">Campaigns</p><p className="font-bold text-slate-900">{snapshot.marketingCampaignsCount}</p></div>
                  <div><p className="text-slate-500">Events</p><p className="font-bold text-slate-900">{snapshot.marketingEventsCount}</p></div>
                  <div><p className="text-slate-500">Teams</p><p className="font-bold text-slate-900">{snapshot.teamsCount}</p></div>
                  <div><p className="text-slate-500">Custom obj</p><p className="font-bold text-slate-900">{snapshot.customObjectsCount}</p></div>
                </div>
                <p className="mt-3 text-[10px] italic text-slate-500">
                  Counts récupérés en live via les scopes OAuth accordés. Si un objet est à 0 alors que vous en avez dans HubSpot, le scope correspondant n'est probablement pas activé dans l'app HubSpot.
                </p>
              </div>

              {hsMeta.custom_objects && hsMeta.custom_objects.length > 0 && (
                <div className="mt-4 rounded-lg border border-fuchsia-100 bg-fuchsia-50/40 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-fuchsia-700">
                      ✨ Custom objects détectés ({hsMeta.custom_objects.length})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {hsMeta.custom_objects.map((co) => (
                      <div
                        key={co.objectTypeId}
                        className="flex items-center justify-between gap-3 rounded-md bg-white/70 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">{co.labelPlural}</p>
                          <p className="text-[10px] text-slate-500">
                            <code className="rounded bg-slate-100 px-1">{co.name}</code>
                            <span className="ml-1.5">·</span>
                            <span className="ml-1.5">{co.propertyCount} propriétés</span>
                            <span className="ml-1.5">·</span>
                            <code className="ml-1.5 rounded bg-slate-100 px-1">{co.objectTypeId}</code>
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-fuchsia-100 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-700">
                          custom
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] italic text-slate-500">
                    Revold détecte automatiquement vos custom objects pour les exploiter dans les rapports et le coaching IA.
                  </p>
                </div>
              )}
            </>
          )}

          {hsState === "env" && (
            <p className="mt-3 text-xs text-amber-700">
              ⚠ Token configuré via variable d&apos;environnement (mode legacy mono-tenant).
              Connectez via OAuth pour passer en multi-tenant et activer le refresh automatique.
            </p>
          )}

          {hsState === "none" && (
            <p className="mt-3 text-xs text-slate-500">
              Cliquez « Connecter HubSpot » — vous serez redirigé vers HubSpot pour autoriser l&apos;accès lecture seule à votre CRM.
              Aucune donnée ne sort de votre portail HubSpot vers Revold sans cette autorisation.
            </p>
          )}
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

      {/* Parité HubSpot ↔ Supabase (ETL) */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">
          Parité données HubSpot ↔ Revold
        </h2>
        <p className="text-xs text-slate-500">
          Revold maintient un miroir local de votre portail HubSpot dans Supabase.
          L&apos;UI lit ce miroir (~50 ms, zéro rate limit) ; un sync delta tourne
          toutes les 30 min, et une réconciliation complète chaque dimanche à 3 h.
        </p>
        <SyncParityBlock rows={parity} />
      </div>

      {/* Synchronisation des blocs (vue par page Revold) */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />Synchronisation des blocs
        </h2>
        <SyncBlocksStatus snapshot={snapshot} />
      </div>

      {/* Mapping outil source par page Revold */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-fuchsia-500" />Outil source par page
        </h2>
        <p className="text-xs text-slate-500">
          Pour chaque page Revold, choisissez l&apos;outil (ou les outils, selon le mode)
          que Revold utilisera comme source d&apos;analyse principale. Seuls les outils
          actuellement connectés à Revold sont proposés.
        </p>
        <ToolMappingSettings
          options={mappingOptions}
          initialMappings={mappingValues}
        />
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
