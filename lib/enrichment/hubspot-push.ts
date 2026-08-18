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
    if (res.ok) return true;
    // 400 = souvent UNE propriété inconnue du portail qui fait rejeter TOUT le
    // PATCH (c'est ainsi que des milliers de SIREN ne sont jamais arrivés dans
    // HubSpot). On filtre sur les propriétés réellement existantes et on
    // retente une fois — les données valides passent, la propriété manquante
    // sera créée au prochain passage de la vérification.
    if (res.status === 400) {
      const existing = await existingCompanyProperties(token);
      if (existing) {
        const kept: Record<string, string> = {};
        for (const [k, v] of Object.entries(properties)) if (existing.has(k)) kept[k] = v;
        const n = Object.keys(kept).length;
        if (n > 0 && n < Object.keys(properties).length) {
          const retry = await fetch(`https://api.hubapi.com/crm/v3/objects/companies/${hsId}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ properties: kept }),
          });
          return retry.ok;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

// Noms des propriétés Company du portail — mis en cache le temps du process
// (le repli sur PATCH filtré ne coûte qu'UN appel par portail, pas par fiche).
const propertyNamesCache = new Map<string, { names: Set<string>; at: number }>();
const PROPERTY_CACHE_MS = 10 * 60_000;

async function existingCompanyProperties(token: string): Promise<Set<string> | null> {
  const cached = propertyNamesCache.get(token);
  if (cached && Date.now() - cached.at < PROPERTY_CACHE_MS) return cached.names;
  try {
    const res = await fetch("https://api.hubapi.com/crm/v3/properties/companies", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { results?: Array<{ name?: string }> };
    const names = new Set((d.results ?? []).map((p) => p.name).filter((n): n is string => typeof n === "string"));
    propertyNamesCache.set(token, { names, at: Date.now() });
    return names;
  } catch {
    return null;
  }
}

/**
 * Push « JAMAIS écraser » : lit d'abord la fiche HubSpot et ne PATCH que les
 * propriétés VIDES — la donnée saisie par le client dans son CRM fait toujours
 * foi. En cas d'échec de lecture, on n'écrit rien (prudence > complétude).
 */
export async function pushHubspotIfEmpty(token: string, hsId: string, properties: Record<string, string>): Promise<boolean> {
  let keys = Object.keys(properties);
  if (keys.length === 0) return true;
  try {
    let res = await fetch(
      `https://api.hubapi.com/crm/v3/objects/companies/${hsId}?properties=${encodeURIComponent(keys.join(","))}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    // 400 = une propriété demandée n'existe pas dans le portail : on relit en
    // se limitant aux propriétés existantes plutôt que d'abandonner la fiche.
    if (res.status === 400) {
      const existing = await existingCompanyProperties(token);
      keys = existing ? keys.filter((k) => existing.has(k)) : keys;
      if (keys.length === 0) return false;
      res = await fetch(
        `https://api.hubapi.com/crm/v3/objects/companies/${hsId}?properties=${encodeURIComponent(keys.join(","))}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
    }
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
export async function ensureHubSpotIdProperty(
  token: string,
  name: string,
  label: string,
  opts?: {
    /** false = donnée descriptive (statut juridique, adresse…) : pas d'unicité à réclamer. */
    unique?: boolean;
    /** number = valeur numérique (capital social). */
    type?: "string" | "number";
  },
): Promise<EnsurePropertyResult> {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const wantUnique = opts?.unique !== false;
  try {
    const res = await fetch(`https://api.hubapi.com/crm/v3/properties/companies/${encodeURIComponent(name)}`, { headers });
    if (res.ok) {
      const d = (await res.json()) as { hasUniqueValue?: boolean };
      // uniqueValue ne conditionne un avertissement que pour les identifiants
      // cherchables ; une propriété descriptive est correcte sans unicité.
      return { name, label, status: "exists", uniqueValue: !wantUnique || d.hasUniqueValue === true };
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
          type: opts?.type === "number" ? "number" : "string",
          fieldType: opts?.type === "number" ? "number" : "text",
          groupName: "companyinformation",
          hasUniqueValue,
        }),
      });
    let createRes = await create(wantUnique);
    if (createRes.ok) return { name, label, status: "created", uniqueValue: true };
    if (createRes.status === 403) return { name, label, status: "no_scope", uniqueValue: false };
    if (!wantUnique) return { name, label, status: "error", uniqueValue: false };
    createRes = await create(false);
    if (createRes.ok) return { name, label, status: "created", uniqueValue: false };
    return { name, label, status: "error", uniqueValue: false };
  } catch {
    return { name, label, status: "error", uniqueValue: false };
  }
}
