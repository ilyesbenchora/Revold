"use client";

import { useState } from "react";

const inputClass = "w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const CATEGORIES = [
  { key: "crm", label: "CRM (HubSpot, Pipedrive…)", options: [
    { value: "hourly", label: "Toutes les heures" },
    { value: "4h", label: "Toutes les 4 heures" },
    { value: "daily", label: "1x par jour" },
    { value: "manual", label: "Manuel uniquement" },
  ], defaultValue: "hourly" },
  { key: "billing", label: "Billing (Stripe, Pennylane…)", options: [
    { value: "webhooks", label: "Webhooks (temps réel)" },
    { value: "hourly", label: "Toutes les heures" },
    { value: "daily", label: "1x par jour" },
  ], defaultValue: "webhooks" },
  { key: "support", label: "Support (Zendesk, Intercom…)", options: [
    { value: "hourly", label: "Toutes les heures" },
    { value: "4h", label: "Toutes les 4 heures" },
    { value: "daily", label: "1x par jour" },
  ], defaultValue: "hourly" },
  { key: "kpi", label: "Calcul KPIs / scores", options: [
    { value: "daily", label: "1x par jour" },
    { value: "2xdaily", label: "2x par jour" },
    { value: "realtime", label: "Temps réel (Enterprise)" },
  ], defaultValue: "daily" },
];

export function SyncFrequencyForm({ saved: savedFreqs }: { saved: Record<string, string> }) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const cat of CATEGORIES) map[cat.key] = savedFreqs[cat.key] ?? cat.defaultValue;
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [savedState, setSavedState] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/sync-frequencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frequencies: values }),
      });
      if (res.ok) setSavedState(true);
    } catch {}
    setSaving(false);
  }

  return (
    <div className="card p-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {CATEGORIES.map((cat) => (
          <div key={cat.key}>
            <label className="text-xs font-medium text-slate-500">{cat.label}</label>
            <select
              value={values[cat.key]}
              onChange={(e) => { setValues((p) => ({ ...p, [cat.key]: e.target.value })); setSavedState(false); }}
              className={`${inputClass} mt-1`}
            >
              {cat.options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-end gap-3">
        {savedState && <span className="text-xs font-medium text-emerald-600">✓ Enregistré</span>}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Enregistrer les fréquences"}
        </button>
      </div>
    </div>
  );
}
