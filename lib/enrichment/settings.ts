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
  legalForm: boolean;
  shareCapital: boolean;
  headOfficeAddress: boolean;
};

export type EnrichmentSettings = {
  fields: EnrichmentFields;
  /** Pousser SIREN/SIRET/TVA dans HubSpot → recherche par numéro dans la barre HubSpot. */
  hubspotSearchIds: boolean;
  /** Source LinkedIn (bêta) pour l'effectif. */
  linkedinEnabled: boolean;
};

export const DEFAULT_ENRICHMENT_SETTINGS: EnrichmentSettings = {
  // Les trois derniers champs (statut juridique, capital social, adresse du
  // siège) sont OPT-IN : livrés décochés pour que les orgs déjà enrichies les
  // activent depuis Paramètres → Enrichissement (nouvelle passe ciblée).
  fields: {
    employees: true,
    revenue: true,
    siren: true,
    siret: true,
    vat: true,
    industry: true,
    legalForm: false,
    shareCapital: false,
    headOfficeAddress: false,
  },
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
  { id: "legalForm", label: "Statut juridique", hint: "Forme juridique officielle (nomenclature INSEE)" },
  { id: "shareCapital", label: "Capital social", hint: "Publié au RNE (INPI) — rempli quand disponible" },
  { id: "headOfficeAddress", label: "Adresse du siège social", hint: "Adresse officielle du siège (registre Sirene)" },
];

/**
 * Colonne `companies` qui matérialise chaque champ d'enrichissement — partagée
 * par les tuiles de couverture, l'état du moteur et la relance d'une passe
 * ciblée sur de nouveaux champs.
 */
export const ENRICHMENT_FIELD_COLUMNS: Record<keyof EnrichmentFields, string> = {
  siren: "siren",
  siret: "siret",
  vat: "vat_number",
  employees: "official_employee_range",
  revenue: "official_revenue",
  industry: "naf_code",
  legalForm: "legal_form",
  shareCapital: "share_capital",
  headOfficeAddress: "head_office_address",
};

/**
 * Propriétés HubSpot cibles des champs poussés dans le CRM (fiches Company).
 * `unique` → propriété à valeurs uniques (indexée par la barre de recherche).
 * Les canoniques siren/siret/vat_number restent surchargeables par le mapping
 * d'identifiants ; les nouvelles propriétés sont créées si absentes.
 */
export const ENRICHMENT_HUBSPOT_PROPERTIES: {
  field: keyof EnrichmentFields;
  canonical: string;
  fallback: string;
  label: string;
  unique: boolean;
}[] = [
  { field: "siren", canonical: "siren", fallback: "siren", label: "SIREN", unique: true },
  { field: "siret", canonical: "siret", fallback: "siret", label: "SIRET", unique: true },
  { field: "vat", canonical: "vat_number", fallback: "vat_number", label: "N° TVA intracommunautaire", unique: true },
  { field: "legalForm", canonical: "legal_form", fallback: "statut_juridique", label: "Statut juridique", unique: false },
  { field: "shareCapital", canonical: "share_capital", fallback: "capital_social", label: "Capital social", unique: false },
  {
    field: "headOfficeAddress",
    canonical: "head_office_address",
    fallback: "adresse_siege_social",
    label: "Adresse du siège social",
    unique: false,
  },
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

// ── Statut juridique : catégories juridiques INSEE (nature_juridique Sirene) ──
// Codes niveau III les plus fréquents ; repli sur le niveau I (1er chiffre)
// pour les codes rares — on affiche toujours un libellé honnête, jamais « ? ».
const LEGAL_FORMS: Record<string, string> = {
  "1000": "Entrepreneur individuel",
  "5202": "Société en nom collectif (SNC)",
  "5203": "Société en commandite simple",
  "5306": "Société en commandite par actions",
  "5410": "SARL nationale",
  "5426": "SARL de presse",
  "5498": "EURL (SARL unipersonnelle)",
  "5499": "SARL (société à responsabilité limitée)",
  "5505": "SA à participation ouvrière à conseil d'administration",
  "5510": "SA nationale à conseil d'administration",
  "5599": "SA à conseil d'administration",
  "5605": "SA à participation ouvrière à directoire",
  "5699": "SA à directoire",
  "5710": "SAS (société par actions simplifiée)",
  "5720": "SASU (SAS unipersonnelle)",
  "5785": "Société d'exercice libéral par actions simplifiée (SELAS)",
  "5800": "Société européenne",
  "6220": "Groupement d'intérêt économique (GIE)",
  "6316": "Coopérative d'utilisation de matériel agricole (CUMA)",
  "6533": "Groupement agricole d'exploitation en commun (GAEC)",
  "6540": "SCI (société civile immobilière)",
  "6558": "EARL (exploitation agricole à responsabilité limitée)",
  "6561": "SCEA (société civile d'exploitation agricole)",
  "6585": "Société civile de moyens (SCM)",
  "6589": "Société civile de placement collectif immobilier (SCPI)",
  "6595": "Société civile professionnelle (SCP)",
  "6599": "Société civile",
  "6901": "Autre personne de droit privé inscrite au RCS",
  "7112": "Autorité administrative ou publique indépendante",
  "7160": "Service déconcentré de l'État",
  "7210": "Commune",
  "7220": "Département",
  "7312": "Commune associée",
  "7346": "Communauté de communes",
  "7364": "Métropole",
  "7389": "Établissement public national à caractère administratif",
  "9110": "Syndicat de salariés",
  "9210": "Association non déclarée",
  "9220": "Association déclarée",
  "9230": "Association déclarée d'utilité publique",
  "9260": "Association de droit local (Alsace-Moselle)",
  "9300": "Fondation",
};

const LEGAL_FORM_LEVEL1: Record<string, string> = {
  "1": "Entrepreneur individuel",
  "2": "Groupement de droit privé non doté de la personnalité morale",
  "3": "Personne morale de droit étranger",
  "4": "Personne morale de droit public soumise au droit commercial",
  "5": "Société commerciale",
  "6": "Autre personne morale immatriculée au RCS",
  "7": "Personne morale de droit public",
  "8": "Organisme privé spécialisé",
  "9": "Groupement de droit privé (association, syndicat…)",
};

/** Libellé du statut juridique depuis le code nature_juridique Sirene (« 5710 » → SAS). */
export function legalFormLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  const c = String(code).trim();
  if (!c) return null;
  return LEGAL_FORMS[c] ?? LEGAL_FORM_LEVEL1[c[0]] ?? null;
}
