"use client";

/**
 * Briques UI partagées entre les blocs des pages Ventes :
 *   - BlockHeaderIcon : remplace les pastilles colorées par une icône
 *     parlante (kanban / funnel / lock / eye-off / clock / calendar...)
 *   - SortHeader      : entête de colonne triable avec flèches ↑/↓
 *   - DaysCell        : cellule "jours dans étape" avec code couleur
 *   - useSorter       : hook de tri d'un tableau de deals sur une clé
 */

import { useMemo, useState } from "react";

// ── Icônes (svg inline, design system Lucide-like) ───────────────────────

type IconName =
  | "kanban"
  | "funnel"
  | "lock"
  | "eye-off"
  | "user-clock"
  | "alarm"
  | "calendar";

function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  const common = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };
  switch (name) {
    case "kanban":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="6" height="14" rx="1" />
          <rect x="11" y="3" width="6" height="10" rx="1" />
          <rect x="19" y="3" width="2" height="6" rx="1" />
        </svg>
      );
    case "funnel":
      return (
        <svg {...common}>
          <path d="M3 4h18l-7 9v6l-4 2v-8L3 4z" />
        </svg>
      );
    case "lock":
      return (
        <svg {...common}>
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case "eye-off":
      return (
        <svg {...common}>
          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.17-5.94" />
          <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      );
    case "user-clock":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <circle cx="18" cy="17" r="4" />
          <path d="M18 15v2l1 1" />
        </svg>
      );
    case "alarm":
      return (
        <svg {...common}>
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2 2" />
          <path d="M5 3 2 6" />
          <path d="m22 6-3-3" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
  }
}

// ── BlockHeaderIcon : badge coloré avec icône, à insérer dans le <h2> ──

type Tone = "blue" | "fuchsia" | "red" | "orange" | "amber" | "emerald";

const TONES: Record<Tone, string> = {
  blue: "bg-blue-100 text-blue-700",
  fuchsia: "bg-fuchsia-100 text-fuchsia-700",
  red: "bg-red-100 text-red-700",
  orange: "bg-orange-100 text-orange-700",
  amber: "bg-amber-100 text-amber-700",
  emerald: "bg-emerald-100 text-emerald-700",
};

export function BlockHeaderIcon({ icon, tone }: { icon: IconName; tone: Tone }) {
  return (
    <span
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TONES[tone]}`}
      aria-hidden
    >
      <Icon name={icon} />
    </span>
  );
}

// ── SortHeader : entête de colonne avec flèches ↑/↓ ────────────────────

export type SortDirection = "asc" | "desc";

export function SortHeader({
  label,
  active,
  direction,
  onToggle,
  align = "left",
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onToggle: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`group inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider ${
        active ? "text-slate-700" : "text-slate-400 hover:text-slate-600"
      } ${align === "right" ? "ml-auto" : ""}`}
    >
      {label}
      <span className="flex flex-col leading-none">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="8"
          height="6"
          viewBox="0 0 8 6"
          fill="currentColor"
          className={`${active && direction === "asc" ? "text-accent" : "text-slate-300 group-hover:text-slate-400"}`}
        >
          <path d="M4 0l4 6H0z" />
        </svg>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="8"
          height="6"
          viewBox="0 0 8 6"
          fill="currentColor"
          className={`${active && direction === "desc" ? "text-accent" : "text-slate-300 group-hover:text-slate-400"}`}
        >
          <path d="M0 0h8L4 6z" />
        </svg>
      </span>
    </button>
  );
}

// ── useSorter : hook de tri générique ──────────────────────────────────

export function useSorter<T>(items: T[], defaultKey: keyof T, defaultDir: SortDirection = "desc") {
  const [sortKey, setSortKey] = useState<keyof T>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDirection>(defaultDir);

  const sorted = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      // null/undefined toujours en queue
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      // dates ISO ou strings
      const sa = String(va);
      const sb = String(vb);
      return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
    return arr;
  }, [items, sortKey, sortDir]);

  function toggle(key: keyof T) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return { sorted, sortKey, sortDir, toggle };
}

// ── DaysCell : badge coloré selon l'ancienneté ─────────────────────────

export function daysTone(days: number): Tone {
  if (days <= 7) return "emerald";
  if (days <= 21) return "amber";
  return "red";
}

export function DaysCell({ days, suffix = "j" }: { days: number; suffix?: string }) {
  const tone = daysTone(days);
  const cls =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}
    >
      {days}
      {suffix}
    </span>
  );
}
