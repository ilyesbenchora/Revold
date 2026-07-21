/**
 * Gate « sources par page » — généralise le pattern Trésorerie à toutes les
 * pages Données.
 *
 * Source de vérité : le mapping « Outil source par page » (Paramètres →
 * Intégrations, table tool_mappings). Le gate croise mapping × outils
 * réellement connectés × catégories pertinentes pour la page :
 *   - AUCUN outil choisi → on n'affiche RIEN d'autre qu'une invite claire ;
 *   - sinon → barre des sources actives (pills logos) + le contenu de la page.
 *
 * Ajouter/retirer un outil dans les paramètres se répercute automatiquement
 * (pages force-dynamic).
 */

import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getConnectedTools } from "@/lib/integrations/connected-tools";
import { getToolKeys } from "@/lib/integrations/tool-mappings";
import type { ConnectableTool } from "@/lib/integrations/connect-catalog";
import { BrandLogo } from "@/components/brand-logo";

export async function PageSourcesGate({
  supabase,
  orgId,
  pageKey,
  categories,
  children,
}: {
  supabase: SupabaseClient;
  orgId: string;
  /** Clé tool_mappings de la page (ex : audit_perf_ventes). */
  pageKey: string;
  /** Catégories d'outils pertinentes pour cette page (jamais communication). */
  categories: Array<ConnectableTool["category"]>;
  children: React.ReactNode;
}) {
  const [connected, mapped] = await Promise.all([
    getConnectedTools(supabase, orgId),
    getToolKeys(supabase, orgId, pageKey),
  ]);

  const catSet = new Set(categories);
  const tools = connected.filter(
    (t) => t.category !== "communication" && catSet.has(t.category) && mapped.includes(t.key),
  );

  if (tools.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
        <p className="text-sm font-medium text-slate-700">
          Aucun outil source choisi pour cette page.
        </p>
        <p className="mt-1.5 text-xs text-slate-500">
          Les blocs s&apos;activent dès qu&apos;un outil est sélectionné dans{" "}
          <Link href="/dashboard/parametres/integrations" className="font-medium text-fuchsia-600 hover:underline">
            Paramètres → Intégrations → Outil source par page
          </Link>
          {" "}— c&apos;est la source de vérité de l&apos;affichage.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Sources actives de la page — pilotées par les paramètres */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
        <span className="text-[11px] font-medium text-slate-500">Blocs alimentés par :</span>
        {tools.map((t) => (
          <span
            key={t.key}
            className="flex items-center gap-1.5 rounded-full border border-accent bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent"
          >
            <BrandLogo domain={t.domain} alt={t.label} fallback={t.icon} size={14} />
            {t.label}
          </span>
        ))}
        <Link
          href="/dashboard/parametres/integrations"
          className="ml-auto text-[11px] font-medium text-slate-400 hover:text-fuchsia-600"
        >
          Gérer →
        </Link>
      </div>
      {children}
    </>
  );
}
