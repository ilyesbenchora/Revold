import { hubFetch } from "@/lib/integrations/hub-fetch";
/**
 * Poussée des données d'enrichissement vers HubSpot (fiches companies) et
 * gestion des propriétés cibles (siren/siret/TVA). Partagé par le moteur de
 * backfill et la poussée immédiate déclenchée depuis Paramètres → Enrichissement.
 */

export async function pushHubspot(token: string, hsId: string, properties: Record<string, string>): Promise<boolean> {
  try {
    // Propriétés de type LISTE DÉROULANTE (enumeration) : HubSpot rejette tout
    // le PATCH si une valeur n'est pas une option existante. On aligne chaque
    // valeur sur les options de la propriété (par valeur interne, libellé ou
    // acronyme — « SAS (société par actions simplifiée) » matche l'option
    // « SAS ») ; sans équivalent, la propriété n'est PAS écrite : on n'invente
    // jamais d'option dans la liste du client, et les autres données passent.
    const resolved = await alignEnumProperties(token, properties);
    if (Object.keys(resolved).length === 0) return true;
    const res = await hubFetch(`https://api.hubapi.com/crm/v3/objects/companies/${hsId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ properties: resolved }),
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
        for (const [k, v] of Object.entries(resolved)) if (existing.has(k)) kept[k] = v;
        const n = Object.keys(kept).length;
        if (n > 0 && n < Object.keys(resolved).length) {
          const retry = await hubFetch(`https://api.hubapi.com/crm/v3/objects/companies/${hsId}`, {
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

// Métadonnées des propriétés Company du portail (type + options des listes
// déroulantes) — mises en cache le temps du process : l'alignement des valeurs
// et le repli sur PATCH filtré ne coûtent qu'UN appel par portail, pas par fiche.
type PropertyMeta = { type: string; options: Array<{ label: string; value: string }> };
const propertyMetaCache = new Map<string, { meta: Map<string, PropertyMeta>; at: number }>();
const PROPERTY_CACHE_MS = 10 * 60_000;

async function companyPropertyMeta(token: string): Promise<Map<string, PropertyMeta> | null> {
  const cached = propertyMetaCache.get(token);
  if (cached && Date.now() - cached.at < PROPERTY_CACHE_MS) return cached.meta;
  try {
    const res = await hubFetch("https://api.hubapi.com/crm/v3/properties/companies", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const d = (await res.json()) as {
      results?: Array<{ name?: string; type?: string; options?: Array<{ label?: string; value?: string }> }>;
    };
    const meta = new Map<string, PropertyMeta>();
    for (const p of d.results ?? []) {
      if (typeof p.name !== "string") continue;
      meta.set(p.name, {
        type: p.type ?? "string",
        options: (p.options ?? [])
          .filter((o): o is { label: string; value: string } => typeof o?.value === "string")
          .map((o) => ({ label: o.label ?? o.value, value: o.value })),
      });
    }
    propertyMetaCache.set(token, { meta, at: Date.now() });
    return meta;
  } catch {
    return null;
  }
}

async function existingCompanyProperties(token: string): Promise<Set<string> | null> {
  const meta = await companyPropertyMeta(token);
  return meta ? new Set(meta.keys()) : null;
}

/** Normalisation pour comparer valeurs et options (casse, accents, espaces). */
const normalizeOption = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Trouve l'option d'une liste déroulante correspondant à une valeur Revold.
 *  1. égalité stricte (valeur interne ou libellé de l'option) ;
 *  2. tête du libellé Revold avant la parenthèse — « SAS (société par actions
 *     simplifiée) » matche l'option « SAS » ;
 *  3. option égale à un MOT ENTIER de la valeur (jamais de sous-chaîne : « SA »
 *     ne matche pas « SAS ») — retenue seulement si UNE SEULE option candidate.
 * Retourne la valeur INTERNE de l'option (c'est elle que l'API attend), ou null.
 */
export function matchEnumOption(options: Array<{ label: string; value: string }>, raw: string): string | null {
  const v = normalizeOption(raw);
  if (!v) return null;
  for (const o of options) if (normalizeOption(o.value) === v || normalizeOption(o.label) === v) return o.value;
  const lead = normalizeOption(raw.split("(")[0]);
  if (lead && lead !== v) {
    for (const o of options) if (normalizeOption(o.value) === lead || normalizeOption(o.label) === lead) return o.value;
  }
  const tokens = new Set(v.split(/[^a-z0-9]+/).filter((t) => t.length >= 2));
  const candidates = options.filter(
    (o) => tokens.has(normalizeOption(o.label)) || tokens.has(normalizeOption(o.value)),
  );
  return candidates.length === 1 ? candidates[0].value : null;
}

/**
 * Bornes d'une TRANCHE exprimée en texte — « 10-19 », « 10 à 19 salariés »,
 * « 20 à 49 », « < 10 », « moins de 50 », « 250+ », « plus de 500 »,
 * « 1M€ - 10M€ », « 1 000 000 - 5 000 000 », « 500k-1M »… null si le texte
 * ne décrit pas une plage numérique. Multiplicateurs k / M reconnus.
 */
export function parseRangeSpec(raw: string): { min: number; max: number } | null {
  const s = normalizeOption(raw).replace(/salaries?|employes?|effectifs?|€|eur(os)?/g, " ");
  const num = (m: string, mult: string | undefined): number => {
    const n = Number(m.replace(/[\s,]/g, "").replace(",", "."));
    return n * (mult === "k" ? 1_000 : mult === "m" ? 1_000_000 : 1);
  };
  const N = "([\\d][\\d\\s,.]*)\\s*([km])?";
  // « a - b » · « a à b » · « de a à b » · « entre a et b »
  let m = new RegExp(`(?:de\\s+|entre\\s+)?${N}\\s*(?:-|–|a|à|et)\\s*${N}`).exec(s);
  if (m) {
    const min = num(m[1], m[2]);
    const max = num(m[3], m[4]);
    if (Number.isFinite(min) && Number.isFinite(max) && max >= min) return { min, max };
  }
  // « < b » · « moins de b » · « jusqu'a b » · « b et moins »
  m = new RegExp(`(?:<|moins de|jusqu ?a|max(?:imum)?)\\s*${N}`).exec(s) ?? new RegExp(`^${N}\\s*(?:et moins|ou moins)`).exec(s);
  if (m) {
    const max = num(m[1], m[2]);
    if (Number.isFinite(max)) return { min: 0, max };
  }
  // « > a » · « plus de a » · « a+ » · « a et plus »
  m = new RegExp(`(?:>|plus de|min(?:imum)?)\\s*${N}`).exec(s) ?? new RegExp(`^${N}\\s*(?:\\+|et plus|ou plus)`).exec(s);
  if (m) {
    const min = num(m[1], m[2]);
    if (Number.isFinite(min)) return { min, max: Number.POSITIVE_INFINITY };
  }
  return null;
}

/** Valeur numérique d'une donnée enrichie : nombre brut, ou milieu de tranche. */
function numericOf(raw: string): number | null {
  const direct = Number(raw.replace(/[\s,]/g, ""));
  if (Number.isFinite(direct)) return direct;
  const range = parseRangeSpec(raw);
  if (!range) return null;
  return Number.isFinite(range.max) ? (range.min + range.max) / 2 : range.min;
}

/**
 * TRANCHE d'un menu déroulant contenant la valeur numérique — pour les
 * propriétés custom en tranches (effectif « 10-19 », CA « 1M€-10M€ »…) :
 * l'enrichissement met la valeur officielle dans la bonne tranche. Retenue la
 * plus SERRÉE si plusieurs contiennent la valeur ; null si aucune ne parse.
 */
export function matchRangeOption(options: Array<{ label: string; value: string }>, n: number): string | null {
  let best: { value: string; width: number } | null = null;
  for (const o of options) {
    const r = parseRangeSpec(o.label) ?? parseRangeSpec(o.value);
    if (!r || n < r.min || n > r.max) continue;
    const width = (Number.isFinite(r.max) ? r.max : Number.MAX_SAFE_INTEGER) - r.min;
    if (!best || width < best.width) best = { value: o.value, width };
  }
  return best?.value ?? null;
}

/**
 * Aligne les valeurs sortantes sur les options des propriétés de type liste
 * déroulante (enumeration). Valeur sans option équivalente → propriété retirée
 * du PATCH (on n'écrit jamais une valeur qu'une liste ne connaît pas — sinon
 * HubSpot rejette TOUTES les propriétés de la fiche d'un coup).
 * Deux étages : correspondance de libellé (matchEnumOption), puis
 * correspondance de TRANCHE (matchRangeOption) pour les valeurs numériques —
 * un effectif ou un CA officiel tombe dans la bonne tranche d'un menu custom.
 * Métadonnées indisponibles → valeurs inchangées (comportement historique).
 */
async function alignEnumProperties(token: string, properties: Record<string, string>): Promise<Record<string, string>> {
  const meta = await companyPropertyMeta(token);
  if (!meta) return properties;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(properties)) {
    const m = meta.get(k);
    // Propriété inconnue du cache : laissée telle quelle (le repli 400 gère).
    if (!m) {
      out[k] = v;
      continue;
    }
    if (m.type === "enumeration" && m.options.length > 0) {
      const matched = matchEnumOption(m.options, v);
      if (matched != null) {
        out[k] = matched;
      } else {
        const n = numericOf(v);
        const byRange = n != null ? matchRangeOption(m.options, n) : null;
        if (byRange != null) out[k] = byRange;
        // Aucune option compatible → propriété retirée (honnête : les options
        // du portail n'ont rien à voir avec les valeurs Sirene/INPI).
      }
    } else {
      out[k] = v;
    }
  }
  return out;
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
    const res = await hubFetch(`https://api.hubapi.com/crm/v3/properties/companies/${encodeURIComponent(name)}`, { headers });
    if (res.ok) {
      const d = (await res.json()) as { hasUniqueValue?: boolean };
      // uniqueValue ne conditionne un avertissement que pour les identifiants
      // cherchables ; une propriété descriptive est correcte sans unicité.
      return { name, label, status: "exists", uniqueValue: !wantUnique || d.hasUniqueValue === true };
    }
    if (res.status === 403) return { name, label, status: "no_scope", uniqueValue: false };
    if (res.status !== 404) return { name, label, status: "error", uniqueValue: false };

    const create = (hasUniqueValue: boolean) =>
      hubFetch("https://api.hubapi.com/crm/v3/properties/companies", {
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
