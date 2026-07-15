export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { BrandLogo } from "@/components/brand-logo";
import { CONNECTABLE_TOOLS, type ConnectableTool } from "@/lib/integrations/connect-catalog";
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/integrations/category-meta";
import Link from "next/link";

export default async function BibliothequeOutilsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const errParam = typeof sp.error === "string" ? sp.error : null;
  const oauthEnvMissing = errParam?.startsWith("oauth_env_") ? errParam.replace("oauth_env_", "") : null;

  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;

  const supabase = await createSupabaseServerClient();
  const { data: integrationsRecords } = await supabase
    .from("integrations")
    .select("provider, refresh_token, portal_id")
    .eq("organization_id", orgId)
    .eq("is_active", true);
  const connectedKeys = new Set((integrationsRecords ?? []).map((i) => i.provider).filter(Boolean));
  if ((integrationsRecords ?? []).some((i) => i.provider === "hubspot" && i.refresh_token && i.portal_id)) {
    connectedKeys.add("hubspot");
  }

  const toolsByCategory: Record<ConnectableTool["category"], ConnectableTool[]> = {
    crm: [], billing: [], phone: [], files: [], support: [], communication: [], conv_intel: [], ads: [],
  };
  for (const tool of Object.values(CONNECTABLE_TOOLS)) toolsByCategory[tool.category].push(tool);

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Bibliothèque d&apos;outils</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tous les outils sur lesquels Revold peut se connecter. Cliquez pour connecter — vos outils déjà branchés sont
          dans <Link href="/dashboard/integration/mes-outils" className="font-medium text-accent hover:underline">Mes outils connectés</Link>.
        </p>
      </header>

      {oauthEnvMissing && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚙️ La connexion <strong>{oauthEnvMissing.replace(/_/g, " ")}</strong> nécessite d&apos;abord la configuration de
          l&apos;app OAuth (identifiants client dans les variables d&apos;environnement). Contactez l&apos;administrateur
          Revold pour l&apos;activer.
        </div>
      )}

      <div className="space-y-6">
        {CATEGORY_ORDER.map((cat) => {
          const meta = CATEGORY_META[cat];
          const tools = toolsByCategory[cat];
          if (tools.length === 0) return null;

          return (
            <div key={cat} className="space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br ${meta.gradient} text-xs text-white`}>
                  {meta.emoji}
                </span>
                {meta.label}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{tools.length}</span>
              </h2>
              <p className="text-xs text-slate-500">{meta.description}</p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tools.map((tool) => {
                  const isConnected = connectedKeys.has(tool.key);
                  if (tool.comingSoon) {
                    return (
                      <div
                        key={tool.key}
                        aria-disabled
                        className="relative flex cursor-not-allowed items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 opacity-70"
                        title="Connecteur en cours de développement — disponible bientôt"
                      >
                        <div className="grayscale">
                          <BrandLogo domain={tool.domain} alt={tool.label} fallback={tool.icon} size={36} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-700">{tool.label}</p>
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">{tool.vendor}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Bientôt</span>
                      </div>
                    );
                  }
                  const url = tool.connectUrl ?? `/dashboard/integration/connect/${tool.key}`;
                  // Les routes API (OAuth) nécessitent une vraie navigation <a> :
                  // le routeur client de Next ne sait pas naviguer vers /api/*.
                  const isApi = url.startsWith("/api");
                  const cls = `group relative flex items-center gap-3 rounded-xl border p-4 transition ${
                    isConnected
                      ? "border-emerald-200 bg-emerald-50/40 hover:border-emerald-300"
                      : "border-slate-200 bg-white hover:border-accent/40 hover:bg-slate-50/50"
                  }`;
                  const inner = (
                    <>
                      <BrandLogo domain={tool.domain} alt={tool.label} fallback={tool.icon} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{tool.label}</p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{tool.vendor}</p>
                      </div>
                      {isConnected ? (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">✓ Connecté</span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-accent/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent opacity-0 transition group-hover:opacity-100">Connecter</span>
                      )}
                    </>
                  );
                  return isApi ? (
                    <a key={tool.key} href={url} className={cls}>{inner}</a>
                  ) : (
                    <Link key={tool.key} href={url} className={cls}>{inner}</Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
