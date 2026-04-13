"use client";

import { useState } from "react";

type Identifier = {
  canonicalField: string;
  label: string;
  defaultProviderField: string;
  hint: string;
  native: boolean;
};

type ProviderRow = {
  provider: string;
  label: string;
  icon: string;
  identifiers: Identifier[];
};

type SavedMapping = { provider: string; canonical_field: string; provider_field: string };

const inputClass = "w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function IdentifierMappingForm({
  rows,
  savedMappings,
}: {
  rows: ProviderRow[];
  savedMappings: SavedMapping[];
}) {
  // Build initial state from saved mappings or defaults
  const [values, setValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const row of rows) {
      for (const id of row.identifiers) {
        const key = `${row.provider}__${id.canonicalField}`;
        const saved = savedMappings.find((m) => m.provider === row.provider && m.canonical_field === id.canonicalField);
        map[key] = saved?.provider_field ?? id.defaultProviderField;
      }
    }
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function update(provider: string, canonicalField: string, value: string) {
    setValues((prev) => ({ ...prev, [`${provider}__${canonicalField}`]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    const mappings: SavedMapping[] = [];
    for (const row of rows) {
      for (const id of row.identifiers) {
        if (id.native || id.canonicalField === "external_id") continue;
        const val = values[`${row.provider}__${id.canonicalField}`];
        if (val) mappings.push({ provider: row.provider, canonical_field: id.canonicalField, provider_field: val });
      }
    }
    try {
      const res = await fetch("/api/settings/field-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings }),
      });
      if (res.ok) setSaved(true);
    } catch {}
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.provider} className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">{row.icon}</span>
            <div>
              <p className="text-sm font-semibold text-slate-900">{row.label}</p>
              <p className="text-[10px] text-slate-400">{row.provider}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {row.identifiers.filter((id) => id.canonicalField !== "external_id").map((id) => (
              <div key={id.canonicalField}>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  {id.label}
                  {id.native ? (
                    <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">NATIF</span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">CUSTOM</span>
                  )}
                </label>
                <input
                  type="text"
                  value={values[`${row.provider}__${id.canonicalField}`] ?? id.defaultProviderField}
                  onChange={(e) => update(row.provider, id.canonicalField, e.target.value)}
                  className={`${inputClass} mt-1`}
                  readOnly={id.native}
                />
                <p className="mt-0.5 text-[10px] text-slate-400">{id.hint}</p>
              </div>
            ))}
          </div>
          {row.identifiers.some((id) => id.canonicalField === "external_id") && (
            <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-[10px] text-slate-500">
                <span className="font-semibold">ID externe</span> : géré automatiquement par Revold via <code className="rounded bg-white px-1">source_links</code>.
              </p>
            </div>
          )}
        </div>
      ))}
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-xs font-medium text-emerald-600">✓ Enregistré</span>}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Enregistrer le mapping"}
        </button>
      </div>
    </div>
  );
}
