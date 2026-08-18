"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Bloc DÉDIÉ « Source LinkedIn (bêta) » — sous l'état du moteur Sirene, avec
 * SA PROPRE barre de complétion : on voit séparément ce que cette source
 * apporte (effectifs complétés là où le registre officiel ne publie rien).
 *
 * Même mécanique silencieuse que le moteur principal : tant que la page est
 * ouverte et qu'il reste des pages à scanner, le bloc enchaîne des lots ;
 * le cron enrich-companies prend le relais page fermée.
 */

const POLL_MS = 20_000;

type Status = {
  enabled: boolean;
  connected: boolean;
  /** Entreprises sans effectif officiel = périmètre de la source LinkedIn. */
  scope: number;
  /** Effectifs complétés grâce à LinkedIn. */
  viaLinkedin: number;
  remaining: number;
  processed: number;
  pct: number;
  lastActivityAt: string | null;
  inProgress: boolean;
};

type Batch = {
  filled?: number;
  scanned?: number;
  lookupsUsed?: number;
  remaining?: number;
  noToken?: boolean;
  forbidden?: boolean;
  interrupted?: boolean;
};

const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("fr-FR"));

export function LinkedinEnrichmentBlock() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [sessionFilled, setSessionFilled] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const loopRef = useRef(false);

  const loadStatus = useCallback(async (): Promise<Status | null> => {
    try {
      const res = await fetch("/api/enrichment/linkedin");
      if (!res.ok) return null;
      const d = (await res.json()) as Status;
      if (mountedRef.current) setStatus(d);
      return d;
    } catch {
      return null;
    }
  }, []);

  /** Enchaîne des lots tant que la page est ouverte et qu'il reste du travail. */
  const loop = useCallback(async () => {
    if (loopRef.current) return;
    loopRef.current = true;
    try {
      while (mountedRef.current) {
        const res = await fetch("/api/enrichment/linkedin", { method: "POST" });
        const d = (await res.json().catch(() => ({}))) as Batch;
        if (!mountedRef.current || !res.ok) break;
        if (d.noToken || d.forbidden) break; // le message vient du statut rechargé
        if ((d.filled ?? 0) > 0) {
          setSessionFilled((n) => n + (d.filled ?? 0));
          router.refresh();
        }
        const fresh = await loadStatus();
        if (!mountedRef.current) break;
        if ((fresh?.remaining ?? 0) <= 0) break;
        if (d.interrupted) {
          setNotice("LinkedIn limite la cadence — reprise dans 30 s.");
          await new Promise((r) => setTimeout(r, 30_000));
          if (!mountedRef.current) break;
          setNotice(null);
        } else if ((d.lookupsUsed ?? 0) === 0) {
          break;
        }
      }
    } finally {
      loopRef.current = false;
    }
  }, [loadStatus, router]);

  // Montage : état réel, puis scan automatique si l'API est branchée.
  useEffect(() => {
    mountedRef.current = true;
    void (async () => {
      const s = await loadStatus();
      if (mountedRef.current && s?.connected && (s?.remaining ?? 0) > 0) void loop();
    })();
    return () => {
      mountedRef.current = false; // la boucle s'arrête au lot suivant
    };
  }, [loadStatus, loop]);

  // Suivi de l'avancement même quand la boucle locale ne tourne pas (cron).
  useEffect(() => {
    if (!status?.inProgress) return;
    const iv = setInterval(() => void loadStatus(), POLL_MS);
    return () => clearInterval(iv);
  }, [status?.inProgress, loadStatus]);

  const pct = status?.pct ?? 0;
  const remaining = status?.remaining ?? 0;
  const connected = status?.connected ?? false;

  return (
    <div className="card border-sky-200/70 bg-gradient-to-r from-sky-50/60 via-white to-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span aria-hidden className="rounded bg-sky-600 px-1 text-[10px] font-bold leading-4 text-white">in</span>
            Source LinkedIn
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Bêta</span>
            {status != null && connected && remaining > 0 && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {status == null ? (
              <>Lecture de l&apos;avancement LinkedIn…</>
            ) : !connected ? (
              <>Complète l&apos;effectif des entreprises que le registre officiel ne couvre pas.</>
            ) : remaining > 0 ? (
              <>
                Scan des pages LinkedIn des{" "}
                <span className="font-medium text-slate-700">{fmt(status.scope)}</span> entreprises sans effectif
                officiel — la tranche publiée sur leur page complète la donnée manquante.
              </>
            ) : (
              <>Périmètre scanné : chaque entreprise sans effectif officiel a été cherchée sur LinkedIn (re-scan 30 j).</>
            )}
          </p>
        </div>
        {status != null && (
          <p className="shrink-0 text-right text-xs text-slate-500">
            <span className="block text-2xl font-bold tabular-nums text-slate-900">{pct} %</span>
            {fmt(status.processed)} scannées{remaining > 0 && <> · {fmt(remaining)} restantes</>}
          </p>
        )}
      </div>

      {/* Barre de complétion PROPRE à la source LinkedIn */}
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full bg-gradient-to-r from-sky-600 to-blue-600 transition-all duration-700 ${connected && remaining > 0 ? "animate-pulse" : ""}`}
          style={{ width: `${status == null ? 0 : Math.max(pct, 2)}%` }}
        />
      </div>

      {status != null && (
        <p className="mt-1.5 text-[11px] text-slate-500">
          <span className="font-semibold text-sky-700">{fmt(status.viaLinkedin)}</span> effectif
          {status.viaLinkedin > 1 ? "s" : ""} complété{status.viaLinkedin > 1 ? "s" : ""} via LinkedIn sur{" "}
          <span className="font-semibold text-slate-700">{fmt(status.scope)}</span> entreprises sans effectif officiel
          {sessionFilled > 0 && (
            <>
              {" "}· <span className="text-sky-600">+{sessionFilled} depuis l&apos;ouverture de cette page</span>
            </>
          )}
        </p>
      )}

      {notice && <p className="mt-1.5 text-[11px] font-medium text-amber-700">{notice}</p>}

      <p className="mt-2 border-t border-sky-100 pt-2 text-[11px] text-slate-400">
        La donnée LinkedIn <span className="font-medium text-slate-500">complète</span> l&apos;effectif, elle ne
        remplace jamais la tranche officielle URSSAF/INSEE : elle est stockée à part, clairement marquée « LinkedIn »,
        et seule une correspondance de nom certaine est retenue.
      </p>
    </div>
  );
}
