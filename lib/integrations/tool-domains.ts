/**
 * Résolution clé d'outil → domaine (logo de marque via BrandLogo).
 * Module léger importable côté client : dérivé du catalogue une seule fois.
 */

import { CONNECTABLE_TOOLS } from "./connect-catalog";

export const TOOL_DOMAINS: Record<string, string> = Object.fromEntries(
  Object.values(CONNECTABLE_TOOLS).map((t) => [t.key, t.domain]),
);

/** Domaine du logo pour une clé d'outil ("" si inconnu → fallback emoji). */
export function toolDomain(key: string): string {
  return TOOL_DOMAINS[key] ?? "";
}
