"use client";

import { useState } from "react";
import { BrandLogo } from "@/components/brand-logo";

export type ConfigField = {
  label: string;
  type: "select" | "input";
  options?: string[];
  value: string;
};

export type Rule = {
  id: string;
  rule: string;
  entity: string;
  description: string;
  confidence: number | null;
  enabled: boolean;
  warning: string | null;
  configFields: ConfigField[];
};

/** Part réelle des rapprochements réalisés par une règle (mesurée sur source_links). */
export type RuleShare = { count: number; pct: number };

/** Taux réel de rapprochement CRM × outil (outils actifs du mapping des identifiants). */
export type ToolMatchRate = {
  provider: string;
  label: string;
  icon: string;
  domain: string;
  total: number;
  matched: number;
  pct: number;
};

const inputClass = "w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function ResolutionRules({
  rules,
  ruleShares = {},
  totalMatched = 0,
  toolRates = [],
  globalRate = null,
}: {
  rules: Rule[];
  /** Par rule id : combien de liens réels cette méthode a produits. */
  ruleShares?: Record<string, RuleShare | undefined>;
  totalMatched?: number;
  toolRates?: ToolMatchRate[];
  /** Taux global : enregistrements des outils actifs reliés au CRM, tous outils confondus. */
  globalRate?: { total: number; matched: number; pct: number } | null;
}) {
  const [states, setStates] = useState<Record<string, boolean>>(
    Object.fromEntries(rules.map((r) => [r.id, r.enabled])),
  );
  const [configs, setConfigs] = useState<Record<string, Record<string, string>>>(
    Object.fromEntries(rules.map((r) => [r.id, Object.fromEntries(r.configFields.map((cf) => [cf.label, cf.value]))])),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggle(id: string) {
    if (id === "external_id_match") return;
    setStates((prev) => ({ ...prev, [id]: !prev[id] }));
    setSaved(false);
  }

  function updateConfig(ruleId: string, label: string, value: string) {
    setConfigs((prev) => ({ ...prev, [ruleId]: { ...prev[ruleId], [label]: value } }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/resolution-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: states, configs }),
      });
      if (res.ok) setSaved(true);
    } catch {}
    setSaving(false);
  }

  return (
    <div className="space-y-3">
      {/* ── Taux RÉELS de rapprochement CRM × outil (suit les toggles du mapping) ── */}
      {toolRates.length > 0 && (
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Taux de rapprochement réel avec le CRM
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Part des enregistrements de chaque outil actif du mapping reliés à une entité HubSpot.
              </p>
            </div>
            {/* Taux global — tous outils actifs confondus */}
            <div className="shrink-0 text-right">
              <p className={`text-2xl font-bold tabular-nums ${
                globalRate == null ? "text-slate-400"
                : globalRate.pct >= 70 ? "text-emerald-600"
                : globalRate.pct >= 40 ? "text-amber-600"
                : "text-rose-600"
              }`}>
                {globalRate ? `${globalRate.pct} %` : "—"}
              </p>
              <p className="text-[10px] text-slate-400">
                global{globalRate ? ` (${globalRate.matched}/${globalRate.total})` : ""}
              </p>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            {toolRates.map((t) => (
              <div key={t.provider} className="flex items-center gap-3">
                <BrandLogo domain={t.domain} alt={t.label} fallback={t.icon} size={24} />
                <div className="min-w-0 flex-1">
                  {t.total === 0 ? (
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-medium text-slate-700">{t.label} × HubSpot</span>
                      <span className="text-[11px] text-slate-400">
                        Aucun enregistrement rapproché — lance une synchronisation depuis Intégrations
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-medium text-slate-700">{t.label} × HubSpot</span>
                        <span className={`font-bold tabular-nums ${
                          t.pct >= 70 ? "text-emerald-600" : t.pct >= 40 ? "text-amber-600" : "text-rose-600"
                        }`}>
                          {t.pct} % <span className="font-normal text-slate-400">({t.matched}/{t.total})</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${t.pct >= 70 ? "bg-emerald-500" : t.pct >= 40 ? "bg-amber-500" : "bg-rose-500"}`}
                          style={{ width: `${t.pct}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── Taux par règle de rapprochement (mesuré sur les liens réels) ── */}
          {totalMatched > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Par règle</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {rules.filter((r) => r.id !== "external_id_match").map((r) => {
                  const share = ruleShares[r.id];
                  return (
                    <span
                      key={r.id}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        share ? "bg-indigo-50 text-indigo-700" : "bg-slate-50 text-slate-400"
                      }`}
                      title={share ? `${share.count} rapprochement${share.count > 1 ? "s" : ""} sur ${totalMatched}` : "Aucun rapprochement par cette règle"}
                    >
                      {r.rule} : {share ? `${share.pct} % (${share.count}/${totalMatched})` : "0"}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {rules.map((rule, idx) => {
        const isActive = states[rule.id] ?? rule.enabled;
        const isLocked = rule.id === "external_id_match";
        const share = ruleShares[rule.id];

        return (
          <details key={rule.id} className={`card overflow-hidden transition ${!isActive ? "opacity-60" : ""}`} open={isActive && idx < 2}>
            <summary className="flex cursor-pointer items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{idx + 1}</span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{rule.rule}</p>
                  <p className="text-xs text-slate-500">{rule.entity}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Part RÉELLE des rapprochements réalisés par cette règle (mesurée
                    sur source_links) — remplace l'ancienne confiance théorique. */}
                {totalMatched > 0 ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      (share?.pct ?? 0) >= 30 ? "bg-emerald-100 text-emerald-700" :
                      (share?.pct ?? 0) >= 10 ? "bg-blue-100 text-blue-700" :
                      (share?.count ?? 0) > 0 ? "bg-amber-100 text-amber-700" :
                      "bg-slate-100 text-slate-500"
                    }`}
                    title={share
                      ? `${share.count} rapprochement${share.count > 1 ? "s" : ""} réalisé${share.count > 1 ? "s" : ""} par cette règle sur ${totalMatched}`
                      : "Aucun rapprochement réalisé par cette règle pour le moment"}
                  >
                    {share ? `${share.pct} % des rapprochements` : "0 rapprochement"}
                  </span>
                ) : rule.confidence !== null && (
                  <span
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500"
                    title="Confiance théorique — aucun rapprochement mesuré pour l'instant"
                  >
                    ~{rule.confidence} %
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); toggle(rule.id); }}
                  disabled={isLocked}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                    isActive ? "bg-emerald-500" : "bg-slate-300"
                  } ${isLocked ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                  title={isLocked ? "Toujours actif (automatique)" : isActive ? "Désactiver" : "Activer"}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    isActive ? "translate-x-5" : "translate-x-0.5"
                  } mt-0.5`} />
                </button>
              </div>
            </summary>
            <div className="border-t border-card-border bg-slate-50/50 p-5 space-y-4">
              <p className="text-sm text-slate-600">{rule.description}</p>
              {rule.warning && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
                  <p className="text-xs font-medium text-amber-800">⚠ {rule.warning}</p>
                </div>
              )}
              {isActive && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {rule.configFields.map((cf) => (
                    <div key={cf.label}>
                      <label className="text-xs font-medium text-slate-500">{cf.label}</label>
                      {cf.type === "select" ? (
                        <select
                          value={configs[rule.id]?.[cf.label] ?? cf.value}
                          onChange={(e) => updateConfig(rule.id, cf.label, e.target.value)}
                          className={`${inputClass} mt-1`}
                        >
                          {cf.options!.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={configs[rule.id]?.[cf.label] ?? cf.value}
                          onChange={(e) => updateConfig(rule.id, cf.label, e.target.value)}
                          className={`${inputClass} mt-1`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
        );
      })}
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-xs font-medium text-emerald-600">✓ Enregistré</span>}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Enregistrer les règles"}
        </button>
      </div>
    </div>
  );
}
