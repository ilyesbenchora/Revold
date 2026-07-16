"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AgentAvatar } from "./agents/agent-avatar";
import { ACTIVE_CHAT_EVENT, clearActiveChat, getActiveChat, type ActiveChat } from "@/lib/chat/active-chat";

/**
 * Bandeau flottant : quand une discussion agent est en cours et qu'on navigue
 * ailleurs, il permet de « revenir » à la conversation ou de la « quitter ».
 */
export function ActiveChatBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const [chat, setChat] = useState<ActiveChat | null>(null);

  useEffect(() => {
    const refresh = () => setChat(getActiveChat());
    refresh();
    window.addEventListener(ACTIVE_CHAT_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(ACTIVE_CHAT_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // Masqué si aucune conversation, ou si on est déjà sur sa page.
  if (!chat) return null;
  if (pathname === chat.href || pathname.startsWith(chat.href + "/")) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[80] w-[min(560px,92vw)] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl border border-fuchsia-200 bg-white/95 px-3.5 py-2.5 shadow-xl backdrop-blur">
        <span className="relative shrink-0">
          <AgentAvatar
            name={chat.personaName ?? chat.agentLabel}
            emoji={chat.personaEmoji ?? "✨"}
            image={chat.personaImage ?? undefined}
            size={34}
          />
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">Discussion avec {chat.agentLabel}</p>
          {chat.snippet && <p className="truncate text-[11px] text-slate-500">{chat.snippet}</p>}
        </div>
        <button
          onClick={() => router.push(chat.href)}
          className="shrink-0 rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
        >
          Revenir
        </button>
        <button
          onClick={() => clearActiveChat()}
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
        >
          Quitter
        </button>
      </div>
    </div>
  );
}
