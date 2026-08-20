"use client";

import { useState } from "react";

/**
 * Cohorte « Contrat » (groupe Ventes de Paramètres → Cohortes) : dates de
 * début et de fin de contrat — MÊME structure visuelle que les lignes de
 * cohortes (objet + nom interne + nom API, badges ✓/⚠), mais stockée en
 * identifier_field_mapping (la sync et le radar de facturation la consomment),
 * d'où son enregistrement propre. Vérification CRM avant écriture, comme
 * partout : un mapping qui pointe vers le vide n'est pas enregistré.
 */

export type ContractFieldInit = {
  object: string; // "companies" | "deals"
  label: string;
  apiName: string;
  exists: boolean | null;
};

type FieldState = ContractFieldInit & { checking?: boolean };

const OBJECTS = [
  { id: "companies", label: "Entreprise" },
  { id: "deals", label: "Deal" },
];

const FIELDS: { id: "start" | "end"; canonical: string; title: string }[] = [
  { id: "start", canonical: "contract_start", title: "Date de début de contrat" },
  { id: "end", canonical: "contract_end", title: "Date de fin de contrat" },
];

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100 disabled:bg-slate-50 disabled:text-slate-400";

export function CohortContractRow({
  initial,
  hasCrm,
  editable,
}: {
  initial: { start: ContractFieldInit; end: ContractFieldInit };
  hasCrm: boolean;
  editable: boolean;
}) {
  const [fields, setFields] = useState<{ start: FieldState; end: FieldState }>(initial);
  const [state, setState] = useState<"idle" | "checking" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function patch(id: "start" | "end", p: Partial<FieldState>) {
    setFields((f) => ({ ...f, [id]: { ...f[id], ...p, ...(p.object || p.label !== undefined || p.apiName !== undefined ? { exists: null } : {}) } }));
  }

  async function save() {
    if (state === "checking" || state === "saving") return;
    setError(null);

    // 1. Vérification CRM des champs renseignés (nom API puis libellé — le nom
    //    API retrouvé via le libellé est appliqué automatiquement).
    const filled = FIELDS.filter((f) => fields[f.id].apiName.trim() || fields[f.id].label.trim());
    const next = { ...fields };
    if (hasCrm && filled.length > 0) {
      setState("checking");
      try {
        const res = await fetch("/api/settings/hubspot-properties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            checks: filled.map((f) => ({
              objectType: fields[f.id].object,
              name: fields[f.id].apiName.trim(),
              label: fields[f.id].label.trim(),
            })),
          }),
        });
        if (res.ok) {
          const d = await res.json();
          const results = (d.results ?? []) as Array<{ exists: boolean | null; label: string | null; suggestedName: string | null }>;
          const missing: string[] = [];
          filled.forEach((f, i) => {
            const r = results[i];
            if (!r) return;
            if (r.exists === false && r.suggestedName) {
              next[f.id] = { ...next[f.id], apiName: r.suggestedName, label: r.label ?? next[f.id].label, exists: true };
            } else {
              next[f.id] = { ...next[f.id], exists: r.exists, label: r.label ?? next[f.id].label };
              if (r.exists === false) missing.push(`« ${fields[f.id].apiName.trim() || fields[f.id].label.trim()} » (${f.title})`);
            }
          });
          setFields(next);
          if (missing.length > 0) {
            setError(`Propriété${missing.length > 1 ? "s" : ""} introuvable${missing.length > 1 ? "s" : ""} dans HubSpot : ${missing.join(", ")}.`);
            setState("error");
            return;
          }
        }
      } catch {
        /* vérification indisponible → on enregistre quand même (comme ailleurs) */
      }
    }

    // 2. Enregistrement (identifier_field_mapping) — champ vidé = mapping supprimé.
    setState("saving");
    try {
      const res = await fetch("/api/settings/field-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mappings: FIELDS.map((f) => ({
            provider: "hubspot",
            canonical_field: f.canonical,
            provider_field: next[f.id].apiName.trim(),
            object_type: next[f.id].object,
          })),
        }),
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

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">Contrat</p>
          <p className="text-[11px] text-slate-400">
            Dates de début et de fin de contrat — elles alimentent le radar de facturation et les analyses par
            cohorte de contrat.
          </p>
        </div>
      </div>

      {FIELDS.map((f) => {
        const st = fields[f.id];
        return (
          <div key={f.id} className="mt-3">
            <p className="flex items-center gap-2 text-xs font-medium text-slate-500">
              {f.title}
              {st.exists === true && (
                <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">✓ DANS LE CRM</span>
              )}
              {st.exists === false && (
                <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">⚠ ABSENTE DU CRM</span>
              )}
            </p>
            <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Objet HubSpot</label>
                <select
                  value={st.object}
                  onChange={(e) => patch(f.id, { object: e.target.value })}
                  disabled={!editable}
                  className={inputClass}
                >
                  {OBJECTS.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Nom de la propriété (interne)</label>
                <input
                  value={st.label}
                  onChange={(e) => patch(f.id, { label: e.target.value })}
                  placeholder="Ex : Date de fin de contrat"
                  disabled={!editable}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Nom API</label>
                <input
                  value={st.apiName}
                  onChange={(e) => patch(f.id, { apiName: e.target.value })}
                  placeholder="Ex : date_fin_contrat"
                  disabled={!editable}
                  className={`${inputClass} ${st.exists === false ? "border-rose-300" : ""}`}
                />
              </div>
            </div>
          </div>
        );
      })}

      {editable && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          {state === "done" && <span className="text-xs font-semibold text-emerald-600">✓ Vérifié et enregistré</span>}
          {state === "error" && <span className="text-xs text-rose-500">{error}</span>}
          <button
            type="button"
            onClick={() => void save()}
            disabled={state === "checking" || state === "saving" || !hasCrm}
            title={hasCrm ? undefined : "Connecte ton CRM pour mapper les dates de contrat"}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-fuchsia-200 hover:text-fuchsia-700 disabled:opacity-50"
          >
            {state === "checking" ? "Vérification CRM…" : state === "saving" ? "Enregistrement…" : "Enregistrer le contrat"}
          </button>
        </div>
      )}
    </div>
  );
}
