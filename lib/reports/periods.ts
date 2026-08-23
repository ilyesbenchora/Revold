/**
 * Périodes d'analyse des rapports — presets « type HubSpot » + personnalisé.
 * Les dates sont calculées de façon déterministe (from/to en YYYY-MM-DD) pour
 * que la ventilation temporelle soit fiable : ce sont ces dates exactes qui
 * sont passées aux outils (date_from/date_to) lors du recalcul du rapport.
 */

export type PeriodPreset =
  | "all"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "mtd"
  | "this_quarter"
  | "last_quarter"
  | "qtd"
  | "this_semester"
  | "std"
  | "this_year"
  | "last_year"
  | "ytd"
  | "exercice"
  | "last_exercice"
  | "custom";

export type Period = { preset: PeriodPreset; from: string; to: string; label: string };

export const PERIOD_PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: "all", label: "Toutes les données" },
  { id: "this_week", label: "Cette semaine" },
  { id: "last_week", label: "Semaine dernière" },
  { id: "this_month", label: "Ce mois-ci" },
  { id: "last_month", label: "Mois dernier" },
  { id: "mtd", label: "Mois à ce jour" },
  { id: "this_quarter", label: "Ce trimestre" },
  { id: "last_quarter", label: "Trimestre dernier" },
  { id: "qtd", label: "Trimestre à ce jour" },
  { id: "this_semester", label: "Ce semestre" },
  { id: "std", label: "Semestre à ce jour" },
  { id: "this_year", label: "Cette année" },
  { id: "last_year", label: "Année dernière" },
  { id: "ytd", label: "Année à ce jour" },
  { id: "exercice", label: "Exercice en cours" },
  { id: "last_exercice", label: "Exercice précédent" },
  { id: "custom", label: "Dates personnalisées" },
];

export function presetLabel(id: PeriodPreset): string {
  return PERIOD_PRESETS.find((p) => p.id === id)?.label ?? id;
}

// ── Période stockée sur une table de données (page_data_tables.period_preset) ──
// La colonne texte accepte trois formes :
//   - un preset ("all", "this_month", …)
//   - "description" → la période est déjà précisée dans la description du KPI :
//     l'agent l'a intégrée au câblage, la table s'ouvre sans re-filtre de date
//   - "custom:YYYY-MM-DD..YYYY-MM-DD" → plage personnalisée figée

/** Valeur sentinelle : période décrite dans la description (pas de re-filtre). */
export const PERIOD_FROM_DESCRIPTION = "description";

const CUSTOM_RE = /^custom:(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;

export function serializeCustomPeriod(from: string, to: string): string {
  return `custom:${from}..${to}`;
}

export type StoredPeriod =
  | { kind: "preset"; preset: PeriodPreset }
  | { kind: "description" }
  | { kind: "custom"; from: string; to: string };

export function parseStoredPeriod(raw: string | null | undefined): StoredPeriod {
  if (!raw || raw === "all") return { kind: "preset", preset: "all" };
  if (raw === PERIOD_FROM_DESCRIPTION) return { kind: "description" };
  const m = CUSTOM_RE.exec(raw);
  if (m) return { kind: "custom", from: m[1], to: m[2] };
  if (PERIOD_PRESETS.some((p) => p.id === raw)) return { kind: "preset", preset: raw as PeriodPreset };
  return { kind: "preset", preset: "all" };
}

/** Valide une période stockée reçue du client (repli « all » si inconnue). */
export function sanitizeStoredPeriod(v: unknown): string {
  if (typeof v !== "string") return "all";
  if (v === PERIOD_FROM_DESCRIPTION) return v;
  const m = CUSTOM_RE.exec(v);
  if (m) return m[1] <= m[2] ? v : "all"; // bornes inversées → repli sûr
  return PERIOD_PRESETS.some((p) => p.id === v && p.id !== "custom") ? v : "all";
}

const fmtFr = (iso: string): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

/** Libellé lisible d'une période stockée (pour la barre de période de la table). */
export function storedPeriodLabel(raw: string | null | undefined): string {
  const p = parseStoredPeriod(raw);
  if (p.kind === "description") return "Période de la description";
  if (p.kind === "custom") return `${fmtFr(p.from)} → ${fmtFr(p.to)}`;
  return presetLabel(p.preset);
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
 * `fiscalYearStart` (mois 1-12, réglage Paramètres → Général) ne sert qu'aux
 * presets « exercice » — défaut janvier = année civile.
 */
export function computePeriod(preset: PeriodPreset, now: Date, fiscalYearStart = 1): { from: string; to: string } {
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
    case "last_week": {
      const dow = (now.getDay() + 6) % 7; // 0 = lundi
      const mon = new Date(y, m, now.getDate() - dow - 7);
      const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
      return { from: fmt(mon), to: fmt(sun) };
    }
    case "this_month":
      return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 0)) };
    case "last_month":
      return { from: fmt(new Date(y, m - 1, 1)), to: fmt(new Date(y, m, 0)) };
    case "mtd":
      return { from: fmt(new Date(y, m, 1)), to: fmt(today) };
    case "this_quarter": {
      const qs = Math.floor(m / 3) * 3;
      return { from: fmt(new Date(y, qs, 1)), to: fmt(new Date(y, qs + 3, 0)) };
    }
    case "last_quarter": {
      const qs = Math.floor(m / 3) * 3 - 3;
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
    case "last_year":
      return { from: fmt(new Date(y - 1, 0, 1)), to: fmt(new Date(y - 1, 11, 31)) };
    case "ytd":
      return { from: fmt(new Date(y, 0, 1)), to: fmt(today) };
    case "exercice": {
      // Exercice comptable en cours : démarre au dernier mois de début
      // d'exercice atteint (ex : début juillet → 1er juil. N-1 si on est en mars).
      const fs = Math.min(12, Math.max(1, fiscalYearStart)) - 1; // 0-11
      const startYear = m >= fs ? y : y - 1;
      return { from: fmt(new Date(startYear, fs, 1)), to: fmt(new Date(startYear + 1, fs, 0)) };
    }
    case "last_exercice": {
      const fs = Math.min(12, Math.max(1, fiscalYearStart)) - 1;
      const startYear = (m >= fs ? y : y - 1) - 1;
      return { from: fmt(new Date(startYear, fs, 1)), to: fmt(new Date(startYear + 1, fs, 0)) };
    }
    case "custom":
    default:
      return { from: "", to: "" };
  }
}
