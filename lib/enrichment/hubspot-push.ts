/**
 * Poussée des données d'enrichissement vers HubSpot (fiches companies) et
 * gestion des propriétés cibles (siren/siret/TVA). Partagé par le moteur de
 * backfill et la poussée immédiate déclenchée depuis Paramètres → Enrichissement.
 */

export async function pushHubspot(token: string, hsId: string, properties: Record<string, string>): Promise<boolean> {
  try {
    const res = await fetch(`https://api.hubapi.com/crm/v3/objects/companies/${hsId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ properties }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Push « JAMAIS écraser » : lit d'abord la fiche HubSpot et ne PATCH que les
 * propriétés VIDES — la donnée saisie par le client dans son CRM fait toujours
 * foi. En cas d'échec de lecture, on n'écrit rien (prudence > complétude).
 */
export async function pushHubspotIfEmpty(token: string, hsId: string, properties: Record<string, string>): Promise<boolean> {
  const keys = Object.keys(properties);
  if (keys.length === 0) return true;
  try {
    const res = await fetch(
      `https://api.hubapi.com/crm/v3/objects/companies/${hsId}?properties=${encodeURIComponent(keys.join(","))}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return false;
    const d = (await res.json()) as { properties?: Record<string, string | null> };
    const current = d.properties ?? {};
    const toWrite: Record<string, string> = {};
    for (const k of keys) {
      const v = current[k];
      if (v == null || String(v).trim() === "") toWrite[k] = properties[k];
    }
    if (Object.keys(toWrite).length === 0) return true;
    return pushHubspot(token, hsId, toWrite);
  } catch {
    return false;
  }
}

export type EnsurePropertyResult = {
  name: string;
  label: string;
  /** exists = déjà dans le portail · created = créée par Revold · no_scope = droits OAuth insuffisants. */
  status: "exists" | "created" | "no_scope" | "error";
  /**
   * Propriété « à valeurs uniques » : condition pour que la barre de recherche
   * globale HubSpot retrouve une fiche par cette valeur. Une propriété custom
   * ordinaire n'est PAS indexée par la recherche (sauf ajout manuel dans les
   * réglages de recherche du portail).
   */
  uniqueValue: boolean;
};

/**
 * Garantit qu'une propriété cible du push (siren/siret/TVA) existe sur l'objet
 * Company du portail. Absente → créée avec `hasUniqueValue: true` (10 max par
 * objet chez HubSpot) pour être cherchable dans la barre ; si la création
 * unique échoue (limite atteinte), retentée sans — la propriété reste
 * utilisable pour stocker, mais pas indexée par la recherche globale.
 */
export async function ensureHubSpotIdProperty(token: string, name: string, label: string): Promise<EnsurePropertyResult> {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  try {
    const res = await fetch(`https://api.hubapi.com/crm/v3/properties/companies/${encodeURIComponent(name)}`, { headers });
    if (res.ok) {
      const d = (await res.json()) as { hasUniqueValue?: boolean };
      return { name, label, status: "exists", uniqueValue: d.hasUniqueValue === true };
    }
    if (res.status === 403) return { name, label, status: "no_scope", uniqueValue: false };
    if (res.status !== 404) return { name, label, status: "error", uniqueValue: false };

    const create = (hasUniqueValue: boolean) =>
      fetch("https://api.hubapi.com/crm/v3/properties/companies", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name,
          label,
          type: "string",
          fieldType: "text",
          groupName: "companyinformation",
          hasUniqueValue,
        }),
      });
    let createRes = await create(true);
    if (createRes.ok) return { name, label, status: "created", uniqueValue: true };
    if (createRes.status === 403) return { name, label, status: "no_scope", uniqueValue: false };
    createRes = await create(false);
    if (createRes.ok) return { name, label, status: "created", uniqueValue: false };
    return { name, label, status: "error", uniqueValue: false };
  } catch {
    return { name, label, status: "error", uniqueValue: false };
  }
}
