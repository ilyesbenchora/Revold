import { describe, it, expect } from "vitest";
import { isRoutineRowDue, lastOccurrenceMs, type RoutineRow } from "@/lib/agents/routines-server";

/**
 * Calcul d'échéance des routines côté serveur (cron run-routines) : mêmes
 * garanties que l'ancien client — pas de rapport surprise à la création, pas
 * de double exécution — plus la gestion du fuseau horaire de création.
 */

function routine(over: Partial<RoutineRow> = {}): RoutineRow {
  return {
    id: "r1",
    organization_id: "org-1",
    agent_key: "performance",
    label: "Récap ventes",
    prompt: "Récap de la semaine",
    frequency: "daily",
    time_of_day: "09:00",
    timezone: "UTC",
    active: true,
    last_run_at: null,
    last_error: null,
    created_at: "2026-08-01T00:00:00Z",
    ...over,
  };
}

describe("isRoutineRowDue", () => {
  const now = new Date("2026-08-15T10:00:00Z"); // 10h00 UTC

  it("routine en pause → jamais échue", () => {
    expect(isRoutineRowDue(routine({ active: false }), now)).toBe(false);
  });

  it("jamais exécutée, heure passée → échue", () => {
    expect(isRoutineRowDue(routine(), now)).toBe(true);
  });

  it("créée APRÈS l'occurrence du jour → attend la prochaine (pas de rapport surprise)", () => {
    expect(isRoutineRowDue(routine({ created_at: "2026-08-15T09:30:00Z" }), now)).toBe(false);
  });

  it("quotidienne : déjà exécutée après l'occurrence du jour → pas de double run", () => {
    expect(isRoutineRowDue(routine({ last_run_at: "2026-08-15T09:05:00Z" }), now)).toBe(false);
  });

  it("quotidienne : dernier run hier → échue aujourd'hui", () => {
    expect(isRoutineRowDue(routine({ last_run_at: "2026-08-14T09:05:00Z" }), now)).toBe(true);
  });

  it("heure pas encore passée aujourd'hui → l'occurrence de référence est celle d'hier", () => {
    const early = new Date("2026-08-15T08:00:00Z"); // avant 09:00
    expect(isRoutineRowDue(routine({ last_run_at: "2026-08-14T09:05:00Z" }), early)).toBe(false);
    expect(isRoutineRowDue(routine({ last_run_at: "2026-08-13T09:05:00Z" }), early)).toBe(true);
  });

  it("hebdomadaire : espacement respecté (pas de re-run à J+3, re-run à J+8)", () => {
    const weekly = { frequency: "weekly", created_at: "2026-06-01T00:00:00Z" } as const;
    expect(isRoutineRowDue(routine({ ...weekly, last_run_at: "2026-08-12T09:05:00Z" }), now)).toBe(false);
    expect(isRoutineRowDue(routine({ ...weekly, last_run_at: "2026-08-07T09:05:00Z" }), now)).toBe(true);
  });

  it("fuseau de création respecté : 09:00 Europe/Paris = 07:00 UTC en été", () => {
    const paris = routine({ timezone: "Europe/Paris" });
    // 08:30 UTC = 10:30 à Paris → l'occurrence de 09:00 (07:00 UTC) est passée.
    expect(isRoutineRowDue(paris, new Date("2026-08-15T08:30:00Z"))).toBe(true);
    // 06:30 UTC = 08:30 à Paris → pas encore 09:00 : référence = hier ;
    // dernier run hier 07:05 UTC (09:05 Paris) → pas échue.
    expect(
      isRoutineRowDue(routine({ timezone: "Europe/Paris", last_run_at: "2026-08-14T07:05:00Z" }), new Date("2026-08-15T06:30:00Z")),
    ).toBe(false);
  });
});

describe("lastOccurrenceMs", () => {
  it("occurrence du jour quand l'heure est passée, d'hier sinon (UTC)", () => {
    const now = new Date("2026-08-15T10:00:00Z");
    expect(lastOccurrenceMs(now, "09:00", "UTC")).toBe(Date.parse("2026-08-15T09:00:00Z"));
    expect(lastOccurrenceMs(now, "11:30", "UTC")).toBe(Date.parse("2026-08-14T11:30:00Z"));
  });

  it("dans un fuseau décalé, l'occurrence est exprimée au bon instant UTC", () => {
    const now = new Date("2026-08-15T10:00:00Z"); // 12:00 à Paris (été, UTC+2)
    expect(lastOccurrenceMs(now, "09:00", "Europe/Paris")).toBe(Date.parse("2026-08-15T07:00:00Z"));
  });
});
