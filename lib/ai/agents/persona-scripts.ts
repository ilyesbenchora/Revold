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
      "Salut, je suis l'agent process, ton ingénieur workflows chez Revold.",
      "Mon métier, c'est de chasser tout ce que ton équipe fait encore à la main.",
      "Les tâches répétitives, les copier-coller entre outils, les relances oubliées.",
      "J'analyse tes workflows un par un, action par action,",
      "pour repérer ce qui peut être automatisé sans rien casser.",
      "Je te dis où tu perds des heures chaque semaine,",
      "et par quoi commencer pour en récupérer le plus vite.",
      "L'objectif : que tes équipes se concentrent sur ce qui compte vraiment,",
      "et laissent la mécanique répétitive tourner toute seule.",
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
      "Bonjour, je suis Sofia, ta coach data chez Revold.",
      "Mon rôle, c'est de rendre tes données dignes de confiance.",
      "Je les fiabilise, je les enrichis, je comble les manques",
      "pour que tes décisions reposent sur du solide et pas sur du bruit.",
      "Je t'explique simplement où sont les faiblesses",
      "et comment les corriger, étape par étape.",
      "Ma mission, c'est que tu puisses regarder un chiffre",
      "et y croire les yeux fermés.",
    ],
  },
  "coaching-integration": {
    elevenVoiceId: "jvSOBXJ1cP2sdvT5RgUP", // Richie Tekan — FR jeune, décontracté (coach intégration)
    segments: [
      "Salut, moi c'est Yanis, ton coach intégration chez Revold.",
      "Mon rôle, c'est de connecter ta stack et de la faire adopter.",
      "Des outils branchés, mais surtout des outils vraiment utilisés.",
      "Je repère les connexions qui manquent, les données qui ne circulent pas,",
      "et les équipes qui n'ont pas pris le pli.",
      "Je maximise l'adoption pour que ta donnée soit unifiée",
      "et enfin exploitable d'un outil à l'autre.",
      "Ma mission, c'est une stack qui travaille pour toi,",
      "pas une collection d'outils qui s'ignorent.",
    ],
  },
  "coaching-cross-source": {
    elevenVoiceId: "VcN1mmVCxio0RiBhJlwz", // Eda — FR parisienne, jeune, dynamique
    segments: [
      "Bonjour, je suis Nina, ta coach cross-source chez Revold.",
      "Ma spécialité, c'est de croiser ce que tes outils gardent séparé.",
      "Le CRM, la facturation, le support : chacun ne dit qu'une partie de l'histoire.",
      "Je relie ces sources pour révéler ce qu'aucune ne montre seule.",
      "Un client fidèle côté support mais en retard de paiement,",
      "un deal gagné qui ne s'est jamais transformé en revenu.",
      "Ma mission, c'est de faire parler tes données ensemble",
      "pour que tu voies enfin le tableau complet.",
    ],
  },
  "coaching-data-model": {
    elevenVoiceId: "IbTlccXlWxGVwnbGUHEd", // Michael — FR parisien, calme, narratif (pédagogue)
    segments: [
      "Bonjour, je suis Adam, ton coach modèle de données chez Revold.",
      "Mon rôle, c'est de mettre de l'ordre dans la structure de ton CRM.",
      "La façon dont tes contacts, entreprises et deals sont reliés entre eux.",
      "J'audite ton modèle et je structure tes objets",
      "pour un socle propre, cohérent et qui tiendra dans la durée.",
      "Je t'explique pourquoi telle relation compte",
      "et comment éviter que tout se remélange avec le temps.",
      "Ma mission, c'est une fondation de données solide,",
      "sur laquelle tout le reste peut se construire.",
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
  "prev-marketing": {
    elevenVoiceId: "zVrWtLr70jn6SeaARX0i", // Kevin — FR jeune, créateur de contenu (énergique)
    segments: [
      "Salut, moi c'est Lucas, ton prévisionniste marketing chez Revold.",
      "Je modélise tes leads et tes conversions à venir.",
      "Combien d'inscrits, combien de qualifiés, combien de clients au bout.",
      "Je pars de tes tendances réelles pour projeter les prochains mois.",
      "Tu peux caler ton budget d'acquisition et tes objectifs avec confiance,",
      "au lieu de naviguer à vue.",
      "Ma mission, c'est de rendre ta croissance prévisible,",
      "pour que chaque euro investi ait une cible claire.",
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
    elevenVoiceId: "sOtdnM6kZo7osJcZj9ew", // Fred — FR standard, conversationnel (analyste clair)
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
