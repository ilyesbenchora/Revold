"use client";

import { useState } from "react";
import Link from "next/link";

const CADENCES = [
  { key: "weekly", label: "Hebdomadaire" },
  { key: "biweekly", label: "Toutes les 2 semaines" },
  { key: "monthly", label: "Mensuel" },
  { key: "quarterly", label: "Trimestriel" },
];

export type Agenda = {
  objectives?: string | null;
  pains?: string | null;
  cadence?: string | null;
  next_meeting_at?: string | null;
};
type Coach = { id: string; label: string; agentKey: string };

function CoachCard({ coach, initial }: { coach: Coach; initial: Agenda }) {
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
        body: JSON.stringify({
          category: coach.id,
          objectives,
          pains,
          cadence,
          next_meeting_at: nextMeeting || null,
        }),
      });
      if (!res.ok) throw new Error();
      setState("done");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("error");
    }
  }

  const field = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100";
  const lbl = "text-[10px] font-semibold uppercase tracking-wide text-slate-400";

  return (
    <div className="card p-4">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-xs text-white">
            ✨
          </span>
          <h3 className="text-sm font-semibold text-slate-900">{coach.label}</h3>
        </div>
        <Link
          href={`/dashboard/agents/${coach.agentKey}`}
          className="shrink-0 text-[11px] font-medium text-accent hover:underline"
        >
          Ouvrir le coach →
        </Link>
      </div>

      <div className="space-y-2.5">
        <div>
          <label className={lbl}>Objectifs à suivre</label>
          <textarea
            value={objectives}
            onChange={(e) => setObjectives(e.target.value)}
            rows={2}
            placeholder="Ex : passer le win rate de 22 % à 30 % ce trimestre"
            className={field}
          />
        </div>
        <div>
          <label className={lbl}>Pains / points de vigilance</label>
          <textarea
            value={pains}
            onChange={(e) => setPains(e.target.value)}
            rows={2}
            placeholder="Ex : cycle de vente trop long sur les gros comptes"
            className={field}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={lbl}>Cadence des RDV</label>
            <select value={cadence} onChange={(e) => setCadence(e.target.value)} className={field}>
              {CADENCES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>Prochain RDV</label>
            <input type="date" value={nextMeeting ?? ""} onChange={(e) => setNextMeeting(e.target.value)} className={field} />
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={save}
          disabled={state === "saving"}
          className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {state === "saving" ? "Enregistrement…" : "Enregistrer l'agenda"}
        </button>
        {state === "done" && <span className="text-xs font-medium text-emerald-600">✓ Enregistré</span>}
        {state === "error" && (
          <span className="text-xs text-red-500">Échec — la table coaching_agendas est-elle créée ?</span>
        )}
      </div>
    </div>
  );
}

export function CoachingAgenda({ coaches, agendas }: { coaches: Coach[]; agendas: Record<string, Agenda> }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {coaches.map((c) => (
        <CoachCard key={c.id} coach={c} initial={agendas[c.id] ?? {}} />
      ))}
    </div>
  );
}
