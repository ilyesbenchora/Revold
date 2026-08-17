"use client";

import { useState } from "react";

export type CohortMapping = { key: string; label: string; internal_name: string; api_name: string };

/** État de vérification d'une propriété CRM d'une cohorte. */
export type CohortPropertyState = {
  /** true = présente dans le CRM · false = absente · null = invérifiable. */
  exists: boolean | null;
  /** Libellé réel de la propriété quand elle a été trouvée. */
  label: string | null;
  /** Nom API retrouvé via le libellé quand le nom saisi n'existait pas. */
  suggestedName: string | null;
  /** Objet CRM où la propriété a été trouvée (contacts/companies/deals). */
  foundObject: string | null;
};

/** Statut par cohorte (clé = key du mapping). */
export type CohortPropertyStatus = Record<string, CohortPropertyState | undefined>;

const UNVERIFIED: CohortPropertyState = { exists: null, label: null, suggestedName: null, foundObject: null };

const OBJECT_LABELS: Record<string, string> = { contacts: "Contact", companies: "Entreprise", deals: "Deal" };

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
 * Même système de vérification que le mapping des identifiants (Modèle de
 * données) : les propriétés sont vérifiées dans le CRM connecté avant
 * enregistrement — l'objet porteur étant libre, la recherche couvre
 * Contact / Entreprise / Deal.
 */
export function CohortMappingsForm({
  initial,
  initialStatus = {},
  hasCrm = false,
}: {
  initial: CohortMapping[];
  /** Statut initial (serveur) des propriétés, clé = key du mapping. */
  initialStatus?: CohortPropertyStatus;
  /** true si un CRM est connecté (token dispo) — sinon vérification impossible. */
  hasCrm?: boolean;
}) {
  // État initial : sections standard (pré-remplies si déjà enregistrées) + customs.
  const [rows, setRows] = useState<CohortMapping[]>(() => {
    const byKey = new Map(initial.map((m) => [m.key, m]));
    const std = STANDARD_COHORTS.map((s) => byKey.get(s.key) ?? { key: s.key, label: s.label, internal_name: "", api_name: "" });
    const customs = initial.filter((m) => !STANDARD_COHORTS.some((s) => s.key === m.key));
    return [...std, ...customs];
  });
  const [status, setStatus] = useState<CohortPropertyStatus>(initialStatus);
  const [state, setState] = useState<"idle" | "checking" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const isStandard = (key: string) => STANDARD_COHORTS.some((s) => s.key === key);
  const hintFor = (key: string) => STANDARD_COHORTS.find((s) => s.key === key)?.hint;

  function patch(key: string, p: Partial<CohortMapping>) {
    setRows((r) => r.map((m) => (m.key === key ? { ...m, ...p } : m)));
    // La saisie a changé : le statut vérifié ne vaut plus pour cette cohorte.
    if (p.internal_name !== undefined || p.api_name !== undefined) {
      setStatus((prev) => ({ ...prev, [key]: UNVERIFIED }));
    }
  }

  function addCustom() {
    const n = rows.filter((r) => !isStandard(r.key)).length + 1;
    setRows((r) => [...r, { key: `custom_${Date.now()}`, label: `Cohorte custom ${n}`, internal_name: "", api_name: "" }]);
  }

  function removeRow(key: string) {
    setRows((r) => r.filter((x) => x.key !== key));
    setStatus((prev) => ({ ...prev, [key]: undefined }));
  }

  /**
   * Vérifie dans le CRM connecté que les propriétés saisies existent (nom API,
   * puis libellé — comme le mapping des identifiants). Quand le nom API est
   * faux mais que le libellé correspond à une propriété existante, le nom API
   * trouvé est appliqué automatiquement. Retourne le statut + les noms
   * corrigés (clé = key), ou null si la vérification a échoué (réseau…).
   */
  async function verifyProperties(
    filled: CohortMapping[],
  ): Promise<{ status: CohortPropertyStatus; corrected: Record<string, string> } | null> {
    if (!hasCrm || filled.length === 0) return { status: {}, corrected: {} };
    try {
      const res = await fetch("/api/settings/hubspot-properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // objectType "any" : l'objet porteur d'un axe cohorte n'est pas connu
          // → recherche sur Contact / Entreprise / Deal.
          checks: filled.map((m) => ({ objectType: "any", name: m.api_name.trim(), label: m.internal_name.trim() })),
        }),
      });
      if (!res.ok) return null;
      const d = await res.json();
      const results = (d.results ?? []) as Array<{
        exists: boolean | null; label: string | null; suggestedName: string | null; foundObject: string | null;
      }>;
      const nextStatus: CohortPropertyStatus = {};
      const corrected: Record<string, string> = {};
      // Les résultats sont renvoyés dans le même ordre que les checks.
      filled.forEach((m, i) => {
        const r = results[i];
        if (!r) {
          nextStatus[m.key] = UNVERIFIED;
          return;
        }
        if (r.exists === false && r.suggestedName) {
          // Propriété retrouvée via son libellé → on applique son nom API.
          corrected[m.key] = r.suggestedName;
          nextStatus[m.key] = { exists: true, label: r.label, suggestedName: r.suggestedName, foundObject: r.foundObject };
        } else {
          nextStatus[m.key] = { exists: r.exists, label: r.label, suggestedName: null, foundObject: r.foundObject };
        }
      });
      setRows((prev) => prev.map((m) => (corrected[m.key] ? { ...m, api_name: corrected[m.key] } : m)));
      setStatus((prev) => ({ ...prev, ...nextStatus }));
      return { status: nextStatus, corrected };
    } catch {
      return null;
    }
  }

  async function save() {
    if (state === "checking" || state === "saving") return;
    setError(null);

    // On n'enregistre que les lignes renseignées (au moins un des deux noms).
    const mappings = rows.filter((m) => m.internal_name.trim() || m.api_name.trim() || !isStandard(m.key));

    // 1. Revold vérifie dans le CRM que les propriétés saisies existent bien —
    //    on n'enregistre pas un mapping qui pointe vers le vide.
    setState("checking");
    const filled = mappings.filter((m) => m.internal_name.trim() || m.api_name.trim());
    const verified = await verifyProperties(filled);
    if (verified) {
      const missing = filled
        .filter((m) => verified.status[m.key]?.exists === false)
        .map((m) => `« ${m.api_name.trim() || m.internal_name.trim()} » (${m.label})`);
      if (missing.length > 0) {
        setError(
          `Propriété${missing.length > 1 ? "s" : ""} introuvable${missing.length > 1 ? "s" : ""} dans le CRM : ${missing.join(", ")}. ` +
          "Vérifiez le nom API (ou saisissez le libellé affiché dans le CRM : Revold retrouvera le nom API), " +
          "ou créez d'abord la propriété dans le CRM, puis réenregistrez.",
        );
        setState("error");
        return;
      }
    }

    // 2. Enregistrement — les noms API corrigés par la vérification priment
    //    sur l'état local, qui peut ne pas avoir encore re-rendu.
    setState("saving");
    try {
      const payload = mappings.map((m) => (verified?.corrected[m.key] ? { ...m, api_name: verified.corrected[m.key] } : m));
      const res = await fetch("/api/cohort-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings: payload }),
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
      {!hasCrm && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Aucun CRM connecté : les propriétés ne peuvent pas être vérifiées. Connectez votre CRM pour que Revold
          contrôle leur existence avant enregistrement.
        </p>
      )}
      <div className="space-y-4">
        {rows.map((m) => {
          const st = status[m.key];
          return (
          <div key={m.key} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-2">
              {isStandard(m.key) ? (
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    {m.label}
                    {st?.exists === true && (
                      <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                        ✓ DANS LE CRM{st.foundObject ? ` · ${OBJECT_LABELS[st.foundObject] ?? st.foundObject}` : ""}
                      </span>
                    )}
                    {st?.exists === false && (
                      <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">⚠ ABSENTE DU CRM</span>
                    )}
                  </p>
                  {hintFor(m.key) && <p className="text-[11px] text-slate-400">{hintFor(m.key)}</p>}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    value={m.label}
                    onChange={(e) => patch(m.key, { label: e.target.value })}
                    placeholder="Nom de la cohorte custom"
                    className="w-64 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-800 outline-none focus:border-fuchsia-300"
                  />
                  {st?.exists === true && (
                    <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                      ✓ DANS LE CRM{st.foundObject ? ` · ${OBJECT_LABELS[st.foundObject] ?? st.foundObject}` : ""}
                    </span>
                  )}
                  {st?.exists === false && (
                    <span className="shrink-0 rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">⚠ ABSENTE DU CRM</span>
                  )}
                </div>
              )}
              {!isStandard(m.key) && (
                <button
                  type="button"
                  onClick={() => removeRow(m.key)}
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
                  className={`${field} ${st?.exists === false ? "border-rose-300" : ""}`}
                />
              </div>
            </div>
            {st?.exists === false && (
              <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] text-rose-700">
                Aucune propriété du CRM ne correspond à ce nom API ni à ce nom interne (recherche sur Contact,
                Entreprise et Deal). Vérifiez l&apos;orthographe, ou créez la propriété dans le CRM puis
                réenregistrez : Revold revérifiera avant d&apos;appliquer le mapping.
              </p>
            )}
          </div>
          );
        })}
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
          disabled={state === "checking" || state === "saving"}
          className="ml-auto rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {state === "checking" ? "Vérification CRM…" : state === "saving" ? "Enregistrement…" : "Enregistrer les cohortes"}
        </button>
        {state === "done" && <span className="text-xs font-semibold text-emerald-600">✓ Vérifié et enregistré</span>}
        {state === "error" && <span className="text-xs text-rose-500">{error}</span>}
      </div>
    </div>
  );
}
