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
type PropertyStatus = {
  name: string;
  label: string;
  status: "exists" | "created" | "no_scope" | "error";
  uniqueValue: boolean;
};

export function EnrichmentSettingsForm({ initial }: { initial: EnrichmentSettings }) {
  const [fields, setFields] = useState<EnrichmentFields>(initial.fields);
  const [hubspotSearchIds, setHubspotSearchIds] = useState(initial.hubspotSearchIds);
  const [linkedinEnabled, setLinkedinEnabled] = useState(initial.linkedinEnabled);
  const [state, setState] = useState<"idle" | "saving" | "pushing" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pushProgress, setPushProgress] = useState<{ done: number; total: number } | null>(null);
  const [pushSummary, setPushSummary] = useState<string | null>(null);
  const [propertyWarnings, setPropertyWarnings] = useState<string[]>([]);

  /**
   * Poussée immédiate des identifiants dans TOUTES les fiches HubSpot de la
   * base (par lots, champs vides uniquement) — sinon seules les entreprises
   * enrichies APRÈS l'activation seraient retrouvables dans la barre HubSpot.
   */
  async function pushIdsToHubSpot() {
    setState("pushing");
    setPushSummary(null);
    setPropertyWarnings([]);
    let cursor: string | null = null;
    let total = 0;
    let done = 0;
    let pushed = 0;
    let failed = 0;
    try {
      for (;;) {
        const res: Response = await fetch("/api/enrichment/push-hubspot-ids", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cursor }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setPushSummary(d.error ?? "Poussée HubSpot impossible.");
          return;
        }
        const d = await res.json();
        if (typeof d.total === "number") total = d.total;
        if (Array.isArray(d.properties)) {
          const warnings: string[] = [];
          for (const p of d.properties as PropertyStatus[]) {
            if (p.status === "no_scope") {
              warnings.push(
                `Impossible de créer la propriété « ${p.name} » dans HubSpot (droits insuffisants) : crée-la manuellement ` +
                `(Paramètres HubSpot → Propriétés → Entreprises, champ texte, « Exiger des valeurs uniques » cochée).`,
              );
            } else if (p.status === "error") {
              warnings.push(`La propriété « ${p.name} » n'a pas pu être vérifiée ni créée dans HubSpot.`);
            } else if (!p.uniqueValue) {
              warnings.push(
                `La propriété « ${p.name} » existe dans HubSpot mais sans valeurs uniques : la barre de recherche ne ` +
                `l'indexera pas. Ajoute-la aux propriétés cherchables (réglages de recherche HubSpot) ou recrée-la en unique.`,
              );
            }
          }
          setPropertyWarnings(warnings);
        }
        done += d.processed ?? 0;
        pushed += d.pushed ?? 0;
        failed += d.failed ?? 0;
        setPushProgress({ done, total });
        if (d.done || !d.nextCursor) break;
        cursor = d.nextCursor;
      }
      setPushSummary(
        `Identifiants poussés dans ${pushed} fiche${pushed > 1 ? "s" : ""} HubSpot (champs vides uniquement)` +
        (failed > 0 ? ` — ${failed} en échec, retentées aux prochains passages du moteur.` : "."),
      );
    } catch {
      setPushSummary("Poussée HubSpot interrompue — elle reprendra aux prochains passages du moteur.");
    } finally {
      setPushProgress(null);
    }
  }

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
      // Option active → application immédiate sur toute la base HubSpot.
      if (hubspotSearchIds) await pushIdsToHubSpot();
      setState("done");
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={save}
          disabled={state === "saving" || state === "pushing"}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {state === "saving" ? "Enregistrement…" : state === "pushing" ? "Poussée vers HubSpot…" : "Enregistrer"}
        </button>
        {state === "pushing" && pushProgress && (
          <span className="text-xs text-slate-500">
            {pushProgress.done}{pushProgress.total ? ` / ${pushProgress.total}` : ""} fiches HubSpot traitées…
          </span>
        )}
        {state === "done" && (
          <span className="text-xs font-semibold text-emerald-600">
            ✓ Enregistré{pushSummary ? ` — ${pushSummary}` : " — appliqué aux prochains passages du moteur"}
          </span>
        )}
        {state === "error" && <span className="text-xs text-rose-500">{error}</span>}
      </div>
      {propertyWarnings.length > 0 && (
        <div className="mt-3 space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          {propertyWarnings.map((w) => (
            <p key={w} className="text-xs leading-relaxed text-amber-800">⚠ {w}</p>
          ))}
        </div>
      )}
    </div>
  );
}
