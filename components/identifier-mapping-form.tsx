"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";

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
  domain: string;
  identifiers: Identifier[];
};

type SavedMapping = { provider: string; canonical_field: string; provider_field: string };

/** État de vérification d'une propriété custom HubSpot du mapping. */
export type HubSpotPropertyState = {
  /** true = présente dans HubSpot · false = absente · null = invérifiable. */
  exists: boolean | null;
  /** Libellé réel de la propriété quand elle a été trouvée. */
  label: string | null;
  /** Nom interne retrouvé via le libellé quand le nom saisi n'existait pas. */
  suggestedName: string | null;
};

/** Statut par identifiant canonique (clé = canonicalField). */
export type HubSpotPropertyStatus = Record<string, HubSpotPropertyState | undefined>;

const UNVERIFIED: HubSpotPropertyState = { exists: null, label: null, suggestedName: null };

const inputClass = "w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

// Objet HubSpot porteur de chaque identifiant canonique (côté client, pour les checks).
const CANONICAL_TO_OBJECT: Record<string, string> = {
  company_name: "companies",
  domain: "companies",
  siren: "companies",
  siret: "companies",
  vat_number: "companies",
  email: "contacts",
};

export function IdentifierMappingForm({
  rows,
  savedMappings,
  disabledProviders,
  hubspotPropertyStatus,
}: {
  rows: ProviderRow[];
  savedMappings: SavedMapping[];
  /** Outils désactivés dans le mapping (bloc grisé, exclu des taux de rapprochement). */
  disabledProviders: string[];
  /** Statut initial (serveur) des propriétés custom HubSpot, clé = canonicalField. */
  hubspotPropertyStatus: HubSpotPropertyStatus;
}) {
  const router = useRouter();
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
  // Libellés HubSpot (champ d'aide) — pré-remplis avec le libellé réel quand la
  // vérification serveur a trouvé la propriété.
  const [labels, setLabels] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const [field, st] of Object.entries(hubspotPropertyStatus)) {
      if (st?.label) map[field] = st.label;
    }
    return map;
  });
  const [disabled, setDisabled] = useState<Set<string>>(() => new Set(disabledProviders));
  const [hsStatus, setHsStatus] = useState<HubSpotPropertyStatus>(hubspotPropertyStatus);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingProvider, setTogglingProvider] = useState<string | null>(null);

  function update(provider: string, canonicalField: string, value: string) {
    setValues((prev) => ({ ...prev, [`${provider}__${canonicalField}`]: value }));
    // La valeur a changé : le statut vérifié ne vaut plus pour ce champ.
    if (provider === "hubspot") setHsStatus((prev) => ({ ...prev, [canonicalField]: UNVERIFIED }));
    setSaved(false);
  }

  function updateLabel(canonicalField: string, value: string) {
    setLabels((prev) => ({ ...prev, [canonicalField]: value }));
    setHsStatus((prev) => ({ ...prev, [canonicalField]: UNVERIFIED }));
    setSaved(false);
  }

  /**
   * Vérifie dans HubSpot les propriétés custom saisies (par nom interne, puis
   * par libellé). Quand le nom interne est faux mais que le libellé correspond
   * à une propriété existante, le nom interne trouvé est appliqué automatiquement.
   * Retourne le statut + les noms corrigés (clé = canonicalField), ou null si
   * la vérification a échoué (réseau…).
   */
  async function verifyHubSpotProperties(): Promise<{ status: HubSpotPropertyStatus; corrected: Record<string, string> } | null> {
    const hubspotRow = rows.find((r) => r.provider === "hubspot");
    if (!hubspotRow) return { status: {}, corrected: {} };
    const checks = hubspotRow.identifiers
      .filter((id) => !id.native && id.canonicalField !== "external_id")
      .map((id) => ({
        canonicalField: id.canonicalField,
        objectType: CANONICAL_TO_OBJECT[id.canonicalField] ?? "companies",
        name: (values[`hubspot__${id.canonicalField}`] ?? "").trim(),
        label: (labels[id.canonicalField] ?? "").trim(),
      }))
      .filter((c) => c.name || c.label);
    if (checks.length === 0) return { status: {}, corrected: {} };
    setChecking(true);
    try {
      const res = await fetch("/api/settings/hubspot-properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checks: checks.map(({ objectType, name, label }) => ({ objectType, name, label })) }),
      });
      if (!res.ok) return null;
      const d = await res.json();
      const results = (d.results ?? []) as Array<{ exists: boolean | null; label: string | null; suggestedName: string | null }>;
      const status: HubSpotPropertyStatus = {};
      const corrected: Record<string, string> = {};
      const nextLabels: Record<string, string> = {};
      // Les résultats sont renvoyés dans le même ordre que les checks.
      checks.forEach((c, i) => {
        const r = results[i];
        if (!r) {
          status[c.canonicalField] = UNVERIFIED;
          return;
        }
        if (r.exists === false && r.suggestedName) {
          // Propriété retrouvée via son libellé → on applique son nom interne.
          corrected[c.canonicalField] = r.suggestedName;
          status[c.canonicalField] = { exists: true, label: r.label, suggestedName: r.suggestedName };
        } else {
          status[c.canonicalField] = { exists: r.exists, label: r.label, suggestedName: null };
        }
        if (r.label) nextLabels[c.canonicalField] = r.label;
      });
      setValues((prev) => {
        const next = { ...prev };
        for (const [field, name] of Object.entries(corrected)) next[`hubspot__${field}`] = name;
        return next;
      });
      setLabels((prev) => ({ ...prev, ...nextLabels }));
      setHsStatus((prev) => ({ ...prev, ...status }));
      return { status, corrected };
    } catch {
      return null;
    } finally {
      setChecking(false);
    }
  }

  async function toggleProvider(provider: string) {
    if (togglingProvider) return;
    const nextEnabled = disabled.has(provider);
    setTogglingProvider(provider);
    try {
      const res = await fetch("/api/settings/mapping-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, enabled: nextEnabled }),
      });
      if (res.ok) {
        setDisabled((prev) => {
          const next = new Set(prev);
          if (nextEnabled) next.delete(provider);
          else next.add(provider);
          return next;
        });
        // Les taux de rapprochement du bloc « Règles de résolution » suivent l'activation.
        router.refresh();
      }
    } finally {
      setTogglingProvider(null);
    }
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError(null);

    // 1. Revold vérifie dans le CRM que les propriétés custom saisies existent
    //    bien — on n'enregistre pas un mapping qui pointe vers le vide.
    const verified = await verifyHubSpotProperties();
    if (verified) {
      const hubspotRow = rows.find((r) => r.provider === "hubspot");
      const missing = Object.entries(verified.status)
        .filter(([, st]) => st?.exists === false)
        .map(([field]) => {
          const def = hubspotRow?.identifiers.find((i) => i.canonicalField === field);
          const typed = (values[`hubspot__${field}`] ?? "").trim() || (labels[field] ?? "").trim();
          return `« ${typed} » (${def?.label ?? field})`;
        });
      if (missing.length > 0) {
        setError(
          `Propriété${missing.length > 1 ? "s" : ""} introuvable${missing.length > 1 ? "s" : ""} dans HubSpot : ${missing.join(", ")}. ` +
          "Créez-la d'abord dans HubSpot (Paramètres → Propriétés → Entreprises), puis saisissez son nom interne exact " +
          "(ou son libellé : Revold retrouvera le nom interne) et réenregistrez.",
        );
        setSaving(false);
        return;
      }
    }

    // 2. Enregistrement du mapping (champs non natifs uniquement, outils actifs uniquement).
    //    Les noms internes corrigés par la vérification (retrouvés via le libellé)
    //    priment sur l'état local, qui peut ne pas avoir encore re-rendu.
    const mappings: SavedMapping[] = [];
    for (const row of rows) {
      if (disabled.has(row.provider)) continue;
      for (const id of row.identifiers) {
        if (id.native || id.canonicalField === "external_id") continue;
        const correctedName = row.provider === "hubspot" ? verified?.corrected[id.canonicalField] : undefined;
        const val = correctedName ?? values[`${row.provider}__${id.canonicalField}`];
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
      else setError("Échec de l'enregistrement du mapping.");
    } catch {
      setError("Échec de l'enregistrement du mapping.");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const isHubSpot = row.provider === "hubspot";
        const isDisabled = disabled.has(row.provider);
        return (
          <div key={row.provider} className={`card p-5 transition ${isDisabled ? "opacity-50 grayscale" : ""}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <BrandLogo domain={row.domain} alt={row.label} fallback={row.icon} size={32} />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                  <p className="text-[10px] text-slate-400">
                    {row.provider}
                    {isHubSpot && " · CRM pivot du modèle de données"}
                  </p>
                </div>
              </div>
              {/* Le CRM pivot ne se désactive pas : c'est la référence du rapprochement. */}
              {!isHubSpot && (
                <button
                  type="button"
                  onClick={() => toggleProvider(row.provider)}
                  disabled={togglingProvider === row.provider}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                    isDisabled ? "bg-slate-300" : "bg-emerald-500"
                  } ${togglingProvider === row.provider ? "opacity-60" : "cursor-pointer"}`}
                  title={isDisabled ? "Activer cet outil dans le mapping" : "Désactiver cet outil du mapping"}
                >
                  <span className={`mt-0.5 inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    isDisabled ? "translate-x-0.5" : "translate-x-5"
                  }`} />
                </button>
              )}
            </div>

            {isDisabled ? (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                Outil désactivé du mapping — ses enregistrements ne sont plus comptés dans les taux de
                rapprochement. Réactivez-le pour le réintégrer au modèle de données.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {row.identifiers.filter((id) => id.canonicalField !== "external_id").map((id) => {
                    const isHsCustom = isHubSpot && !id.native;
                    const status = isHsCustom ? hsStatus[id.canonicalField] : undefined;
                    return (
                      <div key={id.canonicalField}>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
                          {id.label}
                          {id.native ? (
                            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">NATIF</span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">CUSTOM</span>
                          )}
                          {status?.exists === true && (
                            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">✓ DANS LE CRM</span>
                          )}
                          {status?.exists === false && (
                            <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">⚠ ABSENTE DU CRM</span>
                          )}
                        </label>
                        {isHsCustom ? (
                          // Propriété custom HubSpot : libellé (celui affiché dans HubSpot)
                          // et nom interne (celui utilisé par l'API) sont deux choses
                          // distinctes — deux champs pour éviter toute confusion.
                          <div className="mt-1 space-y-2">
                            <div>
                              <p className="text-[10px] font-medium text-slate-400">Nom de la propriété (libellé affiché dans HubSpot)</p>
                              <input
                                type="text"
                                value={labels[id.canonicalField] ?? ""}
                                onChange={(e) => updateLabel(id.canonicalField, e.target.value)}
                                placeholder="ex : Numéro de TVA"
                                className={`${inputClass} mt-0.5`}
                              />
                            </div>
                            <div>
                              <p className="text-[10px] font-medium text-slate-400">Nom interne (utilisé par l&apos;API — minuscules, sans espaces ni accents)</p>
                              <input
                                type="text"
                                value={values[`${row.provider}__${id.canonicalField}`] ?? id.defaultProviderField}
                                onChange={(e) => update(row.provider, id.canonicalField, e.target.value)}
                                placeholder="ex : numero_de_tva"
                                className={`${inputClass} mt-0.5 font-mono ${status?.exists === false ? "border-rose-300" : ""}`}
                              />
                            </div>
                            <p className="text-[10px] text-slate-400">
                              {id.hint} — le nom interne est visible dans HubSpot via l&apos;icône <code className="rounded bg-slate-100 px-1">&lt;/&gt;</code> de
                              la propriété. En cas de doute, saisissez le libellé : Revold retrouvera le nom interne à la vérification.
                            </p>
                          </div>
                        ) : (
                          <>
                            <input
                              type="text"
                              value={values[`${row.provider}__${id.canonicalField}`] ?? id.defaultProviderField}
                              onChange={(e) => update(row.provider, id.canonicalField, e.target.value)}
                              className={`${inputClass} mt-1`}
                              readOnly={id.native}
                            />
                            <p className="mt-0.5 text-[10px] text-slate-400">{id.hint}</p>
                          </>
                        )}
                        {status?.exists === false && (
                          <p className="mt-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] text-rose-700">
                            Aucune propriété HubSpot ne correspond à ce nom interne ni à ce libellé. Créez-la
                            (HubSpot → Paramètres → Propriétés → Entreprises), puis saisissez son libellé ou son
                            nom interne ici et enregistrez : Revold revérifiera avant d&apos;appliquer le mapping.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                {isHubSpot && (
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => verifyHubSpotProperties()}
                      disabled={checking}
                      className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
                    >
                      {checking ? "Vérification…" : "Revérifier les propriétés dans HubSpot"}
                    </button>
                  </div>
                )}
                {row.identifiers.some((id) => id.canonicalField === "external_id") && (
                  <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[10px] text-slate-500">
                      <span className="font-semibold">ID externe</span> : géré automatiquement par Revold via <code className="rounded bg-white px-1">source_links</code>.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5">
          <p className="text-xs font-medium text-rose-700">{error}</p>
        </div>
      )}
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-xs font-medium text-emerald-600">✓ Enregistré — propriétés vérifiées dans le CRM</span>}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? (checking ? "Vérification CRM..." : "Enregistrement...") : "Enregistrer le mapping"}
        </button>
      </div>
    </div>
  );
}
