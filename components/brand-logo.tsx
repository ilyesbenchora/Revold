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
 * Renders a company brand logo via the Clearbit Logo API.
 * Falls back to an emoji if the logo can't be loaded.
 */
export function BrandLogo({ domain, alt, fallback, size = 32, className = "" }: Props) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <span
        className={`inline-flex items-center justify-center ${className}`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.7) }}
      >
        {fallback}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://logo.clearbit.com/${domain}`}
      alt={alt}
      width={size}
      height={size}
      onError={() => setErrored(true)}
      className={`rounded object-contain ${className}`}
    />
  );
}
