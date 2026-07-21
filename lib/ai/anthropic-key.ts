/**
 * Clé API Anthropic VALIDÉE. Cas réel rencontré en prod : une valeur masquée
 * (« ••••… », U+2022) collée dans Vercel à la place de la vraie clé. Elle passe
 * le check `!apiKey` puis fait exploser le fetch au moment du header
 * (« Cannot convert argument to a ByteString ») — erreur cryptique côté user.
 *
 * Ici : une clé non Latin-1 ou d'un format inattendu est traitée comme ABSENTE,
 * pour que chaque appelant retombe sur son repli (heuristique, template…) ou
 * renvoie un message actionnable.
 */
export function getAnthropicKey(): { key: string | null; reason: string | null } {
  const raw = process.env.ANTHROPIC_API_KEY?.trim();
  if (!raw) return { key: null, reason: "ANTHROPIC_API_KEY absente" };
  if ([...raw].some((c) => c.charCodeAt(0) > 255)) {
    return {
      key: null,
      reason:
        "ANTHROPIC_API_KEY corrompue : elle contient des caractères masqués (« • »). " +
        "Recolle la vraie clé (sk-ant-…) dans les variables d'environnement Vercel.",
    };
  }
  if (!raw.startsWith("sk-ant-")) {
    return { key: null, reason: "ANTHROPIC_API_KEY au format inattendu (doit commencer par sk-ant-…)." };
  }
  return { key: raw, reason: null };
}
