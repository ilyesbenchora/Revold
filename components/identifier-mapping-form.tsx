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
  /** Objets CRM possibles pour ce champ — sélecteur affiché si > 1 choix. */
  objectChoices?: string[];
  defaultObject?: string;
};

type ProviderRow = {
  provider: string;
  label: string;
  icon: string;
  domain: string;
  identifiers: Identifier[];
};

type SavedMapping = { provider: string; canonical_field: string; provider_field: string; object_type?: string | null };

/** Libellés du sélecteur d'objet CRM. */
const OBJECT_LABELS: Record<string, string> = { contacts: "Contact", companies: "Entreprise", deals: "Deal" };

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
  custom_id: "companies",
  email: "contacts",
};

// IDs de rapprochement multiples côté CRM : custom_id, custom_id_2, custom_id_3…
// (un par outil relié au CRM — chaque paire CRM ↔ outil peut partager son propre code).
const isCustomIdKey = (key: string) => /^custom_id(_\d+)?$/.test(key);
const customIdRank = (key: string): number => {
  const m = /^custom_id_(\d+)$/.exec(key);
  return m ? Number(m[1]) : 1;
};

export function IdentifierMappingForm({
  rows,
  savedMappings,
  disabledProviders,
  hubspotPropertyStatus,
  allowExtraCustomIds = true,
}: {
  rows: ProviderRow[];
  savedMappings: SavedMapping[];
  /** Outils désactivés dans le mapping (bloc grisé, exclu des taux de rapprochement). */
  disabledProviders: string[];
  /** Statut initial (serveur) des propriétés custom HubSpot, clé = canonicalField. */
  hubspotPropertyStatus: HubSpotPropertyStatus;
  /** false = pas de bouton « + Ajouter un ID de rapprochement » (mapping restreint, ex : enrichissement). */
  allowExtraCustomIds?: boolean;
}) {
  const router = useRouter();
  // Mappings legacy « dates de contrat par objet » (deal_contract_*) : repris
  // dans contract_* avec l'objet Deal — et supprimés au prochain enregistrement.
  const legacyDealContract = savedMappings.filter(
    (m) => m.provider === "hubspot" && /^deal_contract_(start|end)$/.test(m.canonical_field) && m.provider_field?.trim(),
  );
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
    // IDs de rapprochement supplémentaires du CRM (custom_id_2…) : hors
    // catalogue, uniquement présents dans les mappings sauvegardés.
    for (const m of savedMappings) {
      if (m.provider === "hubspot" && /^custom_id_\d+$/.test(m.canonical_field)) {
        map[`hubspot__${m.canonical_field}`] = m.provider_field;
      }
    }
    // Legacy deal_contract_* → contract_* (objet Deal) si contract_* est vide.
    for (const m of legacyDealContract) {
      const target = m.canonical_field.replace("deal_", "");
      if (!map[`hubspot__${target}`]?.trim()) map[`hubspot__${target}`] = m.provider_field;
    }
    // Propriété introuvable à la vérification serveur : les deux champs restent
    // vides — le signalement n'arrive qu'à l'enregistrement (qui revérifie).
    for (const [field, st] of Object.entries(hubspotPropertyStatus)) {
      if (st?.exists === false) map[`hubspot__${field}`] = "";
    }
    return map;
  });
  // Objet CRM porteur de chaque champ (sélecteur) — clé = canonicalField.
  const [objects, setObjects] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    const hubspotRow = rows.find((r) => r.provider === "hubspot");
    for (const id of hubspotRow?.identifiers ?? []) {
      if (!id.objectChoices || id.objectChoices.length < 2) continue;
      const saved = savedMappings.find((m) => m.provider === "hubspot" && m.canonical_field === id.canonicalField);
      map[id.canonicalField] = saved?.object_type ?? id.defaultObject ?? id.objectChoices[0];
    }
    // IDs custom supplémentaires : même choix d'objet que leur mapping sauvegardé.
    for (const m of savedMappings) {
      if (m.provider === "hubspot" && /^custom_id_\d+$/.test(m.canonical_field)) {
        map[m.canonical_field] = m.object_type ?? "companies";
      }
    }
    // Legacy deal_contract_* → l'objet Deal.
    for (const m of legacyDealContract) {
      map[m.canonical_field.replace("deal_", "")] = "deals";
    }
    return map;
  });

  function updateObject(canonicalField: string, objectType: string) {
    setObjects((prev) => ({ ...prev, [canonicalField]: objectType }));
    // L'objet change → la vérification précédente ne vaut plus.
    setHsStatus((prev) => ({ ...prev, [canonicalField]: UNVERIFIED }));
    setSaved(false);
  }
  // Liste ordonnée des IDs de rapprochement du CRM (au moins custom_id).
  const [hubspotCustomIdKeys, setHubspotCustomIdKeys] = useState<string[]>(() => {
    const saved = savedMappings
      .filter((m) => m.provider === "hubspot" && isCustomIdKey(m.canonical_field))
      .map((m) => m.canonical_field);
    return [...new Set(["custom_id", ...saved])].sort((a, b) => customIdRank(a) - customIdRank(b));
  });
  // Clés retirées par l'utilisateur : envoyées vides à l'enregistrement pour
  // supprimer le mapping côté serveur.
  const [removedCustomIdKeys, setRemovedCustomIdKeys] = useState<string[]>([]);
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
  // Une propriété absente au chargement repart en « non vérifié » (champs vides,
  // pas de badge ni de message) : l'alerte n'apparaît qu'à l'enregistrement.
  const [hsStatus, setHsStatus] = useState<HubSpotPropertyStatus>(() => {
    const map: HubSpotPropertyStatus = {};
    for (const [field, st] of Object.entries(hubspotPropertyStatus)) {
      map[field] = st?.exists === false ? UNVERIFIED : st;
    }
    return map;
  });
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
   * Identifiants affichés pour un outil. Côté CRM, l'« ID de rapprochement »
   * unique du catalogue est déplié en autant de champs que d'IDs configurés
   * (custom_id, custom_id_2…) — le CRM étant relié à plusieurs outils, chaque
   * paire peut partager son propre code interne.
   */
  function expandIdentifiers(row: ProviderRow): Identifier[] {
    if (row.provider !== "hubspot") return row.identifiers;
    return row.identifiers.flatMap((id) => {
      if (id.canonicalField !== "custom_id") return [id];
      return hubspotCustomIdKeys.map((key, i) => ({
        ...id,
        canonicalField: key,
        label: i === 0 ? id.label : `${id.label} ${i + 1}`,
      }));
    });
  }

  function addCustomIdKey() {
    setHubspotCustomIdKeys((prev) => {
      const next = `custom_id_${Math.max(...prev.map(customIdRank), 1) + 1}`;
      setRemovedCustomIdKeys((rm) => rm.filter((k) => k !== next));
      return [...prev, next];
    });
    setSaved(false);
  }

  function removeCustomIdKey(key: string) {
    setHubspotCustomIdKeys((prev) => (prev.length > 1 ? prev.filter((k) => k !== key) : prev));
    setRemovedCustomIdKeys((prev) => [...new Set([...prev, key])]);
    setValues((prev) => ({ ...prev, [`hubspot__${key}`]: "" }));
    setLabels((prev) => ({ ...prev, [key]: "" }));
    setHsStatus((prev) => ({ ...prev, [key]: undefined }));
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
    const checks = expandIdentifiers(hubspotRow)
      .filter((id) => !id.native && id.canonicalField !== "external_id")
      .map((id) => ({
        canonicalField: id.canonicalField,
        // L'objet CHOISI par l'utilisateur prime — la vérification se fait
        // sur le bon objet (Contact / Entreprise / Deal).
        objectType: objects[id.canonicalField] ?? CANONICAL_TO_OBJECT[id.canonicalField] ?? "companies",
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
          const def = hubspotRow ? expandIdentifiers(hubspotRow).find((i) => i.canonicalField === field) : undefined;
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
    //    Un champ vidé est envoyé avec provider_field vide → le serveur supprime
    //    le mapping (sinon un ancien mapping resterait actif à la sync).
    const mappings: SavedMapping[] = [];
    for (const row of rows) {
      if (disabled.has(row.provider)) continue;
      for (const id of expandIdentifiers(row)) {
        if (id.native || id.canonicalField === "external_id") continue;
        const correctedName = row.provider === "hubspot" ? verified?.corrected[id.canonicalField] : undefined;
        const val = (correctedName ?? values[`${row.provider}__${id.canonicalField}`] ?? "").trim();
        mappings.push({
          provider: row.provider,
          canonical_field: id.canonicalField,
          provider_field: val,
          // Objet CRM choisi (sélecteur) — null pour les champs à objet unique.
          object_type: row.provider === "hubspot" ? (objects[id.canonicalField] ?? null) : null,
        });
      }
    }
    // IDs de rapprochement retirés : envoyés vides → le serveur supprime le mapping.
    for (const key of removedCustomIdKeys) {
      if (!hubspotCustomIdKeys.includes(key)) {
        mappings.push({ provider: "hubspot", canonical_field: key, provider_field: "", object_type: null });
      }
    }
    // Migration des anciens mappings « par objet » (deal_contract_*) : repris
    // dans contract_* + objet Deal — l'ancienne ligne est supprimée.
    for (const m of legacyDealContract) {
      mappings.push({ provider: "hubspot", canonical_field: m.canonical_field, provider_field: "", object_type: null });
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
        const shown = expandIdentifiers(row).filter((id) => id.canonicalField !== "external_id");
        // Natifs (1 champ, courts) et customs (2 champs HubSpot, hauts) dans des
        // grilles séparées : une même ligne de grille ne mélange plus les deux
        // hauteurs (sinon grand vide sous les champs courts).
        const nativeIds = shown.filter((id) => id.native);
        const customIds = shown.filter((id) => !id.native);

        const renderIdentifier = (id: Identifier) => {
          const isHsCustom = isHubSpot && !id.native;
          const status = isHsCustom ? hsStatus[id.canonicalField] : undefined;
          // Sélecteur d'objet CRM (Contact / Entreprise / Deal) : la propriété
          // est vérifiée et collectée sur l'objet choisi — une seule ligne par
          // champ au lieu d'une par objet.
          const objectChoices = isHubSpot ? (id.objectChoices ?? []) : [];
          const selectedObject =
            objects[id.canonicalField] ?? id.defaultObject ?? objectChoices[0] ?? "companies";
          // ID de rapprochement du CRM : supprimable dès qu'il y en a plusieurs.
          const removable = isHubSpot && isCustomIdKey(id.canonicalField) && hubspotCustomIdKeys.length > 1;
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
                {removable && (
                  <button
                    type="button"
                    onClick={() => removeCustomIdKey(id.canonicalField)}
                    className="ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    title="Retirer cet ID de rapprochement"
                    aria-label={`Retirer ${id.label}`}
                  >
                    ✕ Retirer
                  </button>
                )}
              </label>
              {isHsCustom ? (
                // Propriété custom HubSpot : libellé (celui affiché dans HubSpot)
                // et nom interne (celui utilisé par l'API) sont deux choses
                // distinctes — deux champs pour éviter toute confusion.
                <div className="mt-1 space-y-2">
                  {objectChoices.length > 1 && (
                    <div>
                      <p className="text-[10px] font-medium text-slate-400">Objet HubSpot porteur de la propriété</p>
                      <select
                        value={selectedObject}
                        onChange={(e) => updateObject(id.canonicalField, e.target.value)}
                        className={`${inputClass} mt-0.5`}
                      >
                        {objectChoices.map((obj) => (
                          <option key={obj} value={obj}>
                            {OBJECT_LABELS[obj] ?? obj}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
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
            </div>
          );
        };

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
                <div className="space-y-4">
                  {nativeIds.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{nativeIds.map(renderIdentifier)}</div>
                  )}
                  {customIds.length > 0 && (
                    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">{customIds.map(renderIdentifier)}</div>
                  )}
                </div>
                {/* Un seul CTA : « Enregistrer le mapping » vérifie les propriétés
                       dans HubSpot puis enregistre — pas de bouton de vérification
                       séparé. */}
                {isHubSpot && allowExtraCustomIds && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={addCustomIdKey}
                      className="text-xs font-medium text-accent hover:underline"
                      title="Le CRM peut partager un code différent avec chaque outil relié"
                    >
                      + Ajouter un ID de rapprochement (autre outil)
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
