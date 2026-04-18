import type { ReportCoaching } from "@/lib/reports/fetch-report-coachings";
import Link from "next/link";

type Props = {
  coachings: ReportCoaching[];
  category: string;
};

const sevConfig = {
  critical: { bg: "bg-red-50", border: "border-red-200", badge: "bg-red-100 text-red-700", label: "Critique" },
  warning: { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-100 text-amber-700", label: "Attention" },
  info: { bg: "bg-fuchsia-50", border: "border-fuchsia-200", badge: "bg-fuchsia-100 text-fuchsia-700", label: "Info" },
} as const;

export function ReportCoachingsSection({ coachings, category }: Props) {
  if (coachings.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <span aria-hidden>✨</span>
        Coaching IA activé depuis vos rapports
        <span className="rounded-full bg-fuchsia-100 px-2 py-0.5 text-[10px] font-bold text-fuchsia-700">
          {coachings.length}
        </span>
      </h3>
      {coachings.map((c) => {
        const cfg = sevConfig[c.severity] ?? sevConfig.info;
        return (
          <div
            key={c.id}
            className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4 space-y-3`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                  {c.kpi_label && (
                    <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      KPI : {c.kpi_label}
                    </span>
                  )}
                  {c.source_report_title && (
                    <span className="text-[10px] text-slate-500">
                      issu de « {c.source_report_title} »
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-semibold text-slate-900">{c.title}</h4>
              </div>
            </div>

            <p className="text-[12px] text-slate-700 leading-relaxed">{c.body}</p>

            {c.recommendation && c.recommendation !== c.body && (
              <div className="rounded-lg bg-white/60 px-3 py-2">
                <p className="text-[11px] font-semibold text-fuchsia-700 mb-0.5">
                  ✨ Recommandation
                </p>
                <p className="text-[11px] text-slate-700 leading-relaxed">{c.recommendation}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-slate-400">
                Activé le {new Date(c.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
              </span>
              {c.report_id && (
                <Link
                  href="/dashboard/rapports/mes-rapports"
                  className="text-[10px] font-medium text-fuchsia-700 underline hover:text-fuchsia-800"
                >
                  Voir le rapport source →
                </Link>
              )}
            </div>
          </div>
        );
      })}
      {/* Hidden category marker for future filtering — kept simple, no client logic needed */}
      <span className="hidden">{category}</span>
    </div>
  );
}
