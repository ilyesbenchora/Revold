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
};

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
