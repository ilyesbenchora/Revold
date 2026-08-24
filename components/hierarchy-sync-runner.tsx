"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Synchronisation à la demande des hiérarchies HubSpot (associations
 * parent/enfant entreprise→entreprise) — même mécanique visuelle que le
 * moteur d'enrichissement : bouton de lancement, barre de complétion pendant
 * le passage, bilan honnête à la fin. Si HubSpot ne contient AUCUNE
 * association parent/enfant, on le dit clairement au lieu de laisser croire
 * que la synchronisation a échoué.
 */

export function HierarchySyncRunner({
  total,
  linkedChildren,
  hubspotConnected,
}: {
  /** Entreprises CRM (hubspot_id) balayées par la synchronisation. */
  total: number;
  /** Entités déjà reliées à un parent en base. */
  linkedChildren: number;
  hubspotConnected: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ parentsFound: number; linked: number; scanned: number } | null>(null);

  async function run() {
    if (running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setProcessed(0);
    let offset = 0;
    let parentsFound = 0;
    let linked = 0;
    let scanned = 0;
    try {
      for (let guard = 0; guard < 50; guard++) {
        const res = await fetch("/api/hierarchy/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "Synchronisation impossible");
        parentsFound += Number(d.parentsFound) || 0;
        linked += Number(d.linked) || 0;
        scanned = Number(d.processed) || scanned;
        setProcessed(scanned);
        if (d.done) break;
        offset = Number(d.nextOffset) || offset + 1000;
      }
      setResult({ parentsFound, linked, scanned });
      // Tuiles + bloc « Groupes déclarés » rechargés avec les nouvelles données.
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setRunning(false);
    }
  }

  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
  const coverage = total > 0 ? Math.round((linkedChildren / total) * 100) : 0;

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">Synchronisation HubSpot</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Lit les associations parent/enfant <span className="font-medium text-slate-600">entreprise → entreprise</span>{" "}
            réellement posées dans HubSpot et les reflète ici — rien n&apos;est deviné.{" "}
            {linkedChildren > 0
              ? `${linkedChildren.toLocaleString("fr-FR")} entité${linkedChildren > 1 ? "s" : ""} déjà reliée${linkedChildren > 1 ? "s" : ""} à un parent (${coverage} % de la base CRM).`
              : "Aucune entité reliée pour l'instant."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={running || !hubspotConnected || total === 0}
          className="shrink-0 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {running ? "Synchronisation…" : "↺ Synchroniser depuis HubSpot"}
        </button>
      </div>

      {!hubspotConnected && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          HubSpot n&apos;est pas connecté — la hiérarchie se lit dans le CRM.
        </p>
      )}

      {/* Barre de complétion pendant le passage (tranches de 1 000 fiches). */}
      {running && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Vérification des associations…</span>
            <span className="tabular-nums">{processed.toLocaleString("fr-FR")} / {total.toLocaleString("fr-FR")} · {pct} %</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {error && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-rose-600">{error}</p>}

      {result && (
        result.parentsFound === 0 ? (
          <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            <p className="font-medium text-slate-700">
              {result.scanned.toLocaleString("fr-FR")} entreprises vérifiées — aucune association parent/enfant
              trouvée dans HubSpot.
            </p>
            <p className="mt-0.5 text-slate-500">
              Ce n&apos;est pas un dysfonctionnement : ta base HubSpot ne contient simplement pas encore de
              hiérarchie entreprise→entreprise. Valide des suggestions ci-dessous (Revold écrira les associations),
              ou déclare des liens parent/enfant directement dans HubSpot puis relance.
            </p>
          </div>
        ) : (
          <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
            ✓ {result.scanned.toLocaleString("fr-FR")} entreprises vérifiées · {result.parentsFound.toLocaleString("fr-FR")} association{result.parentsFound > 1 ? "s" : ""} parent/enfant trouvée{result.parentsFound > 1 ? "s" : ""}
            {result.linked > 0 && <> · {result.linked.toLocaleString("fr-FR")} lien{result.linked > 1 ? "s" : ""} mis à jour</>}.
          </p>
        )
      )}
    </div>
  );
}
