"use client";

/**
 * Tons + templates de messages pour les actions de séquence (B10) : l'utilisateur
 * choisit le TON du contenu, le message se pré-remplit, et peut être mémorisé
 * pour les prochaines actions du même type (localStorage, par appareil).
 */
export type MessageTone = "direct" | "chaleureux" | "formel" | "urgent";

export const ACTION_TONES: { id: MessageTone; label: string }[] = [
  { id: "direct", label: "Direct" },
  { id: "chaleureux", label: "Chaleureux" },
  { id: "formel", label: "Formel" },
  { id: "urgent", label: "Urgence" },
];

export function emailTemplate(tone: MessageTone): { subject: string; body: string } {
  switch (tone) {
    case "direct":
      return {
        subject: "Où en est-on ?",
        body: "Bonjour,\n\nJe reviens vers vous sur notre échange : où en êtes-vous de votre côté ?\n\nSi c'est toujours d'actualité, je vous propose un point de 15 minutes cette semaine pour avancer.\n\nBien à vous.",
      };
    case "chaleureux":
      return {
        subject: "Des nouvelles de votre projet ?",
        body: "Bonjour,\n\nJ'espère que tout va bien de votre côté ! Je repensais à votre projet et je voulais prendre de vos nouvelles.\n\nSi vous avez des questions ou envie d'en rediscuter, je suis disponible avec plaisir cette semaine.\n\nAu plaisir d'échanger.",
      };
    case "formel":
      return {
        subject: "Suivi de notre proposition",
        body: "Bonjour,\n\nJe me permets de revenir vers vous concernant la proposition que nous vous avons transmise.\n\nNous restons à votre disposition pour toute précision et serions heureux de convenir d'un entretien à votre convenance.\n\nCordialement.",
      };
    case "urgent":
      return {
        subject: "Dernière ligne droite — on finalise ?",
        body: "Bonjour,\n\nNous arrivons à l'échéance évoquée ensemble : pour garantir les conditions actuelles, il nous faudrait un retour avant la fin de la semaine.\n\nJe peux me rendre disponible dès aujourd'hui pour lever les derniers points.\n\nBien à vous.",
      };
  }
}

export function taskTemplate(tone: MessageTone): string {
  switch (tone) {
    case "direct":
      return "Relancer le contact : demander où en est la décision et proposer un créneau de 15 min cette semaine.";
    case "chaleureux":
      return "Prendre des nouvelles du contact, réengager la conversation sur son projet et proposer un échange sans pression.";
    case "formel":
      return "Adresser un suivi formel de la proposition transmise et proposer un entretien à la convenance du contact.";
    case "urgent":
      return "Relance prioritaire : échéance proche — obtenir un retour avant la fin de semaine et lever les points bloquants.";
  }
}

// ── Mémorisation « réutiliser pour les prochaines » (localStorage) ──
export type SavedActionTemplate = { tone: MessageTone; subject?: string; body: string };

const key = (kind: string) => `revold:action-template:${kind}`;

export function readSavedTemplate(kind: string): SavedActionTemplate | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(kind));
    const parsed = raw ? (JSON.parse(raw) as SavedActionTemplate) : null;
    return parsed && typeof parsed.body === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function saveTemplate(kind: string, data: SavedActionTemplate): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key(kind), JSON.stringify(data));
  } catch {}
}

export function clearSavedTemplate(kind: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key(kind));
  } catch {}
}
