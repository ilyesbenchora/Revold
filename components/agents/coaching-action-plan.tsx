"use client";

import { useEffect, useState } from "react";

type Commitment = {
  id: string;
  title: string;
  detail: string | null;
  due_date: string | null;
  status: "pending" | "done" | "dropped";
  created_at: string;
  completed_at: string | null;
};

type Memory = {
  lastSummary: string | null;
  lastEndedAt: string | null;
  openCommitments: Commitment[];
  recentlyDone: Commitment[];
};

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long" });
}
function isOverdue(d: string | null): boolean {
  if (!d) return false;
  return new Date(`${d}T23:59:59`).getTime() < Date.now();
}

/**
 * Plan d'action de coaching : engagements pris en fin de séance (générés par
 * l'agent à la clôture) + résumé de la dernière séance. L'utilisateur coche
 * fait / abandonné — le coach fait le point dessus à la séance suivante.
 * Masqué tant qu'aucune mémoire n'existe (première séance).
 */
export function CoachingActionPlan({
  category,
  refreshSignal = 0,
}: {
  category: string;
  /** Incrémenté à la clôture d'une séance → recharge le plan. */
  refreshSignal?: number;
}) {
  const [memory, setMemory] = useState<Memory | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Léger délai après une clôture : la génération du résumé (agent) vient de
    // se terminer côté serveur avant que le signal arrive, un fetch suffit.
    fetch(`/api/coaching/plan?category=${encodeURIComponent(category)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setMemory(data as Memory);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [category, refreshSignal]);

  async function setStatus(id: string, status: "done" | "dropped" | "pending") {
    setPendingId(id);
    try {
      const res = await fetch(`/api/coaching/commitments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const { commitment } = (await res.json()) as { commitment: Commitment };
        setMemory((m) => {
          if (!m) return m;
          const rest = m.openCommitments.filter((c) => c.id !== id);
          const doneRest = m.recentlyDone.filter((c) => c.id !== id);
          return {
            ...m,
            openCommitments: status === "pending" ? [commitment, ...rest] : rest,
            recentlyDone: status === "done" ? [commitment, ...doneRest] : doneRest,
          };
        });
      }
    } catch {
      /* silencieux */
    }
    setPendingId(null);
  }

  if (!memory || (!memory.lastSummary && memory.openCommitments.length === 0 && memory.recentlyDone.length === 0)) {
    return null;
  }

  return (
    <div className="card mb-6 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-fuchsia-500">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          Plan d&apos;action de la séance
          {memory.openCommitments.length > 0 && (
            <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-[11px] font-medium text-fuchsia-700">
              {memory.openCommitments.length} en cours
            </span>
          )}
        </h3>
        {memory.lastSummary && (
          <button
            onClick={() => setShowSummary((v) => !v)}
            className="ml-auto text-[11px] font-medium text-slate-400 hover:text-fuchsia-600"
          >
            {showSummary ? "Masquer le résumé" : "Résumé de la dernière séance"}
          </button>
        )}
      </div>

      {showSummary && memory.lastSummary && (
        <p className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          {memory.lastSummary}
        </p>
      )}

      {memory.openCommitments.length > 0 ? (
        <div className="mt-3 space-y-2">
          {memory.openCommitments.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{c.title}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {c.detail && <span>{c.detail} · </span>}
                  Pris le {fmtDate(c.created_at)}
                  {c.due_date && (
                    <span className={isOverdue(c.due_date) ? " font-semibold text-red-500" : ""}>
                      {" "}· échéance {fmtDate(c.due_date)}{isOverdue(c.due_date) ? " (dépassée)" : ""}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  onClick={() => setStatus(c.id, "done")}
                  disabled={pendingId === c.id}
                  className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                >
                  ✓ Fait
                </button>
                <button
                  onClick={() => setStatus(c.id, "dropped")}
                  disabled={pendingId === c.id}
                  title="Abandonner cet engagement"
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 disabled:opacity-50"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-400">
          Aucun engagement en cours — l'agent en proposera en fin de prochaine séance.
        </p>
      )}

      {memory.recentlyDone.length > 0 && (
        <p className="mt-3 text-[11px] text-slate-400">
          ✓ Accomplis : {memory.recentlyDone.map((c) => c.title).join(" · ")}
        </p>
      )}
    </div>
  );
}
