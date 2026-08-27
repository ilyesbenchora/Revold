/**
 * Gate « sources par page » — généralise le pattern Trésorerie à toutes les
 * pages Données.
 *
 * Source de vérité : le mapping « Outil source par page » (Paramètres →
 * Intégrations, table tool_mappings). Le gate croise mapping × outils
 * réellement connectés × catégories pertinentes pour la page :
 *   - AUCUN outil choisi → on n'affiche RIEN d'autre qu'une invite claire ;
 *   - sinon → le contenu de la page, tel quel.
 *
 * Le rappel discret « Blocs alimentés par … » est un composant séparé
 * (PageSourcesFooter) à placer EN BAS de page, APRÈS les tables de données.
 *
 * Ajouter/retirer un outil dans les paramètres se répercute automatiquement
 * (pages force-dynamic).
 */

import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getConnectedTools } from "@/lib/integrations/connected-tools";
import { getToolKeysChain } from "@/lib/integrations/tool-mappings";
import type { ConnectableTool } from "@/lib/integrations/connect-catalog";
import { BrandLogo } from "@/components/brand-logo";
import { NoPageSourcesNotice } from "@/components/no-page-sources-notice";

export async function PageSourcesGate({
  supabase,
  orgId,
  pageKey,
  categories,
  children,
}: {
  supabase: SupabaseClient;
  orgId: string;
  /**
   * Clé tool_mappings de la page (ex : audit_perf_ventes) — ou chaîne de
   * fallback [clé sous-page, clé parente] : le premier mapping non vide fait
   * foi (une sous-page sans réglage hérite de sa page parente).
   */
  pageKey: string | string[];
  /** Catégories d'outils pertinentes pour cette page (jamais communication). */
  categories: Array<ConnectableTool["category"]>;
  children: React.ReactNode;
}) {
  const [connected, mapped] = await Promise.all([
    getConnectedTools(supabase, orgId),
    getToolKeysChain(supabase, orgId, Array.isArray(pageKey) ? pageKey : [pageKey]),
  ]);

  // ISO Paramètres : le mapping fait foi tel quel. On n'applique PAS de filtre
  // par catégorie ici — un outil explicitement choisi dans les paramètres doit
  // apparaître sur la page, sinon l'utilisateur voit « rien » alors qu'il a
  // configuré ses sources. Seule la communication (Slack, Teams…) est exclue.
  // SANS mapping : les outils connectés des catégories pertinentes font foi —
  // un outil connecté doit alimenter la page sans étape de config. L'invite ne
  // reste que s'il n'y a rien de connecté pour cette page.
  const tools =
    mapped.length > 0
      ? connected.filter((t) => t.category !== "communication" && mapped.includes(t.key))
      : connected.filter((t) => categories.includes(t.category));

  if (tools.length === 0) return <NoPageSourcesNotice />;

  return <>{children}</>;
}

/**
 * Rappel discret « Blocs alimentés par … » — dropdown replié à placer en
 * BAS de page, après les tables de données (ou en dernier s'il n'y en a pas).
 * Rien ne s'affiche si aucun outil n'est mappé pour la page.
 */
export async function PageSourcesFooter({
  supabase,
  orgId,
  pageKey,
  categories,
}: {
  supabase: SupabaseClient;
  orgId: string;
  /** Clé tool_mappings de la page — ou chaîne de fallback (cf. PageSourcesGate). */
  pageKey: string | string[];
  /** Mêmes catégories que le gate de la page : sans mapping, le footer liste
   *  les outils connectés de ces catégories (le fallback qui alimente les blocs). */
  categories?: Array<ConnectableTool["category"]>;
}) {
  const [connected, mapped] = await Promise.all([
    getConnectedTools(supabase, orgId),
    getToolKeysChain(supabase, orgId, Array.isArray(pageKey) ? pageKey : [pageKey]),
  ]);
  const tools =
    mapped.length > 0
      ? connected.filter((t) => t.category !== "communication" && mapped.includes(t.key))
      : connected.filter((t) => (categories ?? []).includes(t.category));
  if (tools.length === 0) return null;

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-medium text-slate-400 transition hover:text-slate-600 [&::-webkit-details-marker]:hidden">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90" aria-hidden><polyline points="9 18 15 12 9 6" /></svg>
        Blocs alimentés par {tools.length} {tools.length > 1 ? "sources" : "source"}
      </summary>
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
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
    </details>
  );
}
