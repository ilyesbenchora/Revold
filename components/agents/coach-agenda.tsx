"use client";

import { useState } from "react";
import { AttachMenu, AttachmentChips } from "./attach-menu";
import type { Attachment } from "@/lib/attachments";

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
  sources?: string[] | null;
  attachments?: Attachment[] | null;
};

export type AgendaSource = { key: string; label: string; icon: string };

export function CoachAgenda({
  category,
  label,
  initial,
  availableSources = [],
  onSaved,
  onStart,
  collapsed,
  onCollapsedChange,
  sessionStatus = "idle",
}: {
  category: string;
  label: string;
  initial: CoachAgendaInitial;
  availableSources?: AgendaSource[];
  onSaved?: (agenda: {
    objectives: string;
    pains: string;
    cadence: string;
    next_meeting_at: string | null;
    sources: string[];
    attachments: Attachment[];
  }) => void;
  onStart?: () => void;
  /** État replié/déplié contrôlé par le workspace. */
  collapsed: boolean;
  onCollapsedChange: (v: boolean) => void;
  /** État de la séance côté chat : idle | active | ended. */
  sessionStatus?: "idle" | "active" | "ended";
}) {
  const [objectives, setObjectives] = useState(initial.objectives ?? "");
  const [pains, setPains] = useState(initial.pains ?? "");
  const [cadence, setCadence] = useState(initial.cadence ?? "monthly");
  const [nextMeeting, setNextMeeting] = useState(initial.next_meeting_at ?? "");
  const [sources, setSources] = useState<string[]>(initial.sources ?? []);
  const [attachments, setAttachments] = useState<Attachment[]>(initial.attachments ?? []);
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  function toggleSource(key: string) {
    setSources((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function save() {
    setState("saving");
    setErrMsg(null);
    try {
      const res = await fetch("/api/coaching/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, objectives, pains, cadence, next_meeting_at: nextMeeting || null, sources, attachments }),
      });
      if (!res.ok) {
        let reason = `HTTP ${res.status}`;
        try {
          const data = await res.json();
          if (data?.error) reason = data.error;
        } catch {
          /* réponse non-JSON */
        }
        setErrMsg(reason);
        setState("error");
        return;
      }
      setState("done");
      onSaved?.({ objectives, pains, cadence, next_meeting_at: nextMeeting || null, sources, attachments });
      // RDV enregistré → on replie le bloc en confirmation compacte.
      if (nextMeeting) onCollapsedChange(true);
      setTimeout(() => setState("idle"), 2500);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "Erreur réseau");
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

  // ── Vue repliée : confirmation compacte du RDV + démarrage du coaching ──
  if (collapsed) {
    return (
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">✓</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Rendez-vous de coaching enregistré</p>
          <p className="text-xs text-slate-500">
            {nextMeeting ? fmtDate(nextMeeting) : "Date à définir"} · {cadenceLabel(cadence)}
            {attachments.length > 0 ? ` · ${attachments.length} fichier(s) joint(s)` : ""}
          </p>
        </div>
        {links && (
          <a
            href={links.google}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
          >
            📅 Agenda
          </a>
        )}
        <button
          onClick={() => onCollapsedChange(false)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Modifier
        </button>
        {sessionStatus === "active" ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold text-indigo-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" /> Coaching en cours
          </span>
        ) : sessionStatus === "ended" ? (
          <button
            onClick={() => onStart?.()}
            title="Démarrer une nouvelle séance"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            ✓ Coaching terminé
          </button>
        ) : (
          <button
            onClick={() => onStart?.()}
            className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            Démarrer le coaching
          </button>
        )}
      </div>
    );
  }

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
        {availableSources.length > 0 && (
          <div>
            <label className={lbl}>Outils à croiser pendant la séance</label>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Pré-sélectionnés automatiquement au démarrage du coaching — plus besoin de les choisir à la main.
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {availableSources.map((s) => {
                const active = sources.includes(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => toggleSource(s.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                      active
                        ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>{s.icon}</span>
                    {s.label}
                    {active && <span className="text-fuchsia-500">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div>
          <label className={lbl}>Fichiers de contexte (Excel / Google Sheets)</label>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Joins un ou plusieurs fichiers : l&apos;agent les reprendra dans la séance pour un coaching mieux contextualisé.
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <AttachMenu onAdd={(a) => setAttachments((p) => [...p, a])} size="sm" />
            <span className="text-[11px] text-slate-400">
              {attachments.length ? `${attachments.length} fichier(s) joint(s)` : "Aucun fichier joint"}
            </span>
          </div>
          {attachments.length > 0 && (
            <div className="mt-2">
              <AttachmentChips items={attachments} onRemove={(id) => setAttachments((p) => p.filter((a) => a.id !== id))} />
            </div>
          )}
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
        {state === "error" && (
          <span className="text-xs text-red-500">Échec : {errMsg ?? "erreur inconnue"}</span>
        )}
      </div>
    </div>
  );
}
