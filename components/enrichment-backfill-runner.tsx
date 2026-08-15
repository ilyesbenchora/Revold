"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Enrichissement de toute la base — moteur partagé avec le cron.
 *
 * PROGRESSION PERSISTANTE : la barre reflète l'état RÉEL de la base
 * (/api/enrichment/status), pas la session en cours. Changer de page ne remet
 * donc jamais l'avancement à zéro, et l'enrichissement REPREND automatiquement
 * au retour s'il n'était pas terminé (drapeau local). Sans la page ouverte, le
 * cron continue le même travail en tâche de fond.
 */

const RUNNING_KEY = "revold:enrichment-running";

type Status = {
  total: number | null;
  withSiren: number | null;
  withEmployees: number | null;
  candidates: number | null;
  identitiesRemaining: number | null;
  factsRemaining: number | null;
  remaining: number;
  processed: number;
  pct: number;
};

type Batch = {
  lookupsUsed: number;
  identities: number;
  candidates: number;
  facts: number;
  remainingIdentities: number;
  remainingFacts: number;
  interrupted?: boolean;
  error?: string;
};

const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("fr-FR"));

export function EnrichmentBackfillRunner() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [running, setRunning] = useState(false);
  const [session, setSession] = useState({ identities: 0, candidates: 0, facts: 0 });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);
  const startedRef = useRef(false);

  const loadStatus = useCallback(async (): Promise<Status | null> => {
    try {
      const res = await fetch("/api/enrichment/status");
      if (!res.ok) return null;
      const d = (await res.json()) as Status;
      setStatus(d);
      return d;
    } catch {
      return null;
    }
  }, []);

  const run = useCallback(
    async (resumed = false) => {
      setRunning(true);
      setError(null);
      setNotice(resumed ? "Reprise de l'enrichissement là où il s'était arrêté." : null);
      stopRef.current = false;
      try {
        localStorage.setItem(RUNNING_KEY, "1");
      } catch { /* ignore */ }

      try {
        // Garde-fou : 400 lots max par session (le reste passe par le cron).
        for (let i = 0; i < 400; i++) {
          const res = await fetch("/api/enrichment/backfill", { method: "POST" });
          const d = (await res.json().catch(() => ({}))) as Partial<Batch>;
          if (!res.ok) throw new Error(d.error || "Échec du lot d'enrichissement");

          setSession((s) => ({
            identities: s.identities + (d.identities ?? 0),
            candidates: s.candidates + (d.candidates ?? 0),
            facts: s.facts + (d.facts ?? 0),
          }));
          const fresh = await loadStatus();
          router.refresh(); // tuiles de couverture de la page

          if (stopRef.current) break;
          const remaining = fresh?.remaining ?? (d.remainingIdentities ?? 0) + (d.remainingFacts ?? 0);
          if (remaining <= 0) break;

          if (d.interrupted) {
            // Registre saturé/injoignable : rien n'a été marqué à tort, on
            // patiente avant de reprendre (l'API publique se libère vite).
            setNotice("Registre momentanément saturé — reprise automatique dans 20 s.");
            await new Promise((r) => setTimeout(r, 20_000));
            if (stopRef.current) break;
            setNotice(null);
          } else if ((d.lookupsUsed ?? 0) === 0) {
            break;
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur inconnue");
      } finally {
        setRunning(false);
        try {
          localStorage.removeItem(RUNNING_KEY);
        } catch { /* ignore */ }
        void loadStatus();
      }
    },
    [loadStatus, router],
  );

  // Montage : état réel de la base, puis REPRISE automatique si un
  // enrichissement était en cours quand on a quitté la page.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      const s = await loadStatus();
      let wasRunning = false;
      try {
        wasRunning = localStorage.getItem(RUNNING_KEY) === "1";
      } catch { /* ignore */ }
      if (wasRunning && (s?.remaining ?? 0) > 0) void run(true);
    })();
  }, [loadStatus, run]);

  const pct = status?.pct ?? 0;
  const remaining = status?.remaining ?? 0;
  const finished = status != null && remaining === 0;

  return (
    <div className="card border-fuchsia-200/70 bg-gradient-to-r from-fuchsia-50/50 via-white to-white p-4">
      {/* ── Progression PERSISTANTE (état réel de la base) ── */}
      <div className="mb-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-slate-500">
          <span>
            {status == null ? (
              "Lecture de l'avancement…"
            ) : (
              <>
                Avancement de la base : <span className="font-bold text-slate-800">{pct} %</span>{" "}
                <span className="text-slate-400">
                  ({fmt(status.processed)} traitées{remaining > 0 && <> · {fmt(remaining)} restantes</>})
                </span>
              </>
            )}
          </span>
          {running && <span className="text-fuchsia-600">Enrichissement en cours…</span>}
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full bg-gradient-to-r from-fuchsia-600 to-pink-600 transition-all duration-700 ${running ? "animate-pulse" : ""}`}
            style={{ width: `${status == null ? 0 : Math.max(pct, 2)}%` }}
          />
        </div>
        {status != null && (
          <p className="mt-1.5 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700">{fmt(status.withSiren)}</span> entreprises identifiées
            (SIREN/TVA trouvés) · <span className="font-semibold text-slate-700">{fmt(status.withEmployees)}</span>{" "}
            avec effectif officiel · <span className="font-semibold text-amber-700">{fmt(status.candidates)}</span> en
            attente de validation ci-dessous
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">🚀 Enrichir toute ma base</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {running ? (
              <>
                Cette session : <span className="font-medium text-slate-700">+{session.identities}</span> identifiants
                (SIREN/TVA) · <span className="font-medium text-slate-700">+{session.facts}</span> effectifs/CA ·{" "}
                <span className="font-medium text-slate-700">+{session.candidates}</span> à valider. Tu peux naviguer :
                l&apos;enrichissement reprendra automatiquement à ton retour, et le robot horaire continue de son côté.
              </>
            ) : finished ? (
              <>✓ Base entièrement traitée. Le robot horaire entretient la donnée (nouvelles entreprises, rafraîchissement à 90 jours).</>
            ) : (
              <>
                {fmt(remaining)} entreprises à traiter (identifiants + effectifs/CA), par lots successifs. Le robot
                horaire fait le même travail en tâche de fond — ce bouton accélère simplement les choses.
              </>
            )}
          </p>
          {notice && <p className="mt-1 text-[11px] font-medium text-amber-700">{notice}</p>}
          {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {running && (
            <button
              onClick={() => { stopRef.current = true; }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Mettre en pause
            </button>
          )}
          <button
            onClick={() => run(false)}
            disabled={running || finished}
            className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-60"
          >
            {running
              ? "Enrichissement…"
              : finished
                ? "✓ Base à jour"
                : session.identities + session.facts + session.candidates > 0
                  ? "▶ Reprendre l'enrichissement"
                  : "🚀 Lancer l'enrichissement complet"}
          </button>
        </div>
      </div>
    </div>
  );
}
