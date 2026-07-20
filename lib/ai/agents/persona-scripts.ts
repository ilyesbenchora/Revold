/**
 * Scripts de présentation des personas — texte dit par l'avatar dans sa vidéo
 * de bio, découpé en segments qui servent AUSSI de sous-titres (piste WebVTT).
 *
 * Règles d'écriture :
 *  - à la 1re personne, ton de l'agent (tutoiement, comme le reste de l'UI) ;
 *  - un segment = une ligne de sous-titre lisible d'un coup (≤ ~90 caractères) ;
 *  - on dit le RÔLE puis la MISSION concrète, sans jargon ni promesse creuse ;
 *  - 30 à 40 secondes une fois lu, soit ~85 mots.
 *
 * Le minutage des sous-titres est calculé à la génération, au prorata de la
 * longueur de chaque segment sur la durée réelle de la vidéo rendue
 * (cf. scripts/generate-persona-video.mjs).
 */

export type PersonaScript = {
  /** Voix TTS D-ID (Microsoft Neural, locale fr-FR). */
  voiceId: string;
  /** Voix TTS Hedra (id de /web-app/public/voices). Accent anglophone en FR. */
  hedraVoiceId?: string;
  /**
   * Voix ElevenLabs — français NATIF, source vocale retenue. La vidéo reste
   * générée par Hedra à partir de cet audio (cf. generate-persona-video-hedra).
   */
  elevenVoiceId?: string;
  /** Segments dits dans l'ordre ; chacun devient une ligne de sous-titre. */
  segments: string[];
};

export const PERSONA_SCRIPTS: Record<string, PersonaScript> = {
  performance: {
    // D-ID (Microsoft TTS) — conservé si on revient à ce fournisseur.
    voiceId: "fr-FR-VivienneMultilingualNeural",
    // Hedra — voix « Chloe » (féminine, claire, enjouée), à l'unisson du
    // personnage. Voix multilingue : prononce le français.
    hedraVoiceId: "d2d7515d-e170-4ee6-b022-0ce471c0aaa0",
    segments: [
      "Bonjour, moi c'est Chloé, ton analyste performance chez Revold.",
      "Mon rôle : regarder ton activité commerciale telle qu'elle est vraiment,",
      "pas telle que le CRM la raconte.",
      "Je décortique tes deals, ton pipeline et ton taux de closing,",
      "étape par étape, pipeline par pipeline.",
      "Je te montre où les affaires ralentissent, où elles se perdent,",
      "et ce qui distingue celles que tu gagnes.",
      "Ma mission, c'est de transformer ça en décisions concrètes :",
      "quelle étape déboucher cette semaine, quel deal relancer en priorité.",
      "Et si un indicateur décroche, je te le dis avant que ça coûte cher.",
    ],
  },
};

/** Texte complet dit par l'avatar, pour l'API de génération vidéo. */
export function scriptText(key: string): string | null {
  const s = PERSONA_SCRIPTS[key];
  return s ? s.segments.join(" ") : null;
}
