"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * « Enrichir toute ma base maintenant » — boucle sur /api/enrichment/backfill
 * (un lot ≈ 60 entreprises ≈ 30 s par appel) jusqu'à épuisement, avec
 * progression visible et bouton stop. Complément immédiat du cron horaire :
 * même moteur, déclenché à la demande.
 */

type Batch = {
  lookupsUsed: number;
  identities: number;
  candidates: number;
  facts: number;
  remainingIdentities: number;
  remainingFacts: number;
};

export function EnrichmentBackfillRunner() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [totals, setTotals] = useState({ identities: 0, candidates: 0, facts: 0 });
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const stopRef = useRef(false);

  async function run() {
    if (running) return;
    setRunning(true);
    setDone(false);
    setError(null);
    setTotals({ identities: 0, candidates: 0, facts: 0 });
    stopRef.current = false;
    try {
      // 200 lots max = garde-fou (≈ 12 000 lookups) — la boucle s'arrête
      // d'elle-même quand il ne reste rien à traiter.
      for (let i = 0; i < 200; i++) {
        const res = await fetch("/api/enrichment/backfill", { method: "POST" });
        const d = (await res.json().catch(() => ({}))) as Partial<Batch> & { error?: string };
        if (!res.ok) throw new Error(d.error || "Échec du lot d'enrichissement");
        setTotals((t) => ({
          identities: t.identities + (d.identities ?? 0),
          candidates: t.candidates + (d.candidates ?? 0),
          facts: t.facts + (d.facts ?? 0),
        }));
        const rem = (d.remainingIdentities ?? 0) + (d.remainingFacts ?? 0);
        setRemaining(rem);
        // Rafraîchit les tuiles de couverture au fil de l'eau.
        router.refresh();
        if (rem <= 0 || (d.lookupsUsed ?? 0) === 0 || stopRef.current) break;
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setRunning(false);
    }
  }

  const processed = totals.identities + totals.candidates + totals.facts;

  return (
    <div className="card flex flex-wrap items-center justify-between gap-4 border-fuchsia-200/70 bg-gradient-to-r from-fuchsia-50/50 via-white to-white p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">🚀 Enrichir toute ma base maintenant</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {running ? (
            <>
              Enrichissement en cours — {totals.identities} identité{totals.identities > 1 ? "s" : ""} ·{" "}
              {totals.facts} effectifs/CA · {totals.candidates} à valider
              {remaining != null && <> · <span className="font-semibold text-fuchsia-600">~{remaining} restantes</span></>}
            </>
          ) : done ? (
            <>
              ✓ Terminé : {totals.identities} identité{totals.identities > 1 ? "s" : ""} complétée{totals.identities > 1 ? "s" : ""},{" "}
              {totals.facts} effectifs/CA mis à jour, {totals.candidates} en attente de validation ci-dessous.
            </>
          ) : (
            <>
              Traite l&apos;ensemble des entreprises par lots (~60 / 30 s), sans quitter la page. Le cron horaire
              prend ensuite le relais pour entretenir la donnée.
            </>
          )}
          {processed === 0 && done && " Rien à traiter — la base est à jour."}
        </p>
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {running && (
          <button
            onClick={() => { stopRef.current = true; }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Arrêter après ce lot
          </button>
        )}
        <button
          onClick={run}
          disabled={running}
          className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-60"
        >
          {running ? "Enrichissement…" : done ? "Relancer" : "🚀 Lancer l'enrichissement complet"}
        </button>
      </div>
    </div>
  );
}
