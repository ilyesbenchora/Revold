/**
 * STYLE DE COACHING — paramétrable par coach (Paramètres du coach).
 *
 * Le style n'est pas cosmétique : un dirigeant qui veut du direct et du chiffré
 * décroche face à un coach qui reformule ses émotions, et l'inverse est vrai.
 * Le style choisi est injecté dans le system prompt du coach (même mécanique
 * que memoryDirective / coachingDirective).
 */

export type CoachingStyle = {
  /** Registre de parole. */
  tone: "direct" | "bienveillant" | "socratique";
  /** Intensité du challenge. */
  challenge: "doux" | "ferme" | "exigeant";
  /** Format de séance. */
  format: "structure" | "libre" | "express";
  /** Consignes libres de l'utilisateur (« tutoie-moi », « pas de jargon »…). */
  customInstructions?: string | null;
};

export const DEFAULT_COACHING_STYLE: CoachingStyle = {
  tone: "direct",
  challenge: "ferme",
  format: "structure",
  customInstructions: null,
};

export const TONE_OPTIONS: Array<{ id: CoachingStyle["tone"]; label: string; hint: string }> = [
  { id: "direct", label: "Direct", hint: "Va droit au but, chiffres d'abord, zéro détour." },
  { id: "bienveillant", label: "Bienveillant", hint: "Reconnaît les efforts avant de corriger, ton encourageant." },
  { id: "socratique", label: "Socratique", hint: "Fait trouver la réponse par des questions plutôt que la donner." },
];

export const CHALLENGE_OPTIONS: Array<{ id: CoachingStyle["challenge"]; label: string; hint: string }> = [
  { id: "doux", label: "Doux", hint: "Accompagne sans confronter, avance au rythme choisi." },
  { id: "ferme", label: "Ferme", hint: "Confronte les écarts entre les intentions et les données." },
  { id: "exigeant", label: "Exigeant", hint: "Ne laisse rien passer : engagement daté et mesurable à chaque séance." },
];

export const FORMAT_OPTIONS: Array<{ id: CoachingStyle["format"]; label: string; hint: string }> = [
  { id: "structure", label: "Structuré", hint: "Déroulé complet : bilan, analyse, plan, engagement." },
  { id: "libre", label: "Libre", hint: "Suit le fil de la conversation, sans déroulé imposé." },
  { id: "express", label: "Express", hint: "15 minutes : un constat, une décision, une action." },
];

export function normalizeStyle(raw: unknown): CoachingStyle {
  const s = (raw ?? {}) as Partial<CoachingStyle>;
  const pick = <T extends string>(v: unknown, allowed: readonly T[], def: T): T =>
    typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : def;
  return {
    tone: pick(s.tone, ["direct", "bienveillant", "socratique"] as const, "direct"),
    challenge: pick(s.challenge, ["doux", "ferme", "exigeant"] as const, "ferme"),
    format: pick(s.format, ["structure", "libre", "express"] as const, "structure"),
    customInstructions:
      typeof s.customInstructions === "string" && s.customInstructions.trim()
        ? s.customInstructions.trim().slice(0, 1000)
        : null,
  };
}

const TONE_DIRECTIVE: Record<CoachingStyle["tone"], string> = {
  direct: "Va droit au but : le constat chiffré d'abord, l'analyse ensuite. Pas de préambule ni de reformulation de politesse.",
  bienveillant: "Reconnais d'abord ce qui a été fait et les efforts réels, puis nomme l'écart sans détour. Ton encourageant, jamais complaisant.",
  socratique: "Fais émerger la réponse par des questions ciblées avant de donner ton analyse. Une question à la fois, appuyée sur un chiffre réel.",
};

const CHALLENGE_DIRECTIVE: Record<CoachingStyle["challenge"], string> = {
  doux: "Avance au rythme de la personne : une seule action à la fois, sans surcharger.",
  ferme: "Confronte systématiquement les intentions annoncées aux données réelles : si l'écart persiste, dis-le clairement.",
  exigeant: "N'accepte aucun engagement flou : chaque séance se termine par une action datée, mesurable, avec son KPI témoin. Rappelle les engagements non tenus.",
};

const FORMAT_DIRECTIVE: Record<CoachingStyle["format"], string> = {
  structure: "Déroulé complet : bilan des engagements précédents → constat chiffré → analyse → plan → engagement daté.",
  libre: "Pas de déroulé imposé : suis le fil de la conversation, mais termine toujours par un engagement daté.",
  express: "Format express (15 min) : UN constat, UNE décision, UNE action. Trois échanges maximum, puis conclus.",
};

/** Bloc injecté dans le system prompt du coach (cf. memoryDirective). */
export function styleDirective(style: CoachingStyle): string {
  return [
    "STYLE DE COACHING (choisi par l'utilisateur dans les paramètres du coach — il prime sur le style par défaut) :",
    `- Ton : ${TONE_DIRECTIVE[style.tone]}`,
    `- Challenge : ${CHALLENGE_DIRECTIVE[style.challenge]}`,
    `- Format : ${FORMAT_DIRECTIVE[style.format]}`,
    style.customInstructions ? `- Consignes de l'utilisateur, à respecter absolument : ${style.customInstructions}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
