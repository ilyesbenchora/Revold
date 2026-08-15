"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Enrichissement de toute la base.
 *
 * L'ÉTAT VIENT DE LA BASE, jamais de la session : tant qu'il reste des
 * entreprises à traiter, l'enrichissement est « en cours » — le robot (cron
 * toutes les 10 min) avance de toute façon, page ouverte ou non. Le bouton
 * n'est donc jamais « Lancer » quand un enrichissement est en route : il
 * propose d'ACCÉLÉRER (boucle de lots depuis le navigateur).
 *
 * Quitter la page arrête proprement l'accélération (pas de boucle orpheline)
 * en gardant un drapeau : elle reprend automatiquement au retour.
 */

const RUNNING_KEY = "revold:enrichment-running";
const POLL_MS = 20_000;

type Status = {
  total: number | null;
  withSiren: number | null;
  withEmployees: number | null;
  candidates: number | null;
  remaining: number;
  processed: number;
  pct: number;
  lastActivityAt: string | null;
  inProgress: boolean;
};

type Batch = {
  lookupsUsed: number;
  identities: number;
  candidates: number;
  facts: number;
  interrupted?: boolean;
  error?: string;
};

const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("fr-FR"));

function sinceFr(iso: string | null): string {
  if (!iso) return "en attente du premier passage";
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} j`;
}

export function EnrichmentBackfillRunner() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  /** Accélération pilotée par CETTE page (la boucle de lots tourne ici). */
  const [boosting, setBoosting] = useState(false);
  const [session, setSession] = useState({ identities: 0, candidates: 0, facts: 0 });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<null | "user" | "unmount">(null);
  const mountedRef = useRef(true);
  const startedRef = useRef(false);

  const loadStatus = useCallback(async (): Promise<Status | null> => {
    try {
      const res = await fetch("/api/enrichment/status");
      if (!res.ok) return null;
      const d = (await res.json()) as Status;
      if (mountedRef.current) setStatus(d);
      return d;
    } catch {
      return null;
    }
  }, []);

  const boost = useCallback(
    async (resumed = false) => {
      setBoosting(true);
      setError(null);
      setNotice(resumed ? "Reprise de l'accélération là où elle s'était arrêtée." : null);
      stopRef.current = null;
      try {
        localStorage.setItem(RUNNING_KEY, "1");
      } catch { /* ignore */ }

      try {
        for (let i = 0; i < 400; i++) {
          const res = await fetch("/api/enrichment/backfill", { method: "POST" });
          const d = (await res.json().catch(() => ({}))) as Partial<Batch>;
          if (!res.ok) throw new Error(d.error || "Échec du lot d'enrichissement");
          if (!mountedRef.current) break; // page quittée → on rend la main proprement

          setSession((s) => ({
            identities: s.identities + (d.identities ?? 0),
            candidates: s.candidates + (d.candidates ?? 0),
            facts: s.facts + (d.facts ?? 0),
          }));
          const fresh = await loadStatus();
          router.refresh();

          if (stopRef.current) break;
          if ((fresh?.remaining ?? 0) <= 0) break;

          if (d.interrupted) {
            setNotice("Registre momentanément saturé — reprise automatique dans 20 s.");
            await new Promise((r) => setTimeout(r, 20_000));
            if (stopRef.current) break;
            setNotice(null);
          } else if ((d.lookupsUsed ?? 0) === 0) {
            break;
          }
        }
      } catch (e) {
        if (mountedRef.current) setError(e instanceof Error ? e.message : "Erreur inconnue");
      } finally {
        // Sortie par démontage (navigation) → on GARDE le drapeau : l'accélération
        // reprendra au retour. Fin normale ou pause manuelle → on l'efface.
        if (stopRef.current !== "unmount" && mountedRef.current) {
          try {
            localStorage.removeItem(RUNNING_KEY);
          } catch { /* ignore */ }
        }
        if (mountedRef.current) {
          setBoosting(false);
          void loadStatus();
        }
      }
    },
    [loadStatus, router],
  );

  // Montage : état réel + reprise éventuelle de l'accélération.
  useEffect(() => {
    mountedRef.current = true;
    if (startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      const s = await loadStatus();
      let wasBoosting = false;
      try {
        wasBoosting = localStorage.getItem(RUNNING_KEY) === "1";
      } catch { /* ignore */ }
      if (wasBoosting && (s?.remaining ?? 0) > 0) void boost(true);
    })();
    return () => {
      // Démontage : on arrête la boucle au prochain lot (pas d'orpheline).
      mountedRef.current = false;
      stopRef.current = "unmount";
    };
  }, [loadStatus, boost]);

  // Rafraîchissement de l'avancement même sans accélération (le robot travaille).
  useEffect(() => {
    if (boosting) return;
    if (!status?.inProgress) return;
    const iv = setInterval(() => void loadStatus(), POLL_MS);
    return () => clearInterval(iv);
  }, [boosting, status?.inProgress, loadStatus]);

  const pct = status?.pct ?? 0;
  const remaining = status?.remaining ?? 0;
  const inProgress = status?.inProgress ?? false;
  const sessionTotal = session.identities + session.facts + session.candidates;

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
          {inProgress && (
            <span className="inline-flex items-center gap-1.5 text-fuchsia-600">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fuchsia-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-fuchsia-500" />
              </span>
              {boosting ? "Accélération en cours" : "Enrichissement en cours"}
            </span>
          )}
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full bg-gradient-to-r from-fuchsia-600 to-pink-600 transition-all duration-700 ${boosting ? "animate-pulse" : ""}`}
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
          <p className="text-sm font-semibold text-slate-900">
            {inProgress ? "⏳ Enrichissement en cours" : "🚀 Enrichir toute ma base"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {inProgress ? (
              <>
                Le robot traite ~2 400 entreprises par heure, application fermée — dernière avancée{" "}
                <span className="font-medium text-slate-700">{sinceFr(status?.lastActivityAt ?? null)}</span>.{" "}
                {boosting
                  ? "Accélération depuis cette page : tu peux naviguer, elle reprendra à ton retour."
                  : "Accélère depuis cette page si tu veux aller plus vite."}
              </>
            ) : (
              <>✓ Base entièrement traitée. Le robot entretient la donnée (nouvelles entreprises, rafraîchissement à 90 jours).</>
            )}
            {sessionTotal > 0 && (
              <>
                {" "}Cette session : <span className="font-medium text-slate-700">+{session.identities}</span> identifiants ·{" "}
                <span className="font-medium text-slate-700">+{session.facts}</span> effectifs/CA ·{" "}
                <span className="font-medium text-slate-700">+{session.candidates}</span> à valider.
              </>
            )}
          </p>
          {notice && <p className="mt-1 text-[11px] font-medium text-amber-700">{notice}</p>}
          {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {boosting && (
            <button
              onClick={() => { stopRef.current = "user"; }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Mettre en pause
            </button>
          )}
          <button
            onClick={() => boost(false)}
            disabled={boosting || !inProgress}
            className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-60"
          >
            {boosting ? "Accélération en cours…" : inProgress ? "⚡ Accélérer maintenant" : "✓ Base à jour"}
          </button>
        </div>
      </div>
    </div>
  );
}
