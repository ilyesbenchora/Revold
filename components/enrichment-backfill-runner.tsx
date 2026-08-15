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
  // Volume total du chantier, mesuré au premier lot → barre de progression.
  const [initialTotal, setInitialTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const stopRef = useRef(false);

  async function run() {
    if (running) return;
    setRunning(true);
    setDone(false);
    setError(null);
    setTotals({ identities: 0, candidates: 0, facts: 0 });
    setInitialTotal(null);
    setRemaining(null);
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
        // Premier lot : le total du chantier = restant + ce qui vient d'être traité.
        setInitialTotal((prev) => prev ?? rem + (d.lookupsUsed ?? 0));
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
  // Progression : mesurée dès le premier lot ; avant, barre indéterminée animée.
  const pct =
    initialTotal != null && initialTotal > 0 && remaining != null
      ? Math.min(100, Math.max(2, Math.round(((initialTotal - remaining) / initialTotal) * 100)))
      : null;

  return (
    <div className="card border-fuchsia-200/70 bg-gradient-to-r from-fuchsia-50/50 via-white to-white p-4">
      {/* ── Barre de progression (visible pendant et après un run) ── */}
      {(running || done) && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
            <span>
              {running
                ? pct != null
                  ? `Progression : ${pct} %`
                  : "Démarrage — mesure du volume à traiter…"
                : "Progression : 100 %"}
            </span>
            {running && remaining != null && <span>~{remaining} restantes</span>}
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
            {running && pct == null ? (
              // Indéterminée : premier lot en cours, on ne connaît pas encore le volume.
              <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-fuchsia-400 to-pink-400" />
            ) : (
              <div
                className="h-full rounded-full bg-gradient-to-r from-fuchsia-600 to-pink-600 transition-all duration-700"
                style={{ width: `${done ? 100 : pct ?? 0}%` }}
              />
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">🚀 Enrichir toute ma base maintenant</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {running ? (
            <>
              Enrichissement en cours — {totals.identities} identité{totals.identities > 1 ? "s" : ""} ·{" "}
              {totals.facts} effectifs/CA · {totals.candidates} à valider
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
    </div>
  );
}
