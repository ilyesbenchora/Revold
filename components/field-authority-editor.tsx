"use client";

import { useState } from "react";

type AuthorityRow = {
  entity: string;
  field: string;
  priority: string[];
  rationale: string;
};

export function FieldAuthorityEditor({ rows }: { rows: AuthorityRow[] }) {
  const [data, setData] = useState<AuthorityRow[]>(rows);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function moveUp(rowIdx: number, srcIdx: number) {
    if (srcIdx === 0) return;
    setData((prev) => {
      const next = [...prev];
      const row = { ...next[rowIdx], priority: [...next[rowIdx].priority] };
      [row.priority[srcIdx - 1], row.priority[srcIdx]] = [row.priority[srcIdx], row.priority[srcIdx - 1]];
      next[rowIdx] = row;
      return next;
    });
    setSaved(false);
  }

  function moveDown(rowIdx: number, srcIdx: number) {
    setData((prev) => {
      if (srcIdx >= prev[rowIdx].priority.length - 1) return prev;
      const next = [...prev];
      const row = { ...next[rowIdx], priority: [...next[rowIdx].priority] };
      [row.priority[srcIdx], row.priority[srcIdx + 1]] = [row.priority[srcIdx + 1], row.priority[srcIdx]];
      next[rowIdx] = row;
      return next;
    });
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/field-authority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorities: data.map((r) => ({ entity: r.entity, field: r.field, priority: r.priority })),
        }),
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
              <th className="px-5 py-2">Champ</th>
              <th className="px-5 py-2">Priorité (1er = source de vérité)</th>
              <th className="px-5 py-2">Justification</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => (
              <tr key={`${row.entity}-${row.field}`} className="border-b border-card-border last:border-0">
                <td className="px-5 py-2.5">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{row.entity}</span>
                </td>
                <td className="px-5 py-2.5 font-medium text-slate-800">{row.field}</td>
                <td className="px-5 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {row.priority.map((src, srcIdx) => (
                      <span key={src} className="inline-flex items-center gap-0.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          srcIdx === 0 ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                        }`}>
                          {srcIdx === 0 ? `🏆 ${src}` : src}
                        </span>
                        <span className="inline-flex flex-col">
                          <button
                            type="button"
                            onClick={() => moveUp(rowIdx, srcIdx)}
                            disabled={srcIdx === 0}
                            className="text-[8px] text-slate-400 hover:text-indigo-600 disabled:opacity-20"
                            title="Monter"
                          >▲</button>
                          <button
                            type="button"
                            onClick={() => moveDown(rowIdx, srcIdx)}
                            disabled={srcIdx === row.priority.length - 1}
                            className="text-[8px] text-slate-400 hover:text-indigo-600 disabled:opacity-20"
                            title="Descendre"
                          >▼</button>
                        </span>
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-2.5 text-xs text-slate-500">{row.rationale}</td>
              </tr>
            ))}
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
          {saving ? "Enregistrement..." : "Enregistrer la matrice"}
        </button>
      </div>
    </div>
  );
}
