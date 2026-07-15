"use client";

import { useState } from "react";

/**
 * Avatar illustré d'un personnage d'agent. Utilise DiceBear (illustration
 * vectorielle déterministe à partir du prénom) pour un rendu « humain » réaliste,
 * avec repli sur l'emoji du persona si l'image ne charge pas.
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
  const src = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(name)}&backgroundColor=transparent`;

  if (failed) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm ring-1 ring-black/5 ${className}`}
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
      className={`shrink-0 rounded-xl bg-white/80 object-contain shadow-sm ring-1 ring-black/5 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
