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
 * Renders a company brand logo via Google's S2 favicon service.
 * Always available, no API key required, works for any public domain.
 * Falls back to an emoji if the request fails.
 */
export function BrandLogo({ domain, alt, fallback, size = 32, className = "" }: Props) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded bg-slate-100 ${className}`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.6) }}
      >
        {fallback}
      </span>
    );
  }

  // Google asks for the next power of two ≥ requested size; max usable is 128.
  const fetchSize = size <= 32 ? 64 : 128;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=${fetchSize}`}
      alt={alt}
      width={size}
      height={size}
      onError={() => setErrored(true)}
      className={`shrink-0 rounded bg-white object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
