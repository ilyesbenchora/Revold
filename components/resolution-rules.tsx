"use client";

import { useState } from "react";

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

const inputClass = "w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function ResolutionRules({ rules }: { rules: Rule[] }) {
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
      {rules.map((rule, idx) => {
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
                {rule.confidence !== null && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    rule.confidence >= 95 ? "bg-emerald-100 text-emerald-700" :
                    rule.confidence >= 80 ? "bg-blue-100 text-blue-700" :
                    "bg-amber-100 text-amber-700"
                  }`}>
                    {rule.confidence} %
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
