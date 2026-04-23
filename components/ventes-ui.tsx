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
  | "calendar"
  | "database"
  | "users"
  | "building"
  | "briefcase"
  | "workflow"
  | "megaphone"
  | "euro"
  | "credit-card"
  | "file-text"
  | "headset"
  | "message-circle"
  | "repeat"
  | "trending-up"
  | "log-out"
  | "shield"
  | "sparkles"
  | "alert-triangle";

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
    case "database":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
          <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "building":
      return (
        <svg {...common}>
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M9 22v-4h6v4" />
          <path d="M8 6h.01" />
          <path d="M12 6h.01" />
          <path d="M16 6h.01" />
          <path d="M8 10h.01" />
          <path d="M12 10h.01" />
          <path d="M16 10h.01" />
          <path d="M8 14h.01" />
          <path d="M12 14h.01" />
          <path d="M16 14h.01" />
        </svg>
      );
    case "briefcase":
      return (
        <svg {...common}>
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      );
    case "workflow":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="6" height="6" rx="1" />
          <rect x="15" y="15" width="6" height="6" rx="1" />
          <path d="M9 6h6a3 3 0 0 1 3 3v6" />
        </svg>
      );
    case "megaphone":
      return (
        <svg {...common}>
          <path d="M3 11l18-7v16L3 13v-2z" />
          <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
        </svg>
      );
    case "euro":
      return (
        <svg {...common}>
          <path d="M4 10h12" />
          <path d="M4 14h9" />
          <path d="M19 6a7.5 7.5 0 1 0 0 12" />
        </svg>
      );
    case "credit-card":
      return (
        <svg {...common}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      );
    case "file-text":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case "headset":
      return (
        <svg {...common}>
          <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
          <path d="M21 19a2 2 0 0 1-2 2h-1v-7h3v5z" />
          <path d="M3 19a2 2 0 0 0 2 2h1v-7H3v5z" />
        </svg>
      );
    case "message-circle":
      return (
        <svg {...common}>
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      );
    case "repeat":
      return (
        <svg {...common}>
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      );
    case "trending-up":
      return (
        <svg {...common}>
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      );
    case "log-out":
      return (
        <svg {...common}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "sparkles":
      return (
        <svg {...common}>
          <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17l-1.9-5.6L4.5 10l5.6-1.4L12 3z" />
          <path d="M5 19l1 2 2-1-2-1z" />
        </svg>
      );
    case "alert-triangle":
      return (
        <svg {...common}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
  }
}

// ── BlockHeaderIcon : badge coloré avec icône, à insérer dans le <h2> ──

type Tone =
  | "blue"
  | "fuchsia"
  | "red"
  | "orange"
  | "amber"
  | "emerald"
  | "indigo"
  | "violet"
  | "slate"
  | "teal"
  | "rose"
  | "sky";

const TONES: Record<Tone, string> = {
  blue: "bg-blue-100 text-blue-700",
  fuchsia: "bg-fuchsia-100 text-fuchsia-700",
  red: "bg-red-100 text-red-700",
  orange: "bg-orange-100 text-orange-700",
  amber: "bg-amber-100 text-amber-700",
  emerald: "bg-emerald-100 text-emerald-700",
  indigo: "bg-indigo-100 text-indigo-700",
  violet: "bg-violet-100 text-violet-700",
  slate: "bg-slate-100 text-slate-700",
  teal: "bg-teal-100 text-teal-700",
  rose: "bg-rose-100 text-rose-700",
  sky: "bg-sky-100 text-sky-700",
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
