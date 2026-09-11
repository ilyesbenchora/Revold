/**
 * Détection de MOTS-CLÉS business dans les transcriptions d'appels — 100 %
 * déterministe (aucun LLM) : normalisation accents/casse puis recherche de
 * motifs par famille. Le snippet renvoyé est la phrase autour de la PREMIÈRE
 * occurrence, pour montrer le contexte sans stocker toute la conversation.
 */

export const CALL_KEYWORD_GROUPS: Array<{ key: string; label: string; patterns: string[] }> = [
  { key: "devis", label: "Devis", patterns: ["devis", "proposition commerciale", "chiffrage", "proposal"] },
  { key: "facturation", label: "Facturation", patterns: ["facture", "facturation", "reglement", "impaye", "relance de paiement"] },
  { key: "paiement", label: "Paiement", patterns: ["paiement", "virement", "prelevement", "echeance"] },
  { key: "prix", label: "Prix / tarif", patterns: ["prix", "tarif", "budget", "remise", "reduction"] },
  { key: "contrat", label: "Contrat", patterns: ["contrat", "renouvellement", "engagement", "avenant"] },
  { key: "resiliation", label: "Résiliation", patterns: ["resiliation", "resilier", "annuler", "annulation", "arreter le contrat"] },
];

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function extractCallKeywords(transcript: string): { keywords: string[]; snippet: string | null } {
  const t = norm(transcript);
  const keywords: string[] = [];
  let firstIdx = -1;
  for (const g of CALL_KEYWORD_GROUPS) {
    for (const p of g.patterns) {
      const i = t.indexOf(norm(p));
      if (i >= 0) {
        keywords.push(g.key);
        if (firstIdx < 0 || i < firstIdx) firstIdx = i;
        break;
      }
    }
  }
  if (keywords.length === 0) return { keywords: [], snippet: null };
  // Contexte autour de la première occurrence (~200 caractères, sur le texte
  // ORIGINAL pour garder accents et casse).
  const start = Math.max(0, firstIdx - 60);
  const snippet = `${start > 0 ? "…" : ""}${transcript.slice(start, firstIdx + 140).trim()}…`;
  return { keywords, snippet };
}
