"use client";

import { useState } from "react";

export type CohortMapping = { key: string; label: string; internal_name: string; api_name: string };

/** Sections STANDARD — toujours affichées, non supprimables. */
export const STANDARD_COHORTS: { key: string; label: string; hint: string }[] = [
  { key: "industry", label: "Secteur d'activité", hint: "La propriété CRM qui porte l'industrie / le secteur" },
  { key: "segment", label: "Segment", hint: "PME / ETI / Enterprise, tiers, ICP…" },
  { key: "source", label: "Sources (canal d'acquisition)", hint: "Origine du contact / deal : inbound, outbound, paid…" },
  { key: "priority", label: "Priorité", hint: "Priorité / score du compte ou du deal" },
];

/**
 * Paramètres → Cohortes : pour chaque axe marketing, le NOM DE LA PROPRIÉTÉ
 * dans le CRM (nom interne) et son NOM API — souvent des propriétés custom
 * selon les bases. Ce mapping permet de croiser correctement ces axes dans
 * les reportings. Customs ajoutables au-delà des 4 sections standard.
 */
export function CohortMappingsForm({ initial }: { initial: CohortMapping[] }) {
  // État initial : sections standard (pré-remplies si déjà enregistrées) + customs.
  const [rows, setRows] = useState<CohortMapping[]>(() => {
    const byKey = new Map(initial.map((m) => [m.key, m]));
    const std = STANDARD_COHORTS.map((s) => byKey.get(s.key) ?? { key: s.key, label: s.label, internal_name: "", api_name: "" });
    const customs = initial.filter((m) => !STANDARD_COHORTS.some((s) => s.key === m.key));
    return [...std, ...customs];
  });
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const isStandard = (key: string) => STANDARD_COHORTS.some((s) => s.key === key);
  const hintFor = (key: string) => STANDARD_COHORTS.find((s) => s.key === key)?.hint;

  function patch(key: string, p: Partial<CohortMapping>) {
    setRows((r) => r.map((m) => (m.key === key ? { ...m, ...p } : m)));
  }

  function addCustom() {
    const n = rows.filter((r) => !isStandard(r.key)).length + 1;
    setRows((r) => [...r, { key: `custom_${Date.now()}`, label: `Cohorte custom ${n}`, internal_name: "", api_name: "" }]);
  }

  async function save() {
    setState("saving");
    setError(null);
    try {
      // On n'enregistre que les lignes renseignées (au moins un des deux noms).
      const mappings = rows.filter((m) => m.internal_name.trim() || m.api_name.trim() || !isStandard(m.key));
      const res = await fetch("/api/cohort-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Enregistrement impossible.");
        setState("error");
        return;
      }
      setState("done");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setError("Enregistrement impossible.");
      setState("error");
    }
  }

  const field =
    "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100";

  return (
    <div className="card p-6">
      <div className="space-y-4">
        {rows.map((m) => (
          <div key={m.key} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-2">
              {isStandard(m.key) ? (
                <div>
                  <p className="text-sm font-semibold text-slate-800">{m.label}</p>
                  {hintFor(m.key) && <p className="text-[11px] text-slate-400">{hintFor(m.key)}</p>}
                </div>
              ) : (
                <input
                  value={m.label}
                  onChange={(e) => patch(m.key, { label: e.target.value })}
                  placeholder="Nom de la cohorte custom"
                  className="w-64 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-800 outline-none focus:border-fuchsia-300"
                />
              )}
              {!isStandard(m.key) && (
                <button
                  type="button"
                  onClick={() => setRows((r) => r.filter((x) => x.key !== m.key))}
                  className="shrink-0 rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                >
                  Supprimer
                </button>
              )}
            </div>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Nom de la propriété (interne)</label>
                <input
                  value={m.internal_name}
                  onChange={(e) => patch(m.key, { internal_name: e.target.value })}
                  placeholder="Ex : Secteur d'activité principal"
                  className={field}
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Nom API</label>
                <input
                  value={m.api_name}
                  onChange={(e) => patch(m.key, { api_name: e.target.value })}
                  placeholder="Ex : secteur_activite_principal"
                  className={field}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addCustom}
          className="rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-3 py-1.5 text-xs font-semibold text-fuchsia-700 transition hover:bg-fuchsia-100"
        >
          ＋ Ajouter une cohorte custom
        </button>
        <button
          onClick={save}
          disabled={state === "saving"}
          className="ml-auto rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {state === "saving" ? "Enregistrement…" : "Enregistrer les cohortes"}
        </button>
        {state === "done" && <span className="text-xs font-semibold text-emerald-600">✓ Enregistré</span>}
        {state === "error" && <span className="text-xs text-rose-500">{error}</span>}
      </div>
    </div>
  );
}
