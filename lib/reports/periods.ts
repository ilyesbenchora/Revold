/**
 * Périodes d'analyse des rapports — presets « type HubSpot » + personnalisé.
 * Les dates sont calculées de façon déterministe (from/to en YYYY-MM-DD) pour
 * que la ventilation temporelle soit fiable : ce sont ces dates exactes qui
 * sont passées aux outils (date_from/date_to) lors du recalcul du rapport.
 */

export type PeriodPreset =
  | "all"
  | "this_week"
  | "this_month"
  | "mtd"
  | "this_quarter"
  | "qtd"
  | "this_semester"
  | "std"
  | "this_year"
  | "ytd"
  | "custom";

export type Period = { preset: PeriodPreset; from: string; to: string; label: string };

export const PERIOD_PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: "all", label: "Toutes les données" },
  { id: "this_week", label: "Cette semaine" },
  { id: "this_month", label: "Ce mois-ci" },
  { id: "mtd", label: "Mois à ce jour" },
  { id: "this_quarter", label: "Ce trimestre" },
  { id: "qtd", label: "Trimestre à ce jour" },
  { id: "this_semester", label: "Ce semestre" },
  { id: "std", label: "Semestre à ce jour" },
  { id: "this_year", label: "Cette année" },
  { id: "ytd", label: "Année à ce jour" },
  { id: "custom", label: "Dates personnalisées" },
];

export function presetLabel(id: PeriodPreset): string {
  return PERIOD_PRESETS.find((p) => p.id === id)?.label ?? id;
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Calcule les bornes (from/to) d'un preset. `now` explicite (l'appelant fournit
 * new Date() dans un handler client) pour rester déterministe et testable.
 */
export function computePeriod(preset: PeriodPreset, now: Date): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-11
  const today = new Date(y, m, now.getDate());

  switch (preset) {
    case "all":
      return { from: "", to: "" }; // pas de filtre de date → toutes les données
    case "this_week": {
      // Semaine ISO : lundi → dimanche.
      const dow = (now.getDay() + 6) % 7; // 0 = lundi
      const mon = new Date(y, m, now.getDate() - dow);
      const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
      return { from: fmt(mon), to: fmt(sun) };
    }
    case "this_month":
      return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 0)) };
    case "mtd":
      return { from: fmt(new Date(y, m, 1)), to: fmt(today) };
    case "this_quarter": {
      const qs = Math.floor(m / 3) * 3;
      return { from: fmt(new Date(y, qs, 1)), to: fmt(new Date(y, qs + 3, 0)) };
    }
    case "qtd": {
      const qs = Math.floor(m / 3) * 3;
      return { from: fmt(new Date(y, qs, 1)), to: fmt(today) };
    }
    case "this_semester": {
      const ss = m < 6 ? 0 : 6;
      return { from: fmt(new Date(y, ss, 1)), to: fmt(new Date(y, ss + 6, 0)) };
    }
    case "std": {
      const ss = m < 6 ? 0 : 6;
      return { from: fmt(new Date(y, ss, 1)), to: fmt(today) };
    }
    case "this_year":
      return { from: fmt(new Date(y, 0, 1)), to: fmt(new Date(y, 11, 31)) };
    case "ytd":
      return { from: fmt(new Date(y, 0, 1)), to: fmt(today) };
    case "custom":
    default:
      return { from: "", to: "" };
  }
}
