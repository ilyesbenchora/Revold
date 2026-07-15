"use client";

import { useState } from "react";
import { personaAvatarUrl } from "@/lib/ai/agents/coach-personas";

/**
 * Avatar photoréaliste d'un personnage d'agent — une vraie photo humaine,
 * déterministe (même personnage = même visage), pour un rendu 100 % humain.
 * Repli sur l'emoji du persona si l'image ne charge pas.
 */
export function AgentAvatar({
  name,
  emoji,
  image,
  size = 44,
  className = "",
}: {
  name: string;
  emoji: string;
  /** Portrait sur-mesure hébergé (essayé en priorité). */
  image?: string | null;
  size?: number;
  className?: string;
}) {
  // Cascade : portrait sur-mesure → illustration déterministe → emoji.
  const sources = [image, personaAvatarUrl(name, size * 2)].filter(Boolean) as string[];
  const [stage, setStage] = useState(0);

  if (stage >= sources.length) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-white/80 shadow-sm ring-1 ring-black/5 ${className}`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
      >
        {emoji}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={sources[stage]}
      alt={name}
      width={size}
      height={size}
      onError={() => setStage((s) => s + 1)}
      className={`shrink-0 rounded-full object-cover shadow-sm ring-1 ring-black/5 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
