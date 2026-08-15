"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * État de l'enrichissement de la base — et accélérateur SILENCIEUX.
 *
 * Aucun bouton : tant qu'il reste des entreprises à traiter, le robot avance
 * en tâche de fond (cron toutes les 5 min) ET cette page enchaîne des lots
 * pendant qu'elle est ouverte. Pas d'arbitrage vitesse/qualité à proposer à
 * l'utilisateur : c'est le MÊME moteur, les mêmes règles (seules les
 * correspondances exactes sont appliquées seules, le reste passe par la
 * validation humaine) — seule la cadence d'appel change.
 */

const POLL_MS = 20_000;

type Status = {
  total: number | null;
  withSiren: number | null;
  withEmployees: number | null;
  candidates: number | null;
  duplicates: number | null;
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
  duplicates: number;
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

/** Fin estimée au rythme du robot seul (~4 800 entreprises/h). */
function etaFr(remaining: number): string | null {
  if (remaining <= 0) return null;
  const hours = remaining / 4800;
  if (hours < 0.5) return "moins de 30 min";
  if (hours < 1.5) return "environ 1 h";
  return `environ ${Math.round(hours)} h`;
}

export function EnrichmentBackfillRunner() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [session, setSession] = useState({ identities: 0, candidates: 0, facts: 0, duplicates: 0 });
  const [notice, setNotice] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const loopRef = useRef(false);

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

  /** Enchaîne des lots tant que la page est ouverte et qu'il reste du travail. */
  const loop = useCallback(async () => {
    if (loopRef.current) return;
    loopRef.current = true;
    try {
      while (mountedRef.current) {
        const res = await fetch("/api/enrichment/backfill", { method: "POST" });
        const d = (await res.json().catch(() => ({}))) as Partial<Batch>;
        if (!mountedRef.current) break;
        if (!res.ok) {
          // Erreur serveur : on laisse le robot de fond prendre le relais.
          setNotice("Traitement poursuivi en tâche de fond.");
          break;
        }
        setSession((s) => ({
          identities: s.identities + (d.identities ?? 0),
          candidates: s.candidates + (d.candidates ?? 0),
          facts: s.facts + (d.facts ?? 0),
          duplicates: s.duplicates + (d.duplicates ?? 0),
        }));
        const fresh = await loadStatus();
        router.refresh();
        if (!mountedRef.current) break;
        if ((fresh?.remaining ?? 0) <= 0) break;

        if (d.interrupted) {
          // Le registre ne répond plus correctement : on patiente brièvement
          // (aucune entreprise n'a été marquée à tort — le contrôle qualité
          // passe avant la vitesse), puis on reprend là où on s'était arrêté.
          setNotice("Le registre ne répond pas — nouvelle tentative dans 5 s.");
          await new Promise((r) => setTimeout(r, 5_000));
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

  // Montage : état réel, puis accélération automatique s'il reste du travail.
  useEffect(() => {
    mountedRef.current = true;
    void (async () => {
      const s = await loadStatus();
      if (mountedRef.current && (s?.remaining ?? 0) > 0) void loop();
    })();
    return () => {
      mountedRef.current = false; // la boucle s'arrête au lot suivant
    };
  }, [loadStatus, loop]);

  // Suivi de l'avancement même quand la boucle locale ne tourne pas.
  useEffect(() => {
    if (!status?.inProgress) return;
    const iv = setInterval(() => void loadStatus(), POLL_MS);
    return () => clearInterval(iv);
  }, [status?.inProgress, loadStatus]);

  const pct = status?.pct ?? 0;
  const remaining = status?.remaining ?? 0;
  const inProgress = status?.inProgress ?? false;
  const sessionTotal = session.identities + session.facts + session.candidates + session.duplicates;
  const eta = etaFr(remaining);

  return (
    <div className="card border-fuchsia-200/70 bg-gradient-to-r from-fuchsia-50/50 via-white to-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            {status == null ? (
              // Tant que l'état n'est pas chargé, on n'affiche NI « terminé »
              // NI « en cours » — sinon flash trompeur à chaque rafraîchissement.
              <>
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-slate-300" />
                Lecture de l&apos;avancement…
              </>
            ) : inProgress ? (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fuchsia-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-fuchsia-500" />
                </span>
                Enrichissement en cours
              </>
            ) : (
              <>✓ Base entièrement enrichie</>
            )}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {status == null ? (
              <>Récupération de l&apos;état réel de ta base…</>
            ) : inProgress ? (
              <>
                Revold traite ta base en continu, application ouverte ou fermée
                {eta && <> — fin estimée dans <span className="font-medium text-slate-700">{eta}</span></>}. Dernière
                avancée <span className="font-medium text-slate-700">{sinceFr(status?.lastActivityAt ?? null)}</span>.
              </>
            ) : (
              <>Le robot entretient la donnée : nouvelles entreprises traitées à leur arrivée, rafraîchissement tous les 90 jours.</>
            )}
          </p>
        </div>
        {status != null && (
          <p className="shrink-0 text-right text-xs text-slate-500">
            <span className="block text-2xl font-bold tabular-nums text-slate-900">{pct} %</span>
            {fmt(status.processed)} traitées{remaining > 0 && <> · {fmt(remaining)} restantes</>}
          </p>
        )}
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full bg-gradient-to-r from-fuchsia-600 to-pink-600 transition-all duration-700 ${inProgress ? "animate-pulse" : ""}`}
          style={{ width: `${status == null ? 0 : Math.max(pct, 2)}%` }}
        />
      </div>

      {status != null && (
        <p className="mt-1.5 text-[11px] text-slate-500">
          <span className="font-semibold text-slate-700">{fmt(status.withSiren)}</span> entreprises identifiées
          (SIREN/TVA trouvés) · <span className="font-semibold text-slate-700">{fmt(status.withEmployees)}</span> avec
          effectif officiel · <span className="font-semibold text-amber-700">{fmt(status.candidates)}</span> en attente
          de validation ci-dessous
          {(status.duplicates ?? 0) > 0 && (
            <>
              {" "}· <span className="font-semibold text-slate-700">{fmt(status.duplicates)}</span> fiches en doublon
              (même entreprise déjà présente)
            </>
          )}
          {sessionTotal > 0 && (
            <>
              {" "}· <span className="text-fuchsia-600">+{sessionTotal} depuis l&apos;ouverture de cette page</span>
            </>
          )}
        </p>
      )}

      {notice && <p className="mt-1.5 text-[11px] font-medium text-amber-700">{notice}</p>}

      <p className="mt-2 border-t border-fuchsia-100 pt-2 text-[11px] text-slate-400">
        <span className="font-medium text-slate-500">Qualité garantie quel que soit le rythme</span> : seules les
        correspondances <span className="font-medium text-slate-500">exactes</span> sont appliquées automatiquement ;
        tout cas ambigu passe par ta validation ci-dessous, et un appel au registre qui échoue ne marque jamais une
        entreprise comme traitée.
      </p>
    </div>
  );
}
