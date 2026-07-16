"use client";

import { SectionLabel } from "./alert-ui";

export type ToolOption = { key: string; label: string; icon: string };

/** État « outils à croiser » + second KPI (le KPI principal reste natif à chaque surface). */
export type CrossState = { sources: string[]; kpi2: string; unit2: "percent" | "count" | "currency" };

export const emptyCross: CrossState = { sources: [], kpi2: "", unit2: "percent" };

/**
 * Bloc réutilisable pour TOUTES les alertes : sélection des outils connectés à
 * croiser, et — dès qu'au moins 2 outils sont sélectionnés — un SECOND KPI
 * attendu (potentiellement un KPI par outil). Le 1er KPI reste géré par la
 * surface appelante (carte d'alerte agent / modale de création / édition).
 */
export function AlertCrossTools({
  tools,
  value,
  onChange,
  disabled = false,
  primaryLabel = "KPI attendu",
}: {
  tools: ToolOption[];
  value: CrossState;
  onChange: (v: CrossState) => void;
  disabled?: boolean;
  /** Libellé du KPI principal (affiché dans l'aide quand multi-outils). */
  primaryLabel?: string;
}) {
  const labelOf = (k: string) => tools.find((t) => t.key === k)?.label ?? k;
  const iconOf = (k: string) => tools.find((t) => t.key === k)?.icon ?? "🔗";
  const multi = value.sources.length >= 2;

  function toggle(k: string) {
    if (disabled) return;
    const has = value.sources.includes(k);
    onChange({ ...value, sources: has ? value.sources.filter((x) => x !== k) : [...value.sources, k] });
  }

  return (
    <div className="space-y-3">
      <div>
        <SectionLabel>Outils à croiser</SectionLabel>
        {tools.length === 0 ? (
          <p className="mt-1 text-[11px] text-slate-400">
            Aucun outil connecté. Connecte tes outils dans Intégrations pour croiser les données.
          </p>
        ) : (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {tools.map((t) => {
              const on = value.sources.includes(t.key);
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => toggle(t.key)}
                  disabled={disabled}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-60 ${
                    on
                      ? "border-fuchsia-300 bg-gradient-to-r from-amber-100 via-fuchsia-100 to-amber-100 text-slate-800 ring-1 ring-fuchsia-200"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <span>{t.icon}</span>
                  {t.label}
                  {on && <span className="text-[10px]">✓</span>}
                </button>
              );
            })}
          </div>
        )}
        {value.sources.length === 1 && (
          <p className="mt-1 text-[10px] text-slate-400">
            Le KPI attendu porte sur {iconOf(value.sources[0])} {labelOf(value.sources[0])}. Sélectionne un 2ᵉ outil pour
            suivre un KPI par outil.
          </p>
        )}
      </div>

      {/* Second KPI — apparaît dès 2 outils croisés (un KPI par outil) */}
      {multi && (
        <div>
          <SectionLabel>
            2ᵉ KPI attendu — {iconOf(value.sources[1])} {labelOf(value.sources[1])}
          </SectionLabel>
          <div className="mt-1 flex items-center gap-1.5">
            <input
              type="number"
              value={value.kpi2}
              onChange={(e) => onChange({ ...value, kpi2: e.target.value })}
              disabled={disabled}
              placeholder="Ex : 20"
              className="w-24 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100 disabled:opacity-60"
            />
            <div className="flex overflow-hidden rounded-lg border border-slate-200">
              {(["percent", "count", "currency"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => onChange({ ...value, unit2: f })}
                  disabled={disabled}
                  className={`px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
                    value.unit2 === f ? "bg-fuchsia-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {f === "percent" ? "%" : f === "currency" ? "€" : "Nombre"}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            Le 1ᵉʳ KPI porte sur {iconOf(value.sources[0])} {labelOf(value.sources[0])}, ce 2ᵉ KPI sur{" "}
            {iconOf(value.sources[1])} {labelOf(value.sources[1])}.
          </p>
        </div>
      )}
    </div>
  );
}

/** Résumé lisible « outils croisés + 2ᵉ KPI » à intégrer dans la description. */
export function crossSummary(tools: ToolOption[], value: CrossState): string {
  if (value.sources.length === 0) return "";
  const names = value.sources.map((k) => tools.find((t) => t.key === k)?.label ?? k);
  const parts = [`Outils croisés : ${names.join(", ")}`];
  if (value.sources.length >= 2 && value.kpi2) {
    const unit = value.unit2 === "count" ? "" : value.unit2 === "currency" ? " €" : " %";
    const second = tools.find((t) => t.key === value.sources[1])?.label ?? value.sources[1];
    parts.push(`2ᵉ KPI (${second}) : ${value.kpi2}${unit}`);
  }
  return parts.join(" · ");
}
