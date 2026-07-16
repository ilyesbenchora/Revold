/**
 * Conversation active « en arrière-plan » : quand l'utilisateur discute avec un
 * agent puis navigue ailleurs, on garde un pointeur (href de retour + contexte)
 * pour afficher un bandeau permettant de revenir ou quitter la discussion.
 */

export type ActiveChat = {
  href: string;
  agentLabel: string;
  personaName?: string;
  personaEmoji?: string;
  personaImage?: string | null;
  snippet?: string;
  updatedAt: number;
};

const KEY = "revold:active-chat";
export const ACTIVE_CHAT_EVENT = "revold:active-chat-updated";

function emit() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(ACTIVE_CHAT_EVENT));
  } catch {
    /* ignore */
  }
}

export function getActiveChat(): ActiveChat | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ActiveChat) : null;
  } catch {
    return null;
  }
}

export function setActiveChat(c: Omit<ActiveChat, "updatedAt">): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...c, updatedAt: Date.now() }));
    emit();
  } catch {
    /* ignore */
  }
}

export function clearActiveChat(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
    emit();
  } catch {
    /* ignore */
  }
}
