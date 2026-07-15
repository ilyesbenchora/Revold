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
  size = 44,
  className = "",
}: {
  name: string;
  emoji: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = personaAvatarUrl(name, size * 2);

  if (failed) {
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
      src={src}
      alt={name}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full object-cover shadow-sm ring-1 ring-black/5 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
