"use client";

import { useEffect, useState } from "react";
import {
  BASE_COHORT_OPTIONS,
  fetchCohortDealIds,
  fetchCohortOptions,
  fetchCohortValues,
  type ActiveCohort,
  type CohortOption,
} from "@/lib/reports/cohort-filter-client";

/**
 * Sélecteur de cohorte pour les blocs de deals alimentés en direct par
 * HubSpot (Deals à risque, Forecast management) : au choix d'une valeur, le
 * composant récupère les ids HubSpot des deals de la cohorte (rattachement
 * company_id canonique) et les remonte — le bloc filtre ses listes dessus.
 */
export function CohortDealFilter({
  onChange,
}: {
  onChange: (cohort: ActiveCohort | null, dealIds: Set<string> | null) => void;
}) {
  const [options, setOptions] = useState<CohortOption[]>(BASE_COHORT_OPTIONS);
  const [key, setKey] = useState<string | null>(null);
  const [value, setValue] = useState<string | null>(null);
  const [values, setValues] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetchCohortOptions().then(setOptions);
  }, []);

  function applyKey(k: string | null) {
    setKey(k);
    setValue(null);
    setValues([]);
    if (k) void fetchCohortValues(k).then(setValues);
    onChange(null, null);
  }

  async function applyValue(v: string | null) {
    setValue(v);
    if (!key || !v) {
      onChange(null, null);
      return;
    }
    setLoading(true);
    try {
      const ids = await fetchCohortDealIds(key, v);
      onChange({ key, value: v }, ids);
    } finally {
      setLoading(false);
    }
  }

  return (
    <label className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
      Cohorte :
      <select
        value={key ?? ""}
        disabled={loading}
        onChange={(e) => applyKey(e.target.value || null)}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-accent focus:outline-none disabled:opacity-50"
      >
        <option value="">Aucune</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>{c.label}</option>
        ))}
      </select>
      {key && (
        <select
          value={value ?? ""}
          disabled={loading}
          onChange={(e) => void applyValue(e.target.value || null)}
          className="max-w-44 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-accent focus:outline-none disabled:opacity-50"
        >
          <option value="">Toutes les valeurs</option>
          {(values.length > 0 ? values : value ? [value] : []).map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      )}
      {loading && <span className="text-[11px] text-slate-400">Chargement…</span>}
    </label>
  );
}
