type Props = {
  previewTitle?: string;
  previewBody?: string;
};

/**
 * Ancien bloc « Premium » verrouillé (aperçu flouté + CTA gold). Retiré car trop
 * invasif : il cachait la valeur au lieu de la montrer. Ne rend plus rien —
 * l'upsell passe par la page Tarifs + des limites d'usage douces, pas en bloquant
 * l'écran. On garde le composant (no-op) pour ne pas modifier chaque page.
 */
export function InsightLockedBlock(_props: Props) {
  return null;
}
