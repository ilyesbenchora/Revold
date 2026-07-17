/**
 * Nettoie le titre d'un rapport/graphique en retirant toute mention de PÉRIODE
 * (ex : « 12 mois », « cette année », « YTD », plage de dates). La période est
 * pilotée par le sélecteur dédié au-dessus du rapport — la laisser dans le titre
 * induit en erreur quand l'utilisateur change de période.
 */
export function stripPeriodFromTitle(title: string): string {
  if (!title) return title;
  return title
    // « , 12 mois », « sur 12 derniers mois », « 3 mois »…
    .replace(/[,;–—-]?\s*(sur\s+|des\s+|les\s+)?\d+\s*(derniers?\s+)?(mois|jours?|semaines?|ans?|années?)\b/gi, "")
    // presets nommés
    .replace(/\b(cette\s+ann[ée]e|ce\s+mois(-ci)?|cette\s+semaine|ce\s+trimestre|ce\s+semestre|ann[ée]e\s+[àa]\s+ce\s+jour|mois\s+[àa]\s+ce\s+jour|trimestre\s+[àa]\s+ce\s+jour|semestre\s+[àa]\s+ce\s+jour)\b/gi, "")
    .replace(/\b(YTD|MTD|QTD|STD)\b/gi, "")
    // plages de dates « 2024-01 → 2024-12 », « 2024-01-01 au 2024-12-31 »
    .replace(/\d{4}-\d{2}(-\d{2})?\s*(→|-|au|à|\.\.\.)\s*\d{4}-\d{2}(-\d{2})?/gi, "")
    // nettoyage des séparateurs/parenthèses résiduels
    .replace(/\(\s*[,;]\s*/g, "(")
    .replace(/[,;]\s*\)/g, ")")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+([)\]])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s,;–—-]+$/g, "")
    .trim();
}
