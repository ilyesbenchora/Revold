"use client";

import { useState } from "react";
import { DismissibleNote } from "@/components/dismissible-note";

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
  /** Position enregistrée dans la matrice de priorités (null = ordre par défaut). */
  priority?: number | null;
};

const inputClass = "w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

// (Les taux réels de rapprochement CRM × outil vivent sur Audit données →
// Rapprochement de données — plus de doublon ici.)
export function ResolutionRules({ rules }: { rules: Rule[] }) {
  const [states, setStates] = useState<Record<string, boolean>>(
    Object.fromEntries(rules.map((r) => [r.id, r.enabled])),
  );
  const [configs, setConfigs] = useState<Record<string, Record<string, string>>>(
    Object.fromEntries(rules.map((r) => [r.id, Object.fromEntries(r.configFields.map((cf) => [cf.label, cf.value]))])),
  );
  // ── Matrice de priorités : ordre des règles = ordre du matching (repli
  // par enregistrement : position 1 essayée si l'identifiant est connu,
  // sinon position 2, etc.). Réordonnable par flèches, persisté. ──
  const [order, setOrder] = useState<string[]>(rules.map((r) => r.id));
  const byId = Object.fromEntries(rules.map((r) => [r.id, r]));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggle(id: string) {
    if (id === "external_id_match") return;
    setStates((prev) => ({ ...prev, [id]: !prev[id] }));
    setSaved(false);
  }

  function move(id: string, dir: -1 | 1) {
    setOrder((prev) => {
      const i = prev.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
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
        body: JSON.stringify({ rules: states, configs, order }),
      });
      if (res.ok) setSaved(true);
    } catch {}
    setSaving(false);
  }

  // Garde-fou : « nom d'entreprise » actif en TÊTE des règles Company actives →
  // risque de faux rattachements (homonymes, filiales, variantes).
  const activeCompanyOrder = order.filter(
    (id) => byId[id]?.entity.includes("Company") && id !== "external_id_match" && (states[id] ?? byId[id]?.enabled),
  );
  const nameFirst = activeCompanyOrder[0] === "name_match";

  return (
    <div className="space-y-3">
      {nameFirst && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-medium text-amber-800">
            ⚠ « Match par nom d&apos;entreprise » est en première position : cette règle peut créer de faux
            rattachements (homonymes, filiales, variantes d&apos;orthographe). Recommandé : garder un identifiant
            fort (ID de rapprochement, SIREN, TVA…) devant elle.
          </p>
        </div>
      )}
      {order.map((ruleId, idx) => {
        const rule = byId[ruleId];
        if (!rule) return null;
        const isActive = states[rule.id] ?? rule.enabled;
        const isLocked = rule.id === "external_id_match";

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
                {/* Pas de pourcentage ici : les taux par règle sont mesurés sur
                    Audit données → Rapprochement de données (doublon évité). */}
                {/* ── Matrice de priorités : monter/descendre la règle dans
                       l'ordre de matching (l'ID technique reste automatique). ── */}
                {!isLocked && (
                  <span className="flex flex-col">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); move(rule.id, -1); }}
                      disabled={idx === 0}
                      title="Monter dans l'ordre de rapprochement"
                      className="flex h-4 w-6 items-center justify-center rounded text-[10px] leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); move(rule.id, 1); }}
                      disabled={idx === order.length - 1}
                      title="Descendre dans l'ordre de rapprochement"
                      className="flex h-4 w-6 items-center justify-center rounded text-[10px] leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                    >
                      ▼
                    </button>
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
                <DismissibleNote storageKey={`rule-warning-${rule.id}`} variant="warning">
                  ⚠ {rule.warning}
                </DismissibleNote>
              )}
              {isActive && rule.configFields.length > 0 && (
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
