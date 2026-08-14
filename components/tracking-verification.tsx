"use client";

import { entityLabel, ENTITY_FIELDS } from "@/lib/reports/data-table-presets";
import { InfoHint } from "@/components/info-hint";
import { WiredToolsRow } from "@/components/wired-tools-row";

/** Câblage proposé par l'agent pour une alerte / un objectif (rien n'est créé). */
export type TrackingProposal = {
  mode: "reconciled" | "forecast" | "aggregate";
  forecast_type: string | null;
  recon_recipe: string | null;
  agg_spec: Record<string, unknown> | null;
  label: string | null;
  current_value: number | null;
  unit_mode: string | null;
};

const MODE_LABELS: Record<TrackingProposal["mode"], string> = {
  reconciled: "Croisement multi-outils (jointure réelle)",
  forecast: "Indicateur catalogué",
  aggregate: "Agrégat sur les données canoniques",
};

function fmtValue(v: number, unit: string | null): string {
  if (unit === "currency")
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  if (unit === "percent") return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v)} %`;
  return new Intl.NumberFormat("fr-FR").format(v);
}

/**
 * Panneau « Vérification du câblage » commun aux alertes et objectifs : montre
 * à quelle donnée réelle l'agent a rattaché le KPI + la valeur actuelle calculée
 * (la preuve du matching), et permet d'imposer une autre source de données.
 */
export function TrackingVerification({
  proposal,
  counts,
  loading,
  onPickEntity,
  onAdjustSpec,
}: {
  proposal: TrackingProposal;
  counts: Record<string, number>;
  loading: boolean;
  onPickEntity: (entity: string) => void;
  /** Ajustement manuel mesure/champ (mode agrégat) → ré-évaluation déterministe. */
  onAdjustSpec?: (spec: Record<string, unknown>) => void;
}) {
  const aggEntity = typeof proposal.agg_spec?.entity === "string" ? (proposal.agg_spec.entity as string) : null;
  const alternatives = Object.entries(counts).filter(([e]) => e !== aggEntity).sort(([, a], [, b]) => b - a);
  const aggFields = aggEntity ? ENTITY_FIELDS[aggEntity] ?? [] : [];
  const canAdjust = proposal.mode === "aggregate" && aggEntity && onAdjustSpec;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-accent/30 bg-indigo-50/40 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">✨ Vérification du câblage</p>
        <dl className="mt-2 space-y-2.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs text-slate-500">Donnée suivie</dt>
            <dd className="text-right font-semibold text-slate-900">{proposal.label ?? "—"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs text-slate-500">Méthode</dt>
            <dd className="text-right text-xs font-medium text-slate-600">{MODE_LABELS[proposal.mode]}</dd>
          </div>
          {/* Outil(s) connecté(s) qui alimentent l'entité du câblage. */}
          {aggEntity && (
            <WiredToolsRow
              entity={aggEntity}
              sourceKeys={Array.isArray(proposal.agg_spec?.sources) ? (proposal.agg_spec.sources as string[]) : null}
            />
          )}
          {/* Mesure ÉDITABLE (mode agrégat) : si le KPI est ambigu (« paiements » =
              encaissements ? flux net ?), l'utilisateur corrige ici — la valeur
              actuelle se recalcule immédiatement, sans repasser par l'agent. */}
          {canAdjust && (
            <div className="flex items-center justify-between gap-3">
              <dt className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                Mesure
                <InfoHint text="Définit le chiffre suivi : nombre d'éléments, ou somme/moyenne du champ choisi sur la source. C'est cette valeur qui sera comparée au seuil (alerte) ou à la cible (objectif) à chaque contrôle." />
              </dt>
              <dd className="min-w-0">
                <select
                  value={`${String(proposal.agg_spec?.measure ?? "count")}:${String(proposal.agg_spec?.field ?? "")}`}
                  disabled={loading}
                  onChange={(e) => {
                    const [measure, field] = e.target.value.split(":");
                    const f = field || null;
                    const unit = measure === "count" ? "count" : aggFields.find((x) => x.id === f)?.unit ?? proposal.unit_mode;
                    onAdjustSpec!({ ...proposal.agg_spec, measure, field: f, unit_mode: unit });
                  }}
                  className="w-full max-w-56 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-accent"
                >
                  <option value="count:">Nombre de lignes</option>
                  {aggFields.map((f) => (
                    <optgroup key={f.id} label={f.label}>
                      <option value={`sum:${f.id}`}>Somme · {f.label}</option>
                      <option value={`avg:${f.id}`}>Moyenne · {f.label}</option>
                    </optgroup>
                  ))}
                </select>
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs text-slate-500">Valeur actuelle calculée</dt>
            <dd className={`font-semibold ${proposal.current_value != null ? "text-emerald-600" : "text-rose-500"}`}>
              {loading ? "…" : proposal.current_value != null ? fmtValue(proposal.current_value, proposal.unit_mode) : "Non calculable"}
            </dd>
          </div>
        </dl>
      </div>

      {proposal.current_value == null && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">
          La valeur actuelle n&apos;est pas calculable sur ce câblage — le suivi partirait de rien. Impose une autre source ci-dessous, ou vérifie tes synchronisations.
        </p>
      )}

      {alternatives.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500">Imposer une autre source de données</p>
          <p className="mt-0.5 text-[11px] text-slate-400">L&apos;agent recâble le KPI sur la source choisie (volumes réels affichés).</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {alternatives.map(([e, n]) => (
              <button
                key={e}
                type="button"
                disabled={loading}
                onClick={() => onPickEntity(e)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50 ${
                  n > 0
                    ? "border-slate-200 bg-white text-slate-600 hover:border-fuchsia-300 hover:bg-fuchsia-50/40"
                    : "border-slate-100 bg-slate-50 text-slate-400"
                }`}
              >
                {entityLabel(e)} · {new Intl.NumberFormat("fr-FR").format(n)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
