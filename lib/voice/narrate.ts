import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicKey } from "@/lib/ai/anthropic-key";

/**
 * Narration parlée de la tour de contrôle — même séparation des rôles que les
 * notifications (lib/notifications/compose.ts) : l'APP calcule les chiffres
 * (déterministe), l'AGENT les met en récit pour l'écoute.
 *
 * Le texte déterministe des routes brief/récap est exact mais télégraphique :
 * à voix haute, ça donne une dictée de chiffres trop rapide à suivre. Ici on
 * le réécrit comme un vrai point d'équipe : adresse directe, lecture
 * d'ensemble, chaque chiffre posé avec son contexte, transitions, conclusion.
 *
 * Retourne null si la clé API est absente ou l'appel échoue : l'appelant garde
 * alors le texte déterministe — le brief reste toujours disponible.
 */

export type NarrateInput = {
  kind: "brief" | "recap";
  /** Prénom de l'auditeur pour l'adresse directe (null → pas de prénom). */
  firstName?: string | null;
  /** Faits calculés par l'app — SEULE source de vérité, aucun chiffre inventé. */
  facts: string;
};

export async function narrateForVoice(input: NarrateInput): Promise<string | null> {
  const facts = input.facts.trim();
  if (!facts) return null;
  const { key: apiKey } = getAnthropicKey();
  if (!apiKey) return null;

  const kindLabel = input.kind === "recap" ? "le récap de période de son équipe" : "son brief du jour";
  const system =
    `Tu es la voix de la tour de contrôle Revold, l'assistante revenue de confiance de l'utilisateur. ` +
    `Tu lui présentes ${kindLabel} À VOIX HAUTE (le texte part en synthèse vocale). ` +
    `L'application a déjà calculé tous les chiffres sur les vraies données : ils sont exacts et complets.\n\n` +
    `Ton style, comme un bon chief of staff qui fait le point :\n` +
    `- Adresse-toi directement à lui${input.firstName ? ` (il s'appelle ${input.firstName})` : ""}, tutoiement, ton posé et complice.\n` +
    `- Ouvre par une lecture d'ensemble qui donne la couleur avant les chiffres (« Grosse semaine », « Deux points de vigilance aujourd'hui », « Semaine plus calme »…), déduite UNIQUEMENT des faits fournis.\n` +
    `- Livre ensuite chaque chiffre posément, avec son contexte : ce qu'il représente, l'outil source s'il est mentionné, et la comparaison fournie (période précédente, seuil, objectif) reformulée en langage parlé — « on est 18 % au-dessus », « il manque 12 % pour le seuil ».\n` +
    `- Une information par phrase, phrases complètes — jamais de style télégraphique ni d'énumération sèche.\n` +
    `- Marque les transitions entre les sujets (« Côté ventes… », « Sur la facturation maintenant… », « Et pour finir… »).\n` +
    `- Termine par LA priorité qui ressort des faits (ou un encouragement sincère si tout est au vert).\n\n` +
    `Règles strictes :\n` +
    `- Reprends TOUS les chiffres, noms et dates fournis, sans en inventer, en modifier ni en omettre un seul.\n` +
    `- N'ajoute aucune donnée, cause ou interprétation qui ne découle pas directement des faits.\n` +
    `- Texte prêt à lire : pas de markdown, pas de liste, pas d'émoji, pas d'abréviation imprononçable.\n` +
    `- Réponds UNIQUEMENT avec le texte à lire, sans préambule.`;

  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 900,
      system,
      messages: [
        {
          role: "user",
          content: `Faits calculés par l'application (source de vérité) :\n${facts}\n\nMets ce ${input.kind === "recap" ? "récap" : "brief"} en récit parlé.`,
        },
      ],
    });
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();
    return text || null;
  } catch {
    return null;
  }
}

/** Prénom lisible depuis les métadonnées auth (Google ou inscription email). */
export function firstNameFromUser(user: { user_metadata?: Record<string, unknown> | null; email?: string | null }): string | null {
  const meta = user.user_metadata ?? {};
  const raw =
    (typeof meta.first_name === "string" && meta.first_name) ||
    (typeof meta.given_name === "string" && meta.given_name) ||
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    "";
  const first = raw.trim().split(/\s+/)[0] ?? "";
  if (first.length >= 2) return first.charAt(0).toUpperCase() + first.slice(1);
  return null;
}
