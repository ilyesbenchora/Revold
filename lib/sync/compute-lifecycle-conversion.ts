/**
 * Funnel de conversion du Lifecycle Stage HubSpot.
 *
 * Méthode CRO :
 *   - Ordre canonique HubSpot : subscriber → lead → MQL → SQL → opportunity
 *     → customer → evangelist
 *   - Pour chaque stage, on filtre aux "stages clés" (ceux où il y a au
 *     moins 1 contact actuellement). Les stages vides sont skipped.
 *   - reached[i] = somme des contacts dans key_stage[i] ET tous les key_
 *     stages suivants (un Customer a forcément été Lead avant).
 *   - conversion(i → i+1) = reached[i+1] / reached[i]
 *
 * Avantages :
 *   - Pas de dépendance HubSpot live (lit lifecycleByStage du snapshot)
 *   - Filtrage automatique des stages custom non-standards
 *   - Stages vides ignorés (sinon "100% conversion partout, peu de signal")
 */

import type { HubSpotSnapshot } from "@/lib/integrations/hubspot-snapshot";

// Ordre canonique HubSpot. Les valeurs HubSpot sont en lowercase sans
// underscore (ex: "marketingqualifiedlead"). Tout stage non listé ici
// (custom de l'org) est ignoré dans le funnel — sinon on casserait l'ordre.
const CANONICAL_ORDER: Array<{ value: string; label: string }> = [
  { value: "subscriber", label: "Subscriber" },
  { value: "lead", label: "Lead" },
  { value: "marketingqualifiedlead", label: "MQL" },
  { value: "salesqualifiedlead", label: "SQL" },
  { value: "opportunity", label: "Opportunity" },
  { value: "customer", label: "Customer" },
  { value: "evangelist", label: "Evangelist" },
];

export type LifecycleStageConversion = {
  value: string;
  label: string;
  inStageCount: number;
  reachedCount: number;
  conversionToNextPct: number | null;
  nextLabel: string | null;
};

export type LifecycleConversion = {
  /** Stages clés réellement utilisés (ont au moins 1 contact). */
  stages: LifecycleStageConversion[];
  /** Volume total entré dans le 1er stage clé. */
  totalEntries: number;
  /** Conversion globale 1ère étape → dernière étape clé. */
  endToEndPct: number | null;
  /** Total contacts répartis dans les stages canoniques. */
  totalContactsInFunnel: number;
  /** Contacts hors funnel (lifecycle custom ou null). */
  contactsOutsideFunnel: number;
  /** True si moins de 2 stages peuplés → impossible de calculer. */
  insufficientStages: boolean;
};

export function buildLifecycleConversion(
  snapshot: Pick<HubSpotSnapshot, "lifecycleByStage" | "totalContacts">,
): LifecycleConversion {
  const lifecycle = snapshot.lifecycleByStage ?? {};

  // Compte par stage canonique — case-insensitive matching
  const counts = new Map<string, number>();
  let totalInFunnel = 0;
  for (const stage of CANONICAL_ORDER) {
    const entry = lifecycle[stage.value];
    const count = entry?.count ?? 0;
    counts.set(stage.value, count);
    totalInFunnel += count;
  }
  const contactsOutsideFunnel = Math.max(0, snapshot.totalContacts - totalInFunnel);

  // Filtrage : on ne garde que les stages clés (count > 0)
  const keyStages = CANONICAL_ORDER.filter((s) => (counts.get(s.value) ?? 0) > 0);

  if (keyStages.length < 2) {
    return {
      stages: keyStages.map((s) => ({
        value: s.value,
        label: s.label,
        inStageCount: counts.get(s.value) ?? 0,
        reachedCount: counts.get(s.value) ?? 0,
        conversionToNextPct: null,
        nextLabel: null,
      })),
      totalEntries: keyStages[0] ? counts.get(keyStages[0].value) ?? 0 : 0,
      endToEndPct: null,
      totalContactsInFunnel: totalInFunnel,
      contactsOutsideFunnel,
      insufficientStages: true,
    };
  }

  // Cumul reached depuis la fin (un Customer a traversé Lead, MQL, SQL...)
  const reachedFromEnd: number[] = new Array(keyStages.length).fill(0);
  let cumul = 0;
  for (let i = keyStages.length - 1; i >= 0; i--) {
    cumul += counts.get(keyStages[i].value) ?? 0;
    reachedFromEnd[i] = cumul;
  }

  const stages: LifecycleStageConversion[] = keyStages.map((s, i) => {
    const inStage = counts.get(s.value) ?? 0;
    const reached = reachedFromEnd[i];
    const next = keyStages[i + 1] ?? null;
    const reachedNext = next ? reachedFromEnd[i + 1] : null;
    const conversionToNextPct =
      next && reached > 0 && reachedNext !== null
        ? Math.round((reachedNext / reached) * 100)
        : null;
    return {
      value: s.value,
      label: s.label,
      inStageCount: inStage,
      reachedCount: reached,
      conversionToNextPct,
      nextLabel: next?.label ?? null,
    };
  });

  const totalEntries = stages[0]?.reachedCount ?? 0;
  const lastReached = stages[stages.length - 1]?.reachedCount ?? 0;
  const endToEndPct = totalEntries > 0 ? Math.round((lastReached / totalEntries) * 100) : null;

  return {
    stages,
    totalEntries,
    endToEndPct,
    totalContactsInFunnel: totalInFunnel,
    contactsOutsideFunnel,
    insufficientStages: false,
  };
}
