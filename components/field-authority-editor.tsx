"use client";

import { useState } from "react";

type AuthorityRow = {
  entity: string;
  field: string;
  priority: string[];
  rationale: string;
};

const ENTITIES = ["Contact", "Company", "Deal", "Invoice", "Subscription", "Ticket"];

export function FieldAuthorityEditor({
  rows,
  connectedTools = [],
}: {
  rows: AuthorityRow[];
  connectedTools?: string[];
}) {
  const [data, setData] = useState<AuthorityRow[]>(rows);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newEntity, setNewEntity] = useState("Company");
  const [newField, setNewField] = useState("");

  const dirty = () => setSaved(false);

  function moveUp(rowIdx: number, srcIdx: number) {
    if (srcIdx === 0) return;
    setData((prev) => {
      const next = [...prev];
      const row = { ...next[rowIdx], priority: [...next[rowIdx].priority] };
      [row.priority[srcIdx - 1], row.priority[srcIdx]] = [row.priority[srcIdx], row.priority[srcIdx - 1]];
      next[rowIdx] = row;
      return next;
    });
    dirty();
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
    dirty();
  }

  function removeSource(rowIdx: number, srcIdx: number) {
    setData((prev) => {
      const next = [...prev];
      const row = { ...next[rowIdx], priority: next[rowIdx].priority.filter((_, i) => i !== srcIdx) };
      next[rowIdx] = row;
      return next;
    });
    dirty();
  }

  function addSource(rowIdx: number, tool: string) {
    if (!tool) return;
    setData((prev) => {
      const next = [...prev];
      if (next[rowIdx].priority.includes(tool)) return prev;
      next[rowIdx] = { ...next[rowIdx], priority: [...next[rowIdx].priority, tool] };
      return next;
    });
    dirty();
  }

  function removeRow(rowIdx: number) {
    setData((prev) => prev.filter((_, i) => i !== rowIdx));
    dirty();
  }

  function addRow() {
    const field = newField.trim();
    if (!field) return;
    if (data.some((r) => r.entity === newEntity && r.field.toLowerCase() === field.toLowerCase())) return;
    setData((prev) => [
      ...prev,
      { entity: newEntity, field, priority: [...connectedTools], rationale: "Champ personnalisé" },
    ]);
    setNewField("");
    dirty();
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
              <th className="px-5 py-2">Priorité des sources (1ère = source de vérité)</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => {
              const available = connectedTools.filter((t) => !row.priority.includes(t));
              return (
                <tr key={`${row.entity}-${row.field}`} className="border-b border-card-border last:border-0 align-top">
                  <td className="px-5 py-2.5">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{row.entity}</span>
                  </td>
                  <td className="px-5 py-2.5 font-medium text-slate-800">{row.field}</td>
                  <td className="px-5 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {row.priority.map((src, srcIdx) => (
                        <span key={src} className="inline-flex items-center gap-0.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            srcIdx === 0 ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                          }`}>
                            {srcIdx === 0 ? `🏆 ${src}` : src}
                            <button
                              type="button"
                              onClick={() => removeSource(rowIdx, srcIdx)}
                              className="text-[10px] leading-none text-slate-400 hover:text-red-500"
                              title="Retirer cette source"
                            >×</button>
                          </span>
                          <span className="inline-flex flex-col">
                            <button type="button" onClick={() => moveUp(rowIdx, srcIdx)} disabled={srcIdx === 0}
                              className="text-[8px] text-slate-400 hover:text-indigo-600 disabled:opacity-20" title="Monter">▲</button>
                            <button type="button" onClick={() => moveDown(rowIdx, srcIdx)} disabled={srcIdx === row.priority.length - 1}
                              className="text-[8px] text-slate-400 hover:text-indigo-600 disabled:opacity-20" title="Descendre">▼</button>
                          </span>
                        </span>
                      ))}
                      {available.length > 0 && (
                        <select
                          value=""
                          onChange={(e) => addSource(rowIdx, e.target.value)}
                          className="rounded-full border border-dashed border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-500"
                        >
                          <option value="">+ source</option>
                          {available.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    {row.rationale && <p className="mt-1 text-[11px] text-slate-400">{row.rationale}</p>}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => removeRow(rowIdx)}
                      className="rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-red-50 hover:text-red-500"
                      title="Supprimer ce champ"
                    >Suppr.</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Ajouter un champ */}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ajouter un champ :</span>
        <select value={newEntity} onChange={(e) => setNewEntity(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm">
          {ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <input
          value={newField}
          onChange={(e) => setNewField(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRow(); } }}
          placeholder="Nom du champ (ex : owner, phone, industry…)"
          className="min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100"
        />
        <button
          type="button"
          onClick={addRow}
          disabled={!newField.trim()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          + Ajouter
        </button>
        {connectedTools.length === 0 && (
          <span className="text-[11px] text-slate-400">Connecte des outils pour renseigner les sources.</span>
        )}
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
