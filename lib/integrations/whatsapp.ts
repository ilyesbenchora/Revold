import { getAgentPersona } from "@/lib/ai/agents/coach-personas";

/** Agents proposés au choix via WhatsApp (menu numéroté). */
export const WA_MENU_AGENTS: string[] = [
  "coaching-ventes",
  "coaching-marketing",
  "coaching-data",
  "coaching-cross-source",
  "performance",
  "paiement-facturation",
  "reporting",
];

/** Construit le message de menu (choix de l'agent). */
export function buildAgentMenu(): string {
  const lines = WA_MENU_AGENTS.map((key, i) => {
    const p = getAgentPersona(key);
    return `${i + 1}. ${p.name} — ${p.role}`;
  });
  return (
    "👋 Bienvenue sur Revold ! Avec quel agent veux-tu discuter ?\n\n" +
    lines.join("\n") +
    "\n\nRéponds par le numéro. Tape *menu* à tout moment pour changer d'agent."
  );
}

/** Résout un choix de menu (numéro ou nom) en clé d'agent. */
export function resolveAgentChoice(text: string): string | null {
  const t = text.trim().toLowerCase();
  const num = parseInt(t, 10);
  if (!Number.isNaN(num) && num >= 1 && num <= WA_MENU_AGENTS.length) {
    return WA_MENU_AGENTS[num - 1];
  }
  for (const key of WA_MENU_AGENTS) {
    if (getAgentPersona(key).name.toLowerCase() === t) return key;
  }
  return null;
}

/** Envoie un message texte via l'API WhatsApp Cloud. */
export async function sendWhatsAppText(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string,
): Promise<boolean> {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text.slice(0, 4000) },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
