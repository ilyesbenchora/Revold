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
  automatisations: {
    elevenVoiceId: "yG4Uc56cLYQyZFnWaYv2", // Kael — FR parisien jeune, posé (ingénieur)
    segments: [
      "Salut, moi c'est Théo, ton référent alignement process et outils chez Revold.",
      "Mon métier, c'est de mesurer les passages de témoin entre tes services.",
      "Un MQL qualifié par le marketing : en combien de temps devient-il un deal ?",
      "Un deal gagné : en combien de temps est-il facturé, puis encaissé ?",
      "Je chronomètre chaque étape du lifecycle, sur tes données réelles,",
      "et je te montre exactement où le relais se rompt.",
      "L'objectif : des équipes qui se passent le témoin sans le faire tomber,",
      "avec des SLA mesurés, pas des impressions.",
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
  equipes: {
    elevenVoiceId: "NEjemlRxgWmL5ZGJetsB", // Claire — FR conversationnelle, chaleureuse (coach)
    segments: [
      "Salut, je suis Sarah, ta coach d'équipes chez Revold.",
      "Je regarde la performance commercial par commercial,",
      "sans jamais réduire quelqu'un à un simple chiffre.",
      "Je vois qui est surchargé, qui a besoin d'appui,",
      "et où se cachent les vraies marges de progression.",
      "Je t'aide à équilibrer la charge dans l'équipe",
      "et à faire monter chacun en compétence, à son rythme.",
      "Ma mission, c'est une équipe plus juste et plus performante,",
      "où le talent de chacun trouve sa place.",
    ],
  },
  proprietes: {
    elevenVoiceId: "NJGktYrreZwyjxhPOpIz", // Adrien — FR parisien, formel (auditeur)
    segments: [
      "Bonjour, je suis Karim, ton auditeur CRM chez Revold.",
      "Mon travail, c'est de traquer ce qui fausse tes données en silence.",
      "Les champs vides, les doublons, les valeurs incohérentes.",
      "Tout ce qui rend une analyse bancale ou bloque une automatisation.",
      "Je passe ton CRM au peigne fin, propriété par propriété,",
      "et je te montre exactement où sont les trous et pourquoi ils comptent.",
      "Ma mission, c'est un socle de données propre et fiable,",
      "sur lequel tes décisions peuvent vraiment s'appuyer.",
    ],
  },
  // ── Coaching ──
  "coaching-ventes": {
    elevenVoiceId: "BilXxxvRLrA8YTteM2sl", // Oris — FR enjoué, conversationnel (coach ventes)
    segments: [
      "Salut, moi c'est Marc, ton coach des ventes chez Revold.",
      "Mon truc, c'est de faire avancer les deals qui stagnent.",
      "Je repère ceux qui bloquent, ceux qui traînent en longueur,",
      "et je te dis précisément ce qui les retient.",
      "Je muscle ton closing et je fluidifie ton pipeline",
      "pour que le chiffre rentre plus vite et plus régulièrement.",
      "Ma mission, c'est de transformer ton pipeline en résultats,",
      "un deal débloqué après l'autre.",
    ],
  },
  "coaching-marketing": {
    elevenVoiceId: "Y54PWsHC8udAjARe8URQ", // Mimi — FR jeune, décontractée (coach marketing)
    segments: [
      "Coucou, je suis Léa, ta coach marketing chez Revold.",
      "Je regarde d'où viennent tes leads et ce qu'ils deviennent vraiment.",
      "Quelles sources t'apportent des clients, lesquelles te coûtent pour rien.",
      "J'optimise ton acquisition et ton taux de conversion",
      "pour que tu attires des leads plus qualifiés, à moindre coût.",
      "Je te montre où mettre ton budget",
      "et quel canal pousser pour de vrais résultats.",
      "Ma mission, c'est un marketing qui nourrit les ventes,",
      "pas juste des chiffres de vanité.",
    ],
  },
  "coaching-data": {
    elevenVoiceId: "sQfOhaIRbFZ7R8bP1x9f", // Amelie — FR jeune, calme (coach data, pédagogue)
    segments: [
      "Bonjour, je suis Sofia, ta coach data et intégration chez Revold.",
      "Mon rôle, c'est de rendre tes données dignes de confiance.",
      "Je les fiabilise, je comble les manques,",
      "et je connecte ta stack pour que la donnée circule entre tes outils.",
      "Je croise aussi tes sources : CRM, facturation, support,",
      "pour révéler ce qu'aucun outil ne montre seul.",
      "Ma mission, c'est que tu puisses regarder un chiffre",
      "et y croire les yeux fermés.",
    ],
  },
  "coaching-data-model": {
    elevenVoiceId: "IbTlccXlWxGVwnbGUHEd", // Michael — FR parisien, calme, narratif (pédagogue)
    segments: [
      "Bonjour, je suis Adam, ton coach finance chez Revold.",
      "Mon terrain, c'est la trésorerie et la comptabilité de ton entreprise.",
      "Le cash qui rentre, celui qui sort, et ce qu'il en restera demain.",
      "Je surveille tes encaissements, tes échéances et tes impayés,",
      "et je t'explique simplement ce que racontent tes chiffres.",
      "Marges, charges, besoin en fonds de roulement :",
      "je traduis la comptabilité en décisions concrètes.",
      "Ma mission, c'est une trésorerie sous contrôle,",
      "pour que tu ne découvres plus jamais un problème de cash trop tard.",
    ],
  },
  // ── Prévisions ──
  "prev-ventes": {
    elevenVoiceId: "MtmOw0YCJmdnFGEjqlkh", // Clarris — FR parisienne, jeune, douce (prévisionniste)
    segments: [
      "Bonjour, je suis Emma, ta prévisionniste ventes chez Revold.",
      "Mon rôle, c'est de te dire où tu vas atterrir, pas seulement où tu en es.",
      "À partir de ton historique et de ton pipeline actuel,",
      "je projette ton chiffre de fin de trimestre.",
      "Je te montre l'écart avec ton objectif, tant qu'il est encore temps d'agir.",
      "Plusieurs scénarios : le prudent, le probable, l'ambitieux.",
      "Ma mission, c'est de t'aider à anticiper",
      "au lieu de découvrir le résultat quand il est trop tard.",
    ],
  },
  "prev-revenue": {
    elevenVoiceId: "l2SMkbOspgB4yZ8sr2hP", // Gaia — FR alto, profonde, posée (registre direction)
    segments: [
      "Bonjour, je suis Maya, ta prévisionniste revenue chez Revold.",
      "Je projette ta trajectoire de revenus dans son ensemble.",
      "Ton MRR, ton ARR, ton churn, et ton closing à venir.",
      "Le tout en trois scénarios, du plus prudent au plus ambitieux.",
      "Je relie ce que tu vends aujourd'hui à ce que tu encaisseras demain,",
      "pour que ta croissance ne repose pas sur des suppositions.",
      "Ma mission, c'est de sécuriser ta trajectoire",
      "et d'anticiper l'atterrissage avant qu'il n'arrive.",
    ],
  },
  "prev-donnees": {
    elevenVoiceId: "9VJT2SZChgTPnn1cblfa", // Armel — FR posé, apaisant (analytique)
    segments: [
      "Bonjour, je suis Noah, ton prévisionniste données chez Revold.",
      "Mon rôle est particulier : je surveille la santé de tes données dans le temps.",
      "Car une base se dégrade lentement, sans qu'on s'en rende compte.",
      "Des champs qui se vident, une qualité qui glisse mois après mois.",
      "J'anticipe cette dérive avant qu'elle ne fausse tes analyses",
      "et n'affaiblisse tes décisions.",
      "Ma mission, c'est de te faire agir en amont,",
      "quand corriger coûte encore peu.",
    ],
  },
  // ── Dashboard ──
  reporting: {
    // Alix est une JEUNE ANALYSTE (portrait : lunettes, sourire doux) — voix
    // féminine jeune, douce et claire, française native.
    elevenVoiceId: "MtmOw0YCJmdnFGEjqlkh", // Clarris — FR parisienne jeune, douce, conversationnelle
    // Tonalité : posée et articulée (analyste pédagogue), un peu de vivacité.
    voiceSettings: { stability: 0.55, similarity_boost: 0.8, style: 0.25 },
    segments: [
      "Bonjour, moi c'est Alix, ton analyste reporting chez Revold.",
      "Mon rôle, c'est de transformer tes données en quelque chose de lisible.",
      "Je rassemble ce qui vient de tous tes outils",
      "et j'en fais des rapports clairs, visuels, prêts à décider.",
      "Fini de jongler entre dix tableaux qui ne se parlent pas.",
      "Tu vois l'essentiel d'un coup d'œil, sans te perdre dans les détails.",
      "Ma mission, c'est de te faire gagner du temps à chaque réunion,",
      "avec des chiffres que tout le monde comprend.",
    ],
  },
};

/** Texte complet dit par l'avatar, pour l'API de génération vidéo. */
export function scriptText(key: string): string | null {
  const s = PERSONA_SCRIPTS[key];
  return s ? s.segments.join(" ") : null;
}
