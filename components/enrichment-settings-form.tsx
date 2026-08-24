"use client";

import { SettingsSaveButton } from "@/components/settings-edit-lock";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ENRICHMENT_FIELD_LABELS,
  type EnrichmentFields,
  type EnrichmentSettings,
} from "@/lib/enrichment/settings";

/**
 * Paramètres → Enrichissement : quels champs Revold remplit (nb employés, CA,
 * SIREN, SIRET, TVA, secteur, statut juridique, capital, adresse…), la
 * recherche par SIREN/SIRET dans la barre HubSpot, et la source LinkedIn (bêta).
 *
 * Cette page ENREGISTRE les réglages, rien de plus : l'enrichissement (et la
 * synchronisation CRM) se LANCE depuis la page Enrichissement — bloc
 * « ✦ Nouveaux champs à enrichir » et CTA « Enrichir mon CRM ».
 * La règle « JAMAIS écraser une donnée existante du CRM » est structurelle :
 * non désactivable.
 */
export function EnrichmentSettingsForm({
  initial,
  fieldVerified = null,
}: {
  initial: EnrichmentSettings;
  /**
   * Vérification de la propriété CRM cible de chaque champ (bloc « Propriétés
   * CRM de l'enrichissement ») : un champ n'est cochable QUE si sa propriété
   * est vérifiée (✓ dans le CRM). null = HubSpot non connecté → pas de gate.
   */
  fieldVerified?: Partial<Record<keyof EnrichmentFields, boolean>> | null;
}) {
  const [fields, setFields] = useState<EnrichmentFields>(initial.fields);
  const isVerified = (id: keyof EnrichmentFields): boolean =>
    fieldVerified === null || fieldVerified[id] === true;
  const [hubspotSearchIds, setHubspotSearchIds] = useState(initial.hubspotSearchIds);
  const [linkedinEnabled, setLinkedinEnabled] = useState(initial.linkedinEnabled);
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [savedNewFields, setSavedNewFields] = useState(false);

  // Bandeau « jamais écraser » masquable : la garantie reste vraie (et
  // rappelée dans les libellés), seul le rappel visuel se range. Préférence
  // locale au poste — rendue après montage pour éviter tout écart d'hydratation.
  const [showGuarantee, setShowGuarantee] = useState(false);
  useEffect(() => {
    // Lecture localStorage impossible au rendu serveur : l'état ne peut être
    // posé qu'après montage (faux → vrai si non masqué), d'où le setState ici.
    let dismissed = false;
    try {
      dismissed = localStorage.getItem("revold.enrichment.guarantee.dismissed") === "1";
    } catch {
      dismissed = false;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowGuarantee(!dismissed);
  }, []);
  function dismissGuarantee() {
    setShowGuarantee(false);
    try {
      localStorage.setItem("revold.enrichment.guarantee.dismissed", "1");
    } catch {
      /* stockage local indisponible : masqué pour la session */
    }
  }

  /** Enregistre — retourne false en cas d'échec (le verrou reste en édition). */
  async function save(): Promise<boolean> {
    setState("saving");
    setError(null);
    try {
      // Un champ dont la propriété CRM n'est pas vérifiée ne peut PAS rester
      // actif (nettoie aussi un réglage antérieur au verrou, ex : secteur
      // coché alors que sa propriété n'a jamais été validée).
      const sanitized = Object.fromEntries(
        (Object.entries(fields) as Array<[keyof EnrichmentFields, boolean]>).map(([id, v]) => [id, v && isVerified(id)]),
      ) as EnrichmentFields;
      const res = await fetch("/api/enrichment-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: sanitized, hubspot_search_ids: hubspotSearchIds, linkedin_enabled: linkedinEnabled }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Enregistrement impossible.");
        setState("error");
        return false;
      }
      const d = await res.json().catch(() => ({}));
      setSavedNewFields(Array.isArray(d.requeuedFields) && d.requeuedFields.length > 0);
      setState("done");
      return true;
    } catch {
      setError("Enregistrement impossible.");
      setState("error");
    }
    return false;
  }

  return (
    <div className="card p-6">
      {/* Règle structurelle (non désactivable) — seul le RAPPEL visuel est masquable */}
      {showGuarantee && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <span aria-hidden className="mt-0.5">🛡️</span>
          <p className="min-w-0 flex-1 text-sm text-emerald-800">
            <strong>Revold n&apos;écrase jamais une donnée existante de ton CRM.</strong> L&apos;enrichissement ne
            remplit que les champs <em>vides</em> des fiches entreprises — chez Revold comme dans HubSpot. Ce
            comportement est garanti, il ne se désactive pas.
          </p>
          <button
            type="button"
            onClick={dismissGuarantee}
            className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100"
            title="La garantie reste active — seul ce rappel est masqué"
          >
            Ne plus afficher
          </button>
        </div>
      )}

      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Champs à enrichir</p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ENRICHMENT_FIELD_LABELS.map((f) => {
          const verified = isVerified(f.id);
          const checked = fields[f.id] && verified;
          return (
            <label
              key={f.id}
              className={`flex items-start gap-2.5 rounded-xl border p-3 transition ${
                !verified
                  ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-75"
                  : checked
                    ? "cursor-pointer border-fuchsia-200 bg-fuchsia-50/40"
                    : "cursor-pointer border-slate-200 bg-white hover:bg-slate-50"
              }`}
              title={verified ? undefined : "Propriété CRM cible non vérifiée — valide-la d'abord dans « Propriétés CRM de l'enrichissement » ci-dessous."}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={!verified}
                onChange={(e) => setFields((prev) => ({ ...prev, [f.id]: e.target.checked }))}
                className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 accent-fuchsia-500 disabled:cursor-not-allowed"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800">{f.label}</span>
                <span className="block text-[11px] text-slate-400">{f.hint}</span>
                {!verified && (
                  <span className="mt-1 block text-[10px] font-medium text-amber-600">
                    ⚠ Propriété CRM non vérifiée — valide-la dans « Propriétés CRM de l&apos;enrichissement » ci-dessous pour activer ce champ.
                  </span>
                )}
              </span>
            </label>
          );
        })}
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
              deviennent retrouvables en tapant leur SIREN ou SIRET dans la recherche HubSpot. Appliqué au prochain
              enrichissement lancé depuis la page Enrichissement.
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
              Source LinkedIn pour l&apos;effectif <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Bêta</span>
            </span>
            <span className="block text-[11px] text-slate-400">
              Complète l&apos;effectif quand le registre officiel ne le publie pas — suivi dans son propre bloc sur la
              page Enrichissement. Utilise la connexion LinkedIn de l&apos;organisation (Paramètres → Intégrations).
            </span>
          </span>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {/* CTA UNIQUE : « ✎ Modifier » (verrouillé) ↔ « Enregistrer ». */}
        <SettingsSaveButton
          label={state === "saving" ? "Enregistrement…" : "Enregistrer"}
          busy={state === "saving"}
          onSave={save}
        />
        {state === "done" && (
          <span className="text-xs font-semibold text-emerald-600">
            ✓ Enregistré —{" "}
            {savedNewFields ? (
              <>
                lance l&apos;enrichissement des nouveaux champs depuis la{" "}
                <Link href="/dashboard/enrichissement" className="underline">page Enrichissement</Link>.
              </>
            ) : (
              <>appliqué aux prochains passages du moteur.</>
            )}
          </span>
        )}
        {state === "error" && <span className="text-xs text-rose-500">{error}</span>}
      </div>
    </div>
  );
}
