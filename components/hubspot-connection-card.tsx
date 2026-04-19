/**
 * Card de connexion HubSpot — partagée entre /parametres/integrations et
 * /dashboard/integration. Source unique de vérité pour l'UI de connect/
 * disconnect HubSpot, avec affichage portal_id, scopes, custom objects.
 */
import { HubspotDisconnectButton } from "@/components/hubspot-disconnect-button";

type HsMeta = {
  hub_domain?: string;
  scopes?: string[];
  connected_at?: string;
  custom_objects?: Array<{
    objectTypeId: string;
    name: string;
    labelSingular: string;
    labelPlural: string;
    propertyCount: number;
    createdAt: string | null;
  }>;
  custom_objects_count?: number;
};

type IntegrationRow = {
  id: string;
  provider: string;
  is_active: boolean | null;
  refresh_token: string | null;
  portal_id: string | null;
  metadata: HsMeta | null;
};

type Props = {
  hsRow: IntegrationRow | null;
  hasEnvFallback: boolean;
};

export function HubspotConnectionCard({ hsRow, hasEnvFallback }: Props) {
  // OAuth réel : présence simultanée de refresh_token + portal_id
  const isOAuth = !!(hsRow?.is_active && hsRow.refresh_token && hsRow.portal_id);
  const hsState: "oauth" | "env" | "none" = isOAuth ? "oauth" : hasEnvFallback ? "env" : "none";
  const hsMeta = hsRow?.metadata ?? null;

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        <span className="h-2 w-2 rounded-full bg-orange-500" />
        HubSpot (CRM principal)
      </h2>
      <div className="card p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#FF7A59">
              <path d="M18.164 7.93V5.084a2.198 2.198 0 0 0 1.267-1.978v-.067A2.2 2.2 0 0 0 17.238.845h-.067a2.2 2.2 0 0 0-2.193 2.194v.067a2.198 2.198 0 0 0 1.267 1.978V7.93a6.215 6.215 0 0 0-2.952 1.3L5.51 3.146a2.476 2.476 0 1 0-1.16 1.578l7.658 5.96a6.235 6.235 0 0 0 .094 7.027l-2.33 2.33a2.013 2.013 0 0 0-.581-.093 2.04 2.04 0 1 0 2.04 2.04 2.013 2.013 0 0 0-.094-.581l2.305-2.305a6.247 6.247 0 1 0 4.722-11.173zm-1.106 9.371a3.205 3.205 0 1 1 3.205-3.205 3.208 3.208 0 0 1-3.205 3.205z" />
            </svg>
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
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                hsState === "oauth"
                  ? "bg-emerald-100 text-emerald-700"
                  : hsState === "env"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              {hsState === "oauth"
                ? "✓ Connecté (OAuth)"
                : hsState === "env"
                  ? "⚠ env var (legacy)"
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
                  <path d="M5 12h14" />
                  <polyline points="12 5 19 12 12 19" />
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
                <p className="mt-0.5 font-semibold text-slate-800">{hsMeta.custom_objects_count ?? 0}</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="font-medium text-slate-500">Connecté le</p>
                <p className="mt-0.5 font-semibold text-slate-800">
                  {hsMeta.connected_at
                    ? new Date(hsMeta.connected_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
                    : "—"}
                </p>
              </div>
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
                    <div key={co.objectTypeId} className="flex items-center justify-between gap-3 rounded-md bg-white/70 px-3 py-2">
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
            ⚠ Token configuré via variable d&apos;environnement (mode legacy mono-tenant). Connectez via OAuth pour passer en multi-tenant et activer le refresh automatique.
          </p>
        )}

        {hsState === "none" && (
          <p className="mt-3 text-xs text-slate-500">
            Cliquez « Connecter HubSpot » — vous serez redirigé vers HubSpot pour autoriser l&apos;accès lecture seule à votre CRM. Aucune donnée ne sort de votre portail HubSpot vers Revold sans cette autorisation.
          </p>
        )}
      </div>
    </div>
  );
}
