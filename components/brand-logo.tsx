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
 * Logo de marque avec cascade de qualité :
 *   1. Clearbit Logo API — vrai logo SVG/PNG haute qualité, gratuit, sans token
 *   2. Google S2 favicon — fallback rapide si Clearbit n'a pas la marque
 *   3. Emoji custom — dernier recours visuel
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

  // Clearbit demande la taille en `size=` jusqu'à 256
  const clearbitSize = Math.min(256, Math.max(64, size * 2));
  // Google favicon : suit la prochaine puissance de 2
  const googleSize = size <= 32 ? 64 : 128;

  const src =
    stage === 0
      ? `https://logo.clearbit.com/${domain}?size=${clearbitSize}`
      : `https://www.google.com/s2/favicons?domain=${domain}&sz=${googleSize}`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      onError={() => setStage((s) => (s === 0 ? 1 : 2))}
      className={`shrink-0 rounded bg-white object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
