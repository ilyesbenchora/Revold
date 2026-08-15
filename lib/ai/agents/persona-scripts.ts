/**
 * Scripts de présentation des personas — texte dit par l'avatar dans sa vidéo
 * de bio, découpé en segments qui servent AUSSI de sous-titres (piste WebVTT).
 *
 * Règles d'écriture :
 *  - à la 1re personne, ton propre à l'agent (tutoiement, comme le reste de l'UI) ;
 *  - un segment = une ligne de sous-titre lisible d'un coup (≤ ~90 caractères) ;
 *  - on dit le RÔLE puis la MISSION concrète, sans jargon ni promesse creuse ;
 *  - 30 à 40 secondes une fois lu, soit ~85 mots.
 *
 * Chaque persona a une voix ElevenLabs FRANÇAISE choisie pour coller à son
 * genre, son âge et son registre (analyste vif, experte posée, coach chaleureux,
 * auditeur méthodique…). La vidéo est générée par Hedra Character-3 à partir de
 * cet audio ; le minutage des sous-titres vient des timestamps ElevenLabs.
 */

export type PersonaScript = {
  /** Voix TTS D-ID (Microsoft Neural, fr-FR) — legacy, plus utilisée. */
  voiceId?: string;
  /** Voix TTS Hedra — repli seulement (accent anglophone en FR). */
  hedraVoiceId?: string;
  /** Voix ElevenLabs (FR native) — source vocale de production. */
  elevenVoiceId: string;
  /**
   * Tonalité ElevenLabs propre au persona (défauts : stability 0.5,
   * similarity_boost 0.75, style 0). stability basse = plus expressif ;
   * style haut = plus de caractère. À régler selon l'âge et le rôle.
   */
  voiceSettings?: { stability?: number; similarity_boost?: number; style?: number };
  /** Segments dits dans l'ordre ; chacun devient une ligne de sous-titre. */
  segments: string[];
};

export const PERSONA_SCRIPTS: Record<string, PersonaScript> = {
  // ── Données ──
  performance: {
    elevenVoiceId: "I6eWD84OrEngt4S4Antm", // Chloé — FR jeune, agréable
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
  "paiement-facturation": {
    elevenVoiceId: "a2NqrzzRklNWkb04aqW1", // Helene — FR chaleureuse, posée (finance)
    segments: [
      "Bonjour, je suis Inès, ton experte trésorerie chez Revold.",
      "Je m'occupe du cash réel : celui qui rentre, et celui qui traîne.",
      "Je réconcilie tes factures, tes paiements et tes impayés",
      "pour te donner une vision fiable de ta trésorerie,",
      "pas seulement un pipeline théorique.",
      "Je repère les factures en retard, les paiements qui glissent,",
      "et les subscriptions qui menacent ton revenu récurrent.",
      "Ma mission, c'est de protéger ton encaissement",
      "et de t'alerter dès qu'un euro attendu tarde à arriver.",
    ],
  },
  "service-client": {
    elevenVoiceId: "gP52hjM48hyNoVCbizxO", // Alexandre — FR parisien, calme, chaleureux
    segments: [
      "Bonjour, moi c'est Hugo, ton référent relation client chez Revold.",
      "Mon rôle, c'est de veiller sur tes clients avant qu'ils ne partent.",
      "Je croise les tickets, les comptes et les signaux d'usage",
      "pour repérer ceux qui décrochent en silence.",
      "Un client qui multiplie les demandes urgentes, un compte qui se refroidit :",
      "je le vois venir et je te préviens à temps.",
      "Ma mission, c'est d'anticiper le churn",
      "et de protéger les revenus récurrents que tu as mis tant d'énergie à gagner.",
    ],
  },
  proprietes: {
    elevenVoiceId: "NJGktYrreZwyjxhPOpIz", // Adrien — FR parisien, formel (auditeur)
    segments: [
      "Bonjour, je suis Karim, ton expert data chez Revold.",
      "Mon travail, c'est de traquer ce qui fausse tes données en silence.",
      "Les champs vides, les doublons, les valeurs incohérentes.",
      "Tout ce qui rend une analyse bancale ou bloque une automatisation.",
      "Je passe ton CRM au peigne fin, propriété par propriété,",
      "et je te montre exactement où sont les trous et pourquoi ils comptent.",
      "Ma mission, c'est un socle de données propre et fiable,",
      "sur lequel tes décisions peuvent vraiment s'appuyer.",
    ],
  },
};

/** Texte complet dit par l'avatar, pour l'API de génération vidéo. */
export function scriptText(key: string): string | null {
  const s = PERSONA_SCRIPTS[key];
  return s ? s.segments.join(" ") : null;
}
