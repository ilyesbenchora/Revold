import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import type { ConnectedTool } from "@/lib/integrations/connected-tools";

type Props = {
  /** Outils déjà connectés à Revold (rendus en chip vert "Sélectionné"). */
  connectedTools: ConnectedTool[];
  /** Outils à proposer en plus (suggestions de la même catégorie). */
  suggestedTools?: Array<{ key: string; label: string; domain: string; icon: string }>;
  /** Texte explicatif sous le titre. */
  description: string;
  /** Titre du bloc. */
  title?: string;
};

/**
 * Bloc statique "Choisissez les outils à croiser" — affiche les outils
 * connectés en vert (cliqués) + les suggestions en gris (à connecter).
 * Reproduit la même UX que `ReportListWithFilter` mais sans état client
 * (tous les outils connectés sont implicitement sélectionnés pour cette
 * page d'audit).
 */
export function CrossToolSelectorBlock({
  connectedTools,
  suggestedTools = [],
  description,
  title = "Choisissez les outils à croiser",
}: Props) {
  // Évite les doublons (un suggested déjà connecté ne ré-apparaît pas)
  const connectedKeys = new Set(connectedTools.map((t) => t.key));
  const remainingSuggestions = suggestedTools.filter((s) => !connectedKeys.has(s.key));

  return (
    <div className="rounded-xl border border-card-border bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </p>
      <p className="mt-1 text-xs text-slate-400">{description}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {connectedTools.length === 0 && remainingSuggestions.length === 0 ? (
          <p className="text-xs italic text-slate-400">
            Aucun outil connecté à croiser pour cette catégorie.
          </p>
        ) : null}

        {connectedTools.map((t) => (
          <span
            key={t.key}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-3 py-2 text-sm font-medium text-white shadow-sm"
            title={`${t.label} (connecté)`}
          >
            <BrandLogo domain={t.domain} alt={t.label} fallback={t.icon} size={16} />
            {t.label}
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>
        ))}

        {remainingSuggestions.map((t) => (
          <Link
            key={t.key}
            href={`/dashboard/integration/connect/${t.key}`}
            className="inline-flex items-center gap-2 rounded-lg border border-card-border bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            title={`Connecter ${t.label}`}
          >
            <BrandLogo domain={t.domain} alt={t.label} fallback={t.icon} size={16} />
            {t.label}
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              + Connecter
            </span>
          </Link>
        ))}
      </div>

      {connectedTools.length > 0 && remainingSuggestions.length > 0 && (
        <p className="mt-3 text-[11px] text-slate-400">
          Plus vous connectez d&apos;outils, plus les insights croisés se débloquent.{" "}
          <Link href="/dashboard/integration" className="font-medium text-accent hover:underline">
            Voir toutes les intégrations →
          </Link>
        </p>
      )}
    </div>
  );
}
