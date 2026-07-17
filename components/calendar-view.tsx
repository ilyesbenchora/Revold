"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type CalEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  tone?: "amber" | "rose" | "indigo" | "emerald" | "slate";
  href?: string;
  sub?: string;
};

const TONE: Record<string, string> = {
  amber: "bg-amber-100 text-amber-800 border-amber-200",
  rose: "bg-rose-100 text-rose-800 border-rose-200",
  indigo: "bg-indigo-100 text-indigo-800 border-indigo-200",
  emerald: "bg-emerald-100 text-emerald-800 border-emerald-200",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
};

const DOW = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isoWeekMonday(d: Date): Date {
  const dow = (d.getDay() + 6) % 7; // 0 = lundi
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
}

/**
 * Table calendrier type Notion/Google Calendar : bascule Jour / Semaine / Mois,
 * navigation ← →, événements colorés cliquables. Vue lecture/navigation.
 */
export function CalendarView({ events, emptyLabel = "Aucun événement." }: { events: CalEvent[]; emptyLabel?: string }) {
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [cursor, setCursor] = useState<Date | null>(null);

  // Init côté client uniquement (évite d'appeler Date au rendu serveur).
  useEffect(() => {
    setCursor(new Date());
  }, []);

  if (!cursor) return <div className="card p-8 text-center text-sm text-slate-400">Chargement du calendrier…</div>;

  const byDate = new Map<string, CalEvent[]>();
  for (const e of events) {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date)!.push(e);
  }
  const todayStr = ymd(new Date());

  function shift(dir: 1 | -1) {
    const c = new Date(cursor!);
    if (view === "month") c.setMonth(c.getMonth() + dir);
    else if (view === "week") c.setDate(c.getDate() + 7 * dir);
    else c.setDate(c.getDate() + dir);
    setCursor(c);
  }

  // Libellé de période courante
  let label = "";
  if (view === "month") label = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  else if (view === "week") {
    const mon = isoWeekMonday(cursor);
    const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
    label = `${mon.getDate()} ${MONTHS[mon.getMonth()].slice(0, 3)} — ${sun.getDate()} ${MONTHS[sun.getMonth()].slice(0, 3)} ${sun.getFullYear()}`;
  } else label = `${cursor.getDate()} ${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;

  const chip = (e: CalEvent) => {
    const cls = `block truncate rounded border px-1.5 py-0.5 text-[10px] font-medium ${TONE[e.tone ?? "slate"]}`;
    const inner = (
      <>
        {e.title}
        {e.sub ? <span className="ml-1 opacity-70">· {e.sub}</span> : null}
      </>
    );
    return e.href ? (
      <Link key={e.id} href={e.href} className={cls} title={e.title}>{inner}</Link>
    ) : (
      <span key={e.id} className={cls} title={e.title}>{inner}</span>
    );
  };

  return (
    <div className="card overflow-hidden">
      {/* Barre de contrôle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} aria-label="Précédent" className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">‹</button>
          <button onClick={() => setCursor(new Date())} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">Aujourd&apos;hui</button>
          <button onClick={() => shift(1)} aria-label="Suivant" className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">›</button>
          <span className="ml-1 text-sm font-semibold text-slate-900">{label}</span>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-slate-200">
          {(["day", "week", "month"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1 text-xs font-medium transition ${view === v ? "bg-accent text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
              {v === "day" ? "Jour" : v === "week" ? "Semaine" : "Mois"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Mois ── */}
      {view === "month" && (() => {
        const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        const start = isoWeekMonday(first);
        const cells = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
        return (
          <div>
            <div className="grid grid-cols-7 border-b border-card-border bg-slate-50 text-center text-[10px] font-semibold uppercase text-slate-400">
              {DOW.map((d) => <div key={d} className="py-1.5">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((d, i) => {
                const ds = ymd(d);
                const inMonth = d.getMonth() === cursor.getMonth();
                const evs = byDate.get(ds) ?? [];
                return (
                  <div key={i} className={`min-h-[92px] border-b border-r border-card-border p-1 ${inMonth ? "" : "bg-slate-50/50"}`}>
                    <div className={`mb-1 text-[11px] font-medium ${ds === todayStr ? "flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white" : inMonth ? "text-slate-500" : "text-slate-300"}`}>{d.getDate()}</div>
                    <div className="space-y-0.5">{evs.slice(0, 4).map(chip)}{evs.length > 4 && <span className="text-[9px] text-slate-400">+{evs.length - 4}</span>}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Semaine ── */}
      {view === "week" && (() => {
        const mon = isoWeekMonday(cursor);
        const days = Array.from({ length: 7 }, (_, i) => new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i));
        return (
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              const ds = ymd(d);
              const evs = byDate.get(ds) ?? [];
              return (
                <div key={i} className="min-h-[180px] border-r border-card-border p-2">
                  <div className={`mb-1.5 text-center text-[11px] font-semibold ${ds === todayStr ? "text-accent" : "text-slate-500"}`}>{DOW[i]} {d.getDate()}</div>
                  <div className="space-y-1">{evs.length === 0 ? <span className="text-[10px] text-slate-300">—</span> : evs.map(chip)}</div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── Jour ── */}
      {view === "day" && (() => {
        const ds = ymd(cursor);
        const evs = byDate.get(ds) ?? [];
        return (
          <div className="p-4">
            {evs.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">{emptyLabel}</p>
            ) : (
              <div className="space-y-2">{evs.map((e) => (
                <div key={e.id} className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${(TONE[e.tone ?? "slate"]).split(" ")[0]}`} />
                  {e.href ? <Link href={e.href} className="text-sm text-slate-800 hover:underline">{e.title}</Link> : <span className="text-sm text-slate-800">{e.title}</span>}
                  {e.sub && <span className="text-xs text-slate-400">· {e.sub}</span>}
                </div>
              ))}</div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
