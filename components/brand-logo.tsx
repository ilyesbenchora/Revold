"use client";

import { useState } from "react";

type Props = {
  domain: string;
  alt: string;
  fallback: string;
  size?: number;
  className?: string;
};

/**
 * Logo de marque — cascade fiable :
 *   1. DuckDuckGo Icon API — sans token, qualité décente, accepte tout domaine
 *   2. Google S2 Favicon (redirect → image) — fallback final fonctionnel
 *   3. Emoji custom — si tout échoue
 *
 * Note : Clearbit Logo API a été shutdown fin 2023. Logo.dev nécessite un
 * token payant. DuckDuckGo + Google reste la combo gratuite la plus fiable.
 */
export function BrandLogo({ domain, alt, fallback, size = 32, className = "" }: Props) {
  const [stage, setStage] = useState<0 | 1 | 2>(0);

  if (stage === 2) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded bg-slate-100 ${className}`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.6) }}
      >
        {fallback}
      </span>
    );
  }

  // DuckDuckGo : icône directe en haute qualité
  // Google favicon : suit la prochaine puissance de 2, max 256
  const googleSize = size <= 32 ? 64 : size <= 64 ? 128 : 256;

  const src =
    stage === 0
      ? `https://icons.duckduckgo.com/ip3/${domain}.ico`
      : `https://www.google.com/s2/favicons?domain=${domain}&sz=${googleSize}`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      onError={() => setStage((s) => (s < 2 ? ((s + 1) as 0 | 1 | 2) : s))}
      className={`shrink-0 rounded bg-white object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
