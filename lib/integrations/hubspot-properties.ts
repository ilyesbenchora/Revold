// Vérification de l'existence d'une propriété HubSpot (ex : la propriété
// custom `siren` sur les companies, requise par le mapping des identifiants).
// Le lookup se fait par nom interne ; à défaut, on tente de retrouver la
// propriété par son libellé (celui affiché dans l'UI HubSpot) pour suggérer
// le bon nom interne au lieu d'un simple « n'existe pas ».

const VALID_OBJECTS = new Set(["companies", "contacts", "deals"]);

/** Nom interne HubSpot : lettres/chiffres/underscore uniquement. */
const INTERNAL_NAME_RE = /^[a-z0-9_]+$/i;

export type HubSpotPropertyCheckResult = {
  /** true = le nom interne existe · false = absent · null = invérifiable. */
  exists: boolean | null;
  /** Libellé réel de la propriété quand elle a été trouvée (par nom ou par libellé). */
  label: string | null;
  /** Nom interne retrouvé via le libellé quand le nom saisi n'existe pas. */
  suggestedName: string | null;
};

const UNVERIFIABLE: HubSpotPropertyCheckResult = { exists: null, label: null, suggestedName: null };
const NOT_FOUND: HubSpotPropertyCheckResult = { exists: false, label: null, suggestedName: null };

/** Comparaison de libellés : minuscules, sans accents, espaces normalisés. */
function normalizeLabel(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Vérifie qu'une propriété existe par son nom interne. Si le nom est absent ou
 * invalide (espaces/accents = probablement un libellé), tente de retrouver la
 * propriété par libellé (`labelHint`, puis le nom saisi) et suggère son nom interne.
 */
export async function checkHubSpotProperty(
  token: string | null,
  objectType: string,
  name: string,
  labelHint?: string,
): Promise<HubSpotPropertyCheckResult> {
  const trimmed = name.trim();
  if (!token || !VALID_OBJECTS.has(objectType) || (!trimmed && !labelHint?.trim())) return UNVERIFIABLE;

  // 1. Lookup direct par nom interne.
  if (trimmed && INTERNAL_NAME_RE.test(trimmed)) {
    try {
      const res = await fetch(
        `https://api.hubapi.com/crm/v3/properties/${objectType}/${encodeURIComponent(trimmed)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const d = await res.json().catch(() => null);
        return { exists: true, label: typeof d?.label === "string" ? d.label : null, suggestedName: null };
      }
      if (res.status !== 404) return UNVERIFIABLE;
    } catch {
      return UNVERIFIABLE;
    }
  }

  // 2. Introuvable par nom → recherche par libellé dans toutes les propriétés de l'objet.
  const wanted = [labelHint ?? "", trimmed].map(normalizeLabel).filter(Boolean);
  if (wanted.length === 0) return NOT_FOUND;
  try {
    const res = await fetch(`https://api.hubapi.com/crm/v3/properties/${objectType}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return NOT_FOUND;
    const d = await res.json().catch(() => null);
    const all = (d?.results ?? []) as Array<{ name?: string; label?: string }>;
    const found = all.find((p) => p.label && wanted.includes(normalizeLabel(p.label)));
    if (found?.name) return { exists: false, label: found.label ?? null, suggestedName: found.name };
  } catch {}
  return NOT_FOUND;
}

/** Objet HubSpot porteur de chaque identifiant canonique du mapping. */
export const CANONICAL_TO_HUBSPOT_OBJECT: Record<string, string> = {
  company_name: "companies",
  domain: "companies",
  siren: "companies",
  siret: "companies",
  vat_number: "companies",
  email: "contacts",
};
