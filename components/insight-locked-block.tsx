import Link from "next/link";

type Props = {
  previewTitle?: string;
  previewBody?: string;
};

/**
 * Locked Insight IA block — blurred preview with upgrade CTA.
 * Reused across Overview and all Performance sub-pages.
 */
export function InsightLockedBlock({
  previewTitle = "Analyse stratégique générée par l'IA Revold",
  previewBody = "L'IA Revold analyse en continu vos données pour identifier les opportunités cachées, les risques émergents et les actions prioritaires à mener sur cette section.",
}: Props) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-6">
      {/* Blurred preview */}
      <div className="pointer-events-none select-none blur-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Insight Revold IA
        </p>
        <h2 className="mt-2 text-lg font-semibold text-slate-700">
          {previewTitle}
        </h2>
        <p className="mt-2 text-sm text-slate-500">{previewBody}</p>
        <p className="mt-3 text-sm font-medium text-slate-600">
          Recommandation : optimiser les processus identifiés pour un impact mesurable sur les revenus.
        </p>
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/70 backdrop-blur-[2px]">
        <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-xs font-semibold text-amber-700">Fonctionnalité Premium</span>
        </div>
        <p className="text-sm font-medium text-slate-700">
          Débloquez les insights stratégiques générés par l&apos;IA
        </p>
        <Link
          href="/dashboard/mon-compte#subscription"
          className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 35%, #b45309 70%, #f59e0b 100%)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          Upgrade mon plan
        </Link>
      </div>
    </section>
  );
}
