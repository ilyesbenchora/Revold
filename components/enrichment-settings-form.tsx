"use client";

import { useState } from "react";
import {
  ENRICHMENT_FIELD_LABELS,
  type EnrichmentFields,
  type EnrichmentSettings,
} from "@/lib/enrichment/settings";

/**
 * Paramètres → Enrichissement : quels champs Revold remplit (nb employés, CA,
 * SIREN, SIRET, TVA, secteur d'activité), la recherche par SIREN/SIRET dans la
 * barre HubSpot, et la source LinkedIn (bêta). La règle « JAMAIS écraser une
 * donnée existante du CRM » est structurelle : non désactivable.
 */
export function EnrichmentSettingsForm({ initial }: { initial: EnrichmentSettings }) {
  const [fields, setFields] = useState<EnrichmentFields>(initial.fields);
  const [hubspotSearchIds, setHubspotSearchIds] = useState(initial.hubspotSearchIds);
  const [linkedinEnabled, setLinkedinEnabled] = useState(initial.linkedinEnabled);
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setState("saving");
    setError(null);
    try {
      const res = await fetch("/api/enrichment-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields, hubspot_search_ids: hubspotSearchIds, linkedin_enabled: linkedinEnabled }),
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
    <div className="card p-6">
      {/* Règle structurelle : mise en avant, non désactivable */}
      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <span aria-hidden className="mt-0.5">🛡️</span>
        <p className="text-sm text-emerald-800">
          <strong>Revold n&apos;écrase jamais une donnée existante de ton CRM.</strong> L&apos;enrichissement ne remplit
          que les champs <em>vides</em> des fiches entreprises — chez Revold comme dans HubSpot. Ce comportement est
          garanti, il ne se désactive pas.
        </p>
      </div>

      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Champs à enrichir</p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ENRICHMENT_FIELD_LABELS.map((f) => (
          <label
            key={f.id}
            className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${
              fields[f.id] ? "border-fuchsia-200 bg-fuchsia-50/40" : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <input
              type="checkbox"
              checked={fields[f.id]}
              onChange={(e) => setFields((prev) => ({ ...prev, [f.id]: e.target.checked }))}
              className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 accent-fuchsia-500"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-800">{f.label}</span>
              <span className="block text-[11px] text-slate-400">{f.hint}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-4">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={hubspotSearchIds}
            onChange={(e) => setHubspotSearchIds(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 accent-fuchsia-500"
          />
          <span>
            <span className="block text-sm font-medium text-slate-800">
              Recherche par SIREN / SIRET dans la barre HubSpot
            </span>
            <span className="block text-[11px] text-slate-400">
              Les identifiants enrichis sont écrits dans les fiches HubSpot (champs vides uniquement) — tes entreprises
              deviennent retrouvables en tapant leur SIREN ou SIRET dans la recherche HubSpot.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={linkedinEnabled}
            onChange={(e) => setLinkedinEnabled(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 accent-fuchsia-500"
          />
          <span>
            <span className="block text-sm font-medium text-slate-800">
              Source LinkedIn pour l&apos;effectif <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Bêta — bientôt</span>
            </span>
            <span className="block text-[11px] text-slate-400">
              Complètera l&apos;effectif quand le registre officiel ne le publie pas. Nécessite la connexion de
              l&apos;API LinkedIn — la préférence est enregistrée dès maintenant et s&apos;activera au branchement.
            </span>
          </span>
        </label>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={save}
          disabled={state === "saving"}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {state === "saving" ? "Enregistrement…" : "Enregistrer"}
        </button>
        {state === "done" && <span className="text-xs font-semibold text-emerald-600">✓ Enregistré — appliqué aux prochains passages du moteur</span>}
        {state === "error" && <span className="text-xs text-rose-500">{error}</span>}
      </div>
    </div>
  );
}
