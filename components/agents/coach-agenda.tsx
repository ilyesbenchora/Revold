"use client";

import { useState } from "react";

const CADENCES = [
  { key: "once", label: "Une seule fois" },
  { key: "weekly", label: "Hebdomadaire" },
  { key: "biweekly", label: "Toutes les 2 semaines" },
  { key: "monthly", label: "Mensuel" },
  { key: "quarterly", label: "Trimestriel" },
];
function cadenceLabel(k: string): string {
  return CADENCES.find((c) => c.key === k)?.label ?? "Mensuel";
}

/** Date (YYYY-MM-DD) à J+days, pour les raccourcis de prochain RDV. */
function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
const QUICK_MEETINGS = [
  { label: "Maintenant", days: 0 },
  { label: "Dans 2 jours", days: 2 },
  { label: "Dans 4 jours", days: 4 },
  { label: "Dans 6 jours", days: 6 },
];

function calendarLinks(title: string, dateStr: string, details: string) {
  const start = `${dateStr}T10:00:00`;
  const end = `${dateStr}T10:45:00`;
  const g = (s: string) => s.replace(/[-:]/g, "");
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    title,
  )}&dates=${g(start)}/${g(end)}&details=${encodeURIComponent(details)}`;
  const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${encodeURIComponent(
    title,
  )}&startdt=${encodeURIComponent(start)}&enddt=${encodeURIComponent(end)}&body=${encodeURIComponent(details)}`;
  return { google, outlook };
}
function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

export type CoachAgendaInitial = {
  objectives?: string | null;
  pains?: string | null;
  cadence?: string | null;
  next_meeting_at?: string | null;
};

export function CoachAgenda({
  category,
  label,
  initial,
}: {
  category: string;
  label: string;
  initial: CoachAgendaInitial;
}) {
  const [objectives, setObjectives] = useState(initial.objectives ?? "");
  const [pains, setPains] = useState(initial.pains ?? "");
  const [cadence, setCadence] = useState(initial.cadence ?? "monthly");
  const [nextMeeting, setNextMeeting] = useState(initial.next_meeting_at ?? "");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");

  async function save() {
    setState("saving");
    try {
      const res = await fetch("/api/coaching/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, objectives, pains, cadence, next_meeting_at: nextMeeting || null }),
      });
      if (!res.ok) throw new Error();
      setState("done");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("error");
    }
  }

  const field =
    "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100";
  const lbl = "text-[10px] font-semibold uppercase tracking-wide text-slate-400";

  const links = nextMeeting
    ? calendarLinks(
        `Coaching ${label} — Revold`,
        nextMeeting,
        `Séance de coaching (${cadenceLabel(cadence)}).\nObjectifs : ${objectives}\nPains : ${pains}`,
      )
    : null;

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-slate-900">Objectifs &amp; rendez-vous de coaching</h3>
      <p className="mt-0.5 text-xs text-slate-500">
        Écris tes objectifs et tes pains : le coach s&apos;en sert pour orienter la séance et te proposer des actions
        concrètes. Programme un rendez-vous de suivi et ajoute-le à ton agenda.
      </p>

      {/* Coaching à venir */}
      {nextMeeting && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-fuchsia-200 bg-fuchsia-50/50 p-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-fuchsia-600">Coaching à venir</span>
          <span className="text-sm font-medium text-slate-800">{fmtDate(nextMeeting)}</span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-500">{cadenceLabel(cadence)}</span>
          {links && (
            <div className="ml-auto flex gap-2">
              <a href={links.google} target="_blank" rel="noreferrer" className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50">
                📅 Google Agenda
              </a>
              <a href={links.outlook} target="_blank" rel="noreferrer" className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50">
                📅 Outlook
              </a>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 space-y-3">
        <div>
          <label className={lbl}>Objectifs à atteindre</label>
          <textarea value={objectives} onChange={(e) => setObjectives(e.target.value)} rows={2}
            placeholder={`Ex : passer le win rate de 22 % à 30 % ce trimestre`} className={field} />
        </div>
        <div>
          <label className={lbl}>Pains / points de vigilance</label>
          <textarea value={pains} onChange={(e) => setPains(e.target.value)} rows={2}
            placeholder="Ex : cycle de vente trop long sur les gros comptes" className={field} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={lbl}>Cadence des RDV</label>
            <select value={cadence} onChange={(e) => setCadence(e.target.value)} className={field}>
              {CADENCES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>Prochain RDV</label>
            <input type="date" value={nextMeeting ?? ""} onChange={(e) => setNextMeeting(e.target.value)} className={field} />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_MEETINGS.map((q) => {
            const date = offsetDate(q.days);
            const active = nextMeeting === date;
            return (
              <button
                key={q.label}
                type="button"
                onClick={() => setNextMeeting(date)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  active
                    ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {q.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button onClick={save} disabled={state === "saving"}
          className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60">
          {state === "saving" ? "Enregistrement…" : "Enregistrer l'agenda"}
        </button>
        {state === "done" && <span className="text-xs font-medium text-emerald-600">✓ Enregistré — ajoute le RDV à ton agenda ci-dessus</span>}
        {state === "error" && <span className="text-xs text-red-500">Échec — la table coaching_agendas est-elle créée ?</span>}
      </div>
    </div>
  );
}
