// Vérification de l'existence d'une propriété HubSpot (ex : la propriété
// custom `siren` sur les companies, requise par le mapping des identifiants).

const VALID_OBJECTS = new Set(["companies", "contacts", "deals"]);

/**
 * true = la propriété existe · false = absente (404) · null = invérifiable
 * (pas de token, erreur réseau ou nom/objet invalide).
 */
export async function checkHubSpotProperty(
  token: string | null,
  objectType: string,
  name: string,
): Promise<boolean | null> {
  if (!token || !VALID_OBJECTS.has(objectType) || !name.trim()) return null;
  // Nom de propriété HubSpot : lettres/chiffres/underscore uniquement.
  if (!/^[a-z0-9_]+$/i.test(name.trim())) return false;
  try {
    const res = await fetch(
      `https://api.hubapi.com/crm/v3/properties/${objectType}/${encodeURIComponent(name.trim())}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.ok) return true;
    if (res.status === 404) return false;
    return null;
  } catch {
    return null;
  }
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
