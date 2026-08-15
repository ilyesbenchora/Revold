"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * ACCÉLÉRATEUR D'ENRICHISSEMENT, SANS INTERFACE — monté dans le layout du
 * dashboard, il enchaîne des lots tant que l'utilisateur est dans l'app,
 * quelle que soit la page consultée.
 *
 * Pourquoi : le cron tourne toutes les 5 minutes, ce qui suffit à finir un
 * backfill mais reste lent quand on vient de connecter sa base. Le runner
 * VISIBLE (page Suivi → Enrichissement) n'accélère que si on reste sur cette
 * page — or personne ne regarde une barre de progression pendant une heure.
 *
 * Règles de bonne conduite :
 *  · silencieux — aucun rendu, aucune notification, aucun `router.refresh()`
 *    qui viendrait recharger la page que l'utilisateur est en train de lire ;
 *  · il s'efface devant le runner visible (page Enrichissement) pour ne pas
 *    consommer deux fois le même budget ;
 *  · il s'arrête dès qu'il n'y a plus rien à traiter, et ne repart pas.
 */

/** Page portant le runner visible — il a la priorité, on ne double pas. */
const VISIBLE_RUNNER_PATH = "/dashboard/enrichissement";

export function EnrichmentBackgroundRunner() {
  const pathname = usePathname();
  const mountedRef = useRef(true);
  const loopRef = useRef(false);
  /** Chantier terminé sur cette session : on ne relance plus à chaque nav. */
  const doneRef = useRef(false);

  const loop = useCallback(async () => {
    if (loopRef.current || doneRef.current) return;
    loopRef.current = true;
    try {
      while (mountedRef.current) {
        const res = await fetch("/api/enrichment/backfill", { method: "POST" });
        if (!res.ok) break; // le cron reprendra le relais
        const d = (await res.json().catch(() => ({}))) as {
          lookupsUsed?: number;
          interrupted?: boolean;
          remainingIdentities?: number;
          remainingFacts?: number;
        };
        if (!mountedRef.current) break;

        const remaining = (d.remainingIdentities ?? 0) + (d.remainingFacts ?? 0);
        if (remaining <= 0) {
          doneRef.current = true;
          break;
        }
        if (d.interrupted) {
          await new Promise((r) => setTimeout(r, 5_000));
          continue;
        }
        // Aucun lookup consommé alors qu'il reste du travail : rien de
        // traitable pour l'instant, inutile de marteler l'API.
        if ((d.lookupsUsed ?? 0) === 0) break;
      }
    } catch {
      /* silencieux : c'est une accélération, pas une fonction critique */
    } finally {
      loopRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (pathname === VISIBLE_RUNNER_PATH || doneRef.current) return;
    void (async () => {
      try {
        const res = await fetch("/api/enrichment/status");
        if (!res.ok) return;
        const s = (await res.json()) as { remaining?: number };
        if (mountedRef.current && (s.remaining ?? 0) > 0) void loop();
      } catch {
        /* silencieux */
      }
    })();
    return () => {
      mountedRef.current = false; // la boucle s'arrête au lot suivant
    };
  }, [pathname, loop]);

  return null;
}
