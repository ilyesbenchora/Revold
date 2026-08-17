import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Réglages d'enrichissement (Paramètres → Enrichissement).
 * La règle « JAMAIS écraser une donnée existante du CRM » est structurelle :
 * le moteur ne remplit que les champs VIDES — elle ne se désactive pas.
 */
export type EnrichmentFields = {
  employees: boolean;
  revenue: boolean;
  siren: boolean;
  siret: boolean;
  vat: boolean;
  industry: boolean;
};

export type EnrichmentSettings = {
  fields: EnrichmentFields;
  /** Pousser SIREN/SIRET/TVA dans HubSpot → recherche par numéro dans la barre HubSpot. */
  hubspotSearchIds: boolean;
  /** Source LinkedIn (bêta) pour l'effectif. */
  linkedinEnabled: boolean;
};

export const DEFAULT_ENRICHMENT_SETTINGS: EnrichmentSettings = {
  fields: { employees: true, revenue: true, siren: true, siret: true, vat: true, industry: true },
  hubspotSearchIds: true,
  linkedinEnabled: false,
};

export const ENRICHMENT_FIELD_LABELS: { id: keyof EnrichmentFields; label: string; hint: string }[] = [
  { id: "siren", label: "SIREN", hint: "Identifiant officiel — la clé du rapprochement inter-outils" },
  { id: "siret", label: "SIRET (siège)", hint: "Identifie l'établissement" },
  { id: "vat", label: "N° TVA intracommunautaire", hint: "Calculé depuis le SIREN (clé fiscale déterministe)" },
  { id: "employees", label: "Nombre d'employés", hint: "Tranche officielle URSSAF/INSEE, datée" },
  { id: "revenue", label: "Chiffre d'affaires", hint: "Dernier exercice déposé à l'INPI" },
  { id: "industry", label: "Secteur d'activité", hint: "Code NAF/APE + libellé de section INSEE" },
];

/** Charge les réglages de l'org — résilient (table absente → défauts). */
export async function getEnrichmentSettings(sb: SupabaseClient, orgId: string): Promise<EnrichmentSettings> {
  try {
    const { data, error } = await sb
      .from("enrichment_settings")
      .select("fields, hubspot_search_ids, linkedin_enabled")
      .eq("organization_id", orgId)
      .maybeSingle();
    if (error || !data) return DEFAULT_ENRICHMENT_SETTINGS;
    const raw = (data.fields ?? {}) as Partial<Record<keyof EnrichmentFields, unknown>>;
    const fields = { ...DEFAULT_ENRICHMENT_SETTINGS.fields };
    for (const k of Object.keys(fields) as (keyof EnrichmentFields)[]) {
      if (typeof raw[k] === "boolean") fields[k] = raw[k] as boolean;
    }
    return {
      fields,
      hubspotSearchIds: data.hubspot_search_ids !== false,
      linkedinEnabled: data.linkedin_enabled === true,
    };
  } catch {
    return DEFAULT_ENRICHMENT_SETTINGS;
  }
}

/**
 * Registre administratif selon le pays de l'organisation : la France est
 * couverte (Sirene/INPI, gratuit) ; les autres pays affichent leur registre
 * cible, à brancher.
 */
export function registryForCountry(country: string | null | undefined): {
  supported: boolean;
  registry: string;
} {
  const c = (country ?? "FR").toUpperCase();
  const KNOWN: Record<string, { supported: boolean; registry: string }> = {
    FR: { supported: true, registry: "Base Sirene + comptes INPI (API Recherche d'Entreprises de l'État)" },
    BE: { supported: false, registry: "Banque-Carrefour des Entreprises (BCE)" },
    CH: { supported: false, registry: "Registre du commerce (Zefix)" },
    LU: { supported: false, registry: "Registre de Commerce et des Sociétés (RCS)" },
    DE: { supported: false, registry: "Handelsregister" },
    GB: { supported: false, registry: "Companies House" },
    US: { supported: false, registry: "Registres d'État (Secretary of State) — pas de registre fédéral unique" },
    CA: { supported: false, registry: "Corporations Canada / registres provinciaux" },
    ES: { supported: false, registry: "Registro Mercantil" },
    MA: { supported: false, registry: "OMPIC" },
  };
  return KNOWN[c] ?? { supported: false, registry: "Registre national non identifié" };
}

// ── Secteur d'activité : sections INSEE depuis le code NAF (division 2 chiffres) ──
const NAF_SECTIONS: Array<{ from: number; to: number; label: string }> = [
  { from: 1, to: 3, label: "Agriculture, sylviculture et pêche" },
  { from: 5, to: 9, label: "Industries extractives" },
  { from: 10, to: 33, label: "Industrie manufacturière" },
  { from: 35, to: 35, label: "Énergie" },
  { from: 36, to: 39, label: "Eau, assainissement, déchets" },
  { from: 41, to: 43, label: "Construction" },
  { from: 45, to: 47, label: "Commerce" },
  { from: 49, to: 53, label: "Transports et entreposage" },
  { from: 55, to: 56, label: "Hébergement et restauration" },
  { from: 58, to: 63, label: "Information et communication" },
  { from: 64, to: 66, label: "Activités financières et d'assurance" },
  { from: 68, to: 68, label: "Immobilier" },
  { from: 69, to: 75, label: "Activités spécialisées, scientifiques et techniques" },
  { from: 77, to: 82, label: "Services administratifs et de soutien" },
  { from: 84, to: 84, label: "Administration publique" },
  { from: 85, to: 85, label: "Enseignement" },
  { from: 86, to: 88, label: "Santé humaine et action sociale" },
  { from: 90, to: 93, label: "Arts, spectacles et activités récréatives" },
  { from: 94, to: 96, label: "Autres activités de services" },
  { from: 97, to: 98, label: "Activités des ménages" },
  { from: 99, to: 99, label: "Activités extraterritoriales" },
];

/** Libellé de section INSEE depuis un code NAF (« 62.01Z » → Information et communication). */
export function nafSectionLabel(nafCode: string | null | undefined): string | null {
  if (!nafCode) return null;
  const division = Number(String(nafCode).slice(0, 2));
  if (!Number.isFinite(division)) return null;
  return NAF_SECTIONS.find((s) => division >= s.from && division <= s.to)?.label ?? null;
}
