import { trackingLabel } from "@/lib/alerts/tracking-label";
import type { AggSpec } from "@/lib/alerts/agg-value";

/**
 * Badge de transparence : montre à quelle donnée RÉELLE le KPI est rattaché
 * (✅ relié) ou signale un suivi manuel (ⓘ) quand rien n'a pu être câblé.
 */
export function TrackingBadge({
  forecastType,
  aggSpec,
}: {
  forecastType?: string | null;
  aggSpec?: AggSpec | null;
}) {
  const label = trackingLabel(forecastType, aggSpec);
  if (!label) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500" title="Aucune donnée réelle rattachée — suivi manuel">
        ⓘ Suivi manuel
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700" title={`Rattaché aux vraies données : ${label}`}>
      ✅ Relié · {label}
    </span>
  );
}
