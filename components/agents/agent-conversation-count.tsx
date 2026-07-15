"use client";

import { useEffect, useState } from "react";

/** Affiche le nombre de conversations menées avec un agent (localStorage). */
export function AgentConversationCount({ agentKey }: { agentKey: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`revold:agent:${agentKey}:v1`);
      const parsed = raw ? JSON.parse(raw) : [];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCount(Array.isArray(parsed) ? parsed.length : 0);
    } catch {
      setCount(0);
    }
  }, [agentKey]);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-medium text-slate-600">
      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
      {count === null ? "…" : count} conversation{count && count > 1 ? "s" : ""}
    </span>
  );
}
