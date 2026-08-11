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

/** true = propriété présente dans HubSpot · false = absente · null/undefined = invérifiable. */
export type HubSpotPropertyStatus = Record<string, boolean | null>;

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
    if (provider === "hubspot") setHsStatus((prev) => ({ ...prev, [canonicalField]: null }));
    setSaved(false);
  }

  /** Vérifie dans HubSpot les propriétés custom actuellement saisies. */
  async function verifyHubSpotProperties(): Promise<HubSpotPropertyStatus | null> {
    const hubspotRow = rows.find((r) => r.provider === "hubspot");
    if (!hubspotRow) return {};
    const checks = hubspotRow.identifiers
      .filter((id) => !id.native && id.canonicalField !== "external_id")
      .map((id) => ({
        canonicalField: id.canonicalField,
        objectType: CANONICAL_TO_OBJECT[id.canonicalField] ?? "companies",
        name: (values[`hubspot__${id.canonicalField}`] ?? "").trim(),
      }))
      .filter((c) => c.name);
    if (checks.length === 0) return {};
    setChecking(true);
    try {
      const res = await fetch("/api/settings/hubspot-properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checks: checks.map(({ objectType, name }) => ({ objectType, name })) }),
      });
      if (!res.ok) return null;
      const d = await res.json();
      const results = (d.results ?? []) as Array<{ name: string; exists: boolean | null }>;
      const next: HubSpotPropertyStatus = {};
      for (const c of checks) {
        const r = results.find((x) => x.name === c.name);
        next[c.canonicalField] = r?.exists ?? null;
      }
      setHsStatus((prev) => ({ ...prev, ...next }));
      return next;
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
      const missing = Object.entries(verified)
        .filter(([, exists]) => exists === false)
        .map(([field]) => {
          const def = hubspotRow?.identifiers.find((i) => i.canonicalField === field);
          return `« ${values[`hubspot__${field}`]} » (${def?.label ?? field})`;
        });
      if (missing.length > 0) {
        setError(
          `Propriété${missing.length > 1 ? "s" : ""} introuvable${missing.length > 1 ? "s" : ""} dans HubSpot : ${missing.join(", ")}. ` +
          "Créez-la d'abord dans HubSpot (Paramètres → Propriétés → Entreprises), puis saisissez son nom exact ici et réenregistrez.",
        );
        setSaving(false);
        return;
      }
    }

    // 2. Enregistrement du mapping (champs non natifs uniquement, outils actifs uniquement).
    const mappings: SavedMapping[] = [];
    for (const row of rows) {
      if (disabled.has(row.provider)) continue;
      for (const id of row.identifiers) {
        if (id.native || id.canonicalField === "external_id") continue;
        const val = values[`${row.provider}__${id.canonicalField}`];
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
                    const status = isHubSpot && !id.native ? hsStatus[id.canonicalField] : undefined;
                    return (
                      <div key={id.canonicalField}>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
                          {id.label}
                          {id.native ? (
                            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">NATIF</span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">CUSTOM</span>
                          )}
                          {status === true && (
                            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">✓ DANS LE CRM</span>
                          )}
                          {status === false && (
                            <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">⚠ ABSENTE DU CRM</span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={values[`${row.provider}__${id.canonicalField}`] ?? id.defaultProviderField}
                          onChange={(e) => update(row.provider, id.canonicalField, e.target.value)}
                          className={`${inputClass} mt-1 ${status === false ? "border-rose-300" : ""}`}
                          readOnly={id.native}
                        />
                        <p className="mt-0.5 text-[10px] text-slate-400">{id.hint}</p>
                        {status === false && (
                          <p className="mt-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] text-rose-700">
                            Cette propriété n&apos;existe pas dans HubSpot. Créez-la (HubSpot → Paramètres →
                            Propriétés → Entreprises), puis saisissez son nom exact ici et enregistrez :
                            Revold revérifiera avant d&apos;appliquer le mapping.
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
