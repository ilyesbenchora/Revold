"use client";

import { useState } from "react";

export type DedupRule = {
  id: string;
  entity: string;
  criteria: string;
  secondaryCriteria: string;
  action: string;
  warning: string | null;
  enabled: boolean;
};

export function DedupRules({ rules }: { rules: DedupRule[] }) {
  const [states, setStates] = useState<Record<string, boolean>>(
    Object.fromEntries(rules.map((r) => [r.id, r.enabled])),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggle(id: string) {
    setStates((prev) => ({ ...prev, [id]: !prev[id] }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/dedup-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: states }),
      });
      if (res.ok) setSaved(true);
    } catch {}
    setSaving(false);
  }

  return (
    <div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <th className="px-5 py-2">Entité</th>
              <th className="px-5 py-2">Critère primaire</th>
              <th className="px-5 py-2">Critère secondaire</th>
              <th className="px-5 py-2">Action</th>
              <th className="px-5 py-2 text-right">Activer</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => {
              const isActive = states[rule.id] ?? rule.enabled;
              return (
                <tr key={rule.id} className={`border-b border-card-border last:border-0 transition ${!isActive ? "opacity-50" : ""}`}>
                  <td className="px-5 py-2.5 font-medium text-slate-800">{rule.entity}</td>
                  <td className="px-5 py-2.5 text-slate-600">
                    {rule.criteria}
                    {rule.warning && (
                      <p className="mt-0.5 text-[10px] text-amber-600">⚠ {rule.warning}</p>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-slate-500">{rule.secondaryCriteria}</td>
                  <td className="px-5 py-2.5">
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{rule.action}</span>
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => toggle(rule.id)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                        isActive ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        isActive ? "translate-x-5" : "translate-x-0.5"
                      } mt-0.5`} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-end gap-3">
        {saved && <span className="text-xs font-medium text-emerald-600">✓ Enregistré</span>}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
