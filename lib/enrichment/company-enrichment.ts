/**
 * Enrichissement d'entreprises via la base Sirene (API Recherche d'Entreprises
 * de l'État — https://recherche-entreprises.api.gouv.fr, gratuite, sans clé).
 *
 * Revold ne se contente plus de CONSTATER les identifiants manquants : il
 * propose SIREN, SIRET (siège), N° TVA intracommunautaire (calculé depuis le
 * SIREN — clé fiscale déterministe) et la raison sociale officielle, à valider
 * par l'utilisateur avant écriture.
 */

export type EnrichmentCandidate = {
  siren: string;
  /** SIRET du siège social. */
  siret: string | null;
  /** Raison sociale officielle (l'entreprise à facturer). */
  legalName: string;
  /** N° TVA intracommunautaire FR calculé depuis le SIREN. */
  vatNumber: string;
  /** high = nom normalisé identique · medium = meilleur résultat plausible. */
  confidence: "high" | "medium";
};

/** Clé TVA française : FR + ((12 + 3 × (SIREN mod 97)) mod 97) + SIREN. */
export function vatFromSiren(siren: string): string {
  const n = Number(siren);
  const key = (12 + 3 * (n % 97)) % 97;
  return `FR${String(key).padStart(2, "0")}${siren}`;
}

/** Normalisation de nom pour la comparaison (casse, accents, formes juridiques). */
export function normalizeCompanyName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(sas|sasu|sarl|eurl|sa|sci|snc|scop|selarl|holding|groupe|group|france)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type ApiResult = {
  siren?: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  siege?: { siret?: string };
  tranche_effectif_salarie?: string | null;
  annee_tranche_effectif_salarie?: string | null;
  finances?: Record<string, { ca?: number | null; resultat_net?: number | null }> | null;
};

// ── Effectifs & CA officiels (données ÉVOLUTIVES, à rafraîchir) ─────────────

/**
 * Tranches d'effectif salarié INSEE (issues des déclarations URSSAF).
 * `mid` = valeur représentative poussée dans numberofemployees (HubSpot exige
 * un nombre) — documentée comme telle dans l'UI.
 */
const EFFECTIF_TRANCHES: Record<string, { label: string; mid: number }> = {
  "00": { label: "0 salarié", mid: 0 },
  "01": { label: "1 à 2 salariés", mid: 2 },
  "02": { label: "3 à 5 salariés", mid: 4 },
  "03": { label: "6 à 9 salariés", mid: 8 },
  "11": { label: "10 à 19 salariés", mid: 15 },
  "12": { label: "20 à 49 salariés", mid: 35 },
  "21": { label: "50 à 99 salariés", mid: 75 },
  "22": { label: "100 à 199 salariés", mid: 150 },
  "31": { label: "200 à 249 salariés", mid: 225 },
  "32": { label: "250 à 499 salariés", mid: 375 },
  "41": { label: "500 à 999 salariés", mid: 750 },
  "42": { label: "1 000 à 1 999 salariés", mid: 1500 },
  "51": { label: "2 000 à 4 999 salariés", mid: 3500 },
  "52": { label: "5 000 à 9 999 salariés", mid: 7500 },
  "53": { label: "10 000 salariés et plus", mid: 10000 },
};

export type CompanyFacts = {
  /** Tranche officielle d'effectif (libellé lisible), avec son année. */
  employeeRange: string | null;
  employeeYear: number | null;
  /** Valeur représentative de la tranche (pour numberofemployees HubSpot). */
  employeeMidpoint: number | null;
  /** Dernier CA déposé à l'INPI (comptes publiés uniquement), avec l'exercice. */
  revenue: number | null;
  revenueYear: number | null;
  netIncome: number | null;
};

/** Extrait effectifs + finances d'un résultat de l'API (partagé recherche/fiche). */
function factsFromResult(r: ApiResult): CompanyFacts {
  const trancheCode = r.tranche_effectif_salarie ?? null;
  const tranche = trancheCode ? EFFECTIF_TRANCHES[trancheCode] ?? null : null;
  const employeeYear = r.annee_tranche_effectif_salarie ? Number(r.annee_tranche_effectif_salarie) || null : null;

  let revenue: number | null = null;
  let revenueYear: number | null = null;
  let netIncome: number | null = null;
  const finances = r.finances ?? null;
  if (finances && typeof finances === "object") {
    const years = Object.keys(finances)
      .map((y) => Number(y))
      .filter((y) => Number.isFinite(y))
      .sort((a, b) => b - a);
    for (const y of years) {
      const f = finances[String(y)];
      if (f && typeof f.ca === "number") {
        revenue = f.ca;
        revenueYear = y;
        netIncome = typeof f.resultat_net === "number" ? f.resultat_net : null;
        break;
      }
    }
  }
  return {
    employeeRange: tranche?.label ?? null,
    employeeYear,
    employeeMidpoint: tranche?.mid ?? null,
    revenue,
    revenueYear,
    netIncome,
  };
}

/**
 * Effectifs officiels (tranche URSSAF/INSEE) et dernier CA déposé (INPI) d'une
 * entreprise, par SIREN — la clé posée par le rapprochement Revold. Données
 * ÉVOLUTIVES : à rafraîchir périodiquement. CA absent = comptes déposés en
 * confidentialité (fréquent en PME) — on ne devine jamais.
 */
export async function fetchCompanyFacts(siren: string): Promise<CompanyFacts | null> {
  if (!/^\d{9}$/.test(siren)) return null;
  try {
    const res = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${siren}&page=1&per_page=3`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const d = (await res.json()) as { results?: ApiResult[] };
    const match = (d.results ?? []).find((r) => r.siren === siren);
    if (!match) return null;
    return factsFromResult(match);
  } catch {
    return null;
  }
}

/**
 * Cherche une entreprise dans la base Sirene par son nom (et si possible son
 * domaine, utilisé seulement pour départager). Renvoie le meilleur candidat,
 * ou null si rien d'assez plausible.
 */
export async function searchCompanyInSirene(name: string): Promise<EnrichmentCandidate | null> {
  const q = name.trim();
  if (q.length < 2) return null;
  try {
    const res = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(q)}&page=1&per_page=5`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const d = (await res.json()) as { results?: ApiResult[] };
    const results = (d.results ?? []).filter((r) => r.siren && /^\d{9}$/.test(r.siren));
    if (results.length === 0) return null;

    const target = normalizeCompanyName(q);
    // 1. Correspondance de nom normalisé exacte → confiance haute.
    const exact = results.find(
      (r) =>
        normalizeCompanyName(r.nom_complet ?? "") === target ||
        normalizeCompanyName(r.nom_raison_sociale ?? "") === target,
    );
    const best = exact ?? results[0];
    const bestName = best.nom_raison_sociale || best.nom_complet || q;
    // 2. Sans correspondance exacte, on exige au moins une inclusion de nom
    //    (évite de proposer une entreprise sans rapport sur un nom générique).
    if (!exact) {
      const bn = normalizeCompanyName(bestName);
      if (!bn.includes(target) && !target.includes(bn)) return null;
    }
    return {
      siren: best.siren!,
      siret: best.siege?.siret && /^\d{14}$/.test(best.siege.siret) ? best.siege.siret : null,
      legalName: bestName,
      vatNumber: vatFromSiren(best.siren!),
      confidence: exact ? "high" : "medium",
    };
  } catch {
    return null;
  }
}
