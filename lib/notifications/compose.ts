import Anthropic from "@anthropic-ai/sdk";
import { getAgentPersona } from "@/lib/ai/agents/coach-personas";

/**
 * Rédaction de la notification par l'AGENT responsable (persona) quand l'APP a
 * DÉTERMINISTIQUEMENT détecté que le KPI d'une alerte / d'un objectif est atteint.
 *
 * Séparation stricte des rôles :
 *   - l'app décide « seuil atteint ? » (calcul réel + comparaison numérique) ;
 *   - l'agent explique/annonce l'atteinte en langage naturel, en s'appuyant sur
 *     la description et le contexte fournis à la création.
 *
 * Si ANTHROPIC_API_KEY est absente, on retombe sur un template fiable.
 */

// Équipe / catégorie d'une alerte → persona responsable.
const TEAM_PERSONA: Record<string, string> = {
  sales: "performance",
  commercial: "performance",
  marketing: "coaching-marketing",
  revops: "automatisations",
  ops: "automatisations",
  finance: "paiement-facturation",
  csm: "service-client",
  "service-client": "service-client",
};

function unitSym(unit: string): string {
  return unit === "percent" ? " %" : unit === "currency" ? " €" : "";
}

export type ComposeInput = {
  kind: "alerte" | "objectif";
  team?: string | null;
  category?: string | null;
  title: string;
  description?: string | null;
  userContext?: string | null;
  threshold: number | null;
  currentValue: number;
  unit: string;
  direction: string;
};

export async function composeNotification(
  input: ComposeInput,
): Promise<{ subject: string; body: string; agentName: string }> {
  const personaKey = TEAM_PERSONA[input.team ?? ""] ?? TEAM_PERSONA[input.category ?? ""] ?? "performance";
  const persona = getAgentPersona(personaKey);
  const u = unitSym(input.unit);
  const dir = input.direction === "below" ? "sous le seuil de" : "le seuil de";

  // Template fiable (fallback + base de secours).
  const subject = `${input.kind === "objectif" ? "Objectif atteint" : "Alerte déclenchée"} : ${input.title}`;
  const fallbackBody =
    `${persona.name} : le KPI « ${input.title} » a atteint ${dir} ${input.threshold}${u}. ` +
    `Valeur réelle mesurée : ${input.currentValue}${u}.` +
    (input.userContext ? ` Contexte : ${input.userContext}` : input.description ? ` ${input.description}` : "");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { subject, body: fallbackBody, agentName: persona.name };

  try {
    const client = new Anthropic({ apiKey });
    const system =
      `Tu es ${persona.name}, ${persona.role} chez Revold. ` +
      `L'application vient de détecter, sur les VRAIES données, que ce KPI est atteint. ` +
      `Rédige une notification COURTE (2-3 phrases max), claire et actionnable, dans ta voix, ` +
      `pour annoncer l'atteinte et suggérer la prochaine étape. N'invente aucun chiffre : ` +
      `utilise uniquement ceux fournis. Pas de salutation ni de signature.`;
    const userMsg =
      `${input.kind === "objectif" ? "Objectif" : "Alerte"} : « ${input.title} ».\n` +
      `Seuil visé : ${input.direction === "below" ? "≤" : "≥"} ${input.threshold}${u}.\n` +
      `Valeur réelle mesurée : ${input.currentValue}${u}.\n` +
      (input.userContext ? `Contexte fourni : ${input.userContext}\n` : "") +
      (input.description ? `Description : ${input.description}\n` : "") +
      `Annonce l'atteinte et propose la prochaine étape.`;

    const resp = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 220,
      system,
      messages: [{ role: "user", content: userMsg }],
    });
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();
    return { subject, body: text || fallbackBody, agentName: persona.name };
  } catch {
    return { subject, body: fallbackBody, agentName: persona.name };
  }
}
