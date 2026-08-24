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
  const [diag, setDiag] = useState<{
    failedBatches: number; firstErrorStatus: number | null; companiesWithAssoc: number;
    typeIdsSeen: number[]; labelsSeen: string[]; parentTypeIds: number[];
  } | null>(null);

  async function run() {
    if (running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setDiag(null);
    setProcessed(0);
    let offset = 0;
    let parentsFound = 0;
    let linked = 0;
    let scanned = 0;
    // Diagnostic agrégé (pourquoi 0 le cas échéant).
    let failedBatches = 0;
    let firstErrorStatus: number | null = null;
    let companiesWithAssoc = 0;
    const typeIds = new Set<number>();
    const labels = new Set<string>();
    let parentTypeIds: number[] = [];
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
        const g = d.diag ?? {};
        failedBatches += Number(g.failedBatches) || 0;
        if (firstErrorStatus == null && g.firstErrorStatus != null) firstErrorStatus = Number(g.firstErrorStatus);
        companiesWithAssoc += Number(g.companiesWithAssoc) || 0;
        for (const t of (g.typeIdsSeen ?? []) as number[]) typeIds.add(t);
        for (const l of (g.labelsSeen ?? []) as string[]) labels.add(l);
        if (Array.isArray(g.parentTypeIds)) parentTypeIds = g.parentTypeIds;
        setProcessed(scanned);
        if (d.done) break;
        offset = Number(d.nextOffset) || offset + 1000;
      }
      setResult({ parentsFound, linked, scanned });
      setDiag({
        failedBatches, firstErrorStatus, companiesWithAssoc,
        typeIdsSeen: [...typeIds].sort((a, b) => a - b), labelsSeen: [...labels].slice(0, 24), parentTypeIds,
      });
      // Tuiles + bloc « Groupes déclarés » rechargés avec les nouvelles données,
      // et la console de validation relance sa détection (l'opt-in vient d'être
      // posé au premier passage — les premières suggestions arrivent ici).
      router.refresh();
      window.dispatchEvent(new Event("revold:hierarchy-synced"));
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
          <h3 className="text-sm font-semibold text-slate-900">Rapprochement dans Revold</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Lit les associations natives <span className="font-medium text-slate-600">« Société mère / Entreprise enfant »</span>{" "}
            de HubSpot et les rapproche dans Revold — <span className="font-medium text-slate-600">lecture seule</span>,
            rien n&apos;est écrit dans le CRM : l&apos;écriture vers HubSpot passe par la table de validation ci-dessous.{" "}
            {linkedChildren > 0
              ? `${linkedChildren.toLocaleString("fr-FR")} entité${linkedChildren > 1 ? "s" : ""} déjà rapprochée${linkedChildren > 1 ? "s" : ""} (${coverage} % de la base CRM).`
              : "Aucune entité rapprochée pour l'instant."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={running || !hubspotConnected || total === 0}
          className="shrink-0 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {running ? "Rapprochement…" : "⚡ Lancer le rapprochement"}
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
              rapprochée.
            </p>
            {/* Diagnostic : distingue « rien de posé » d'un vrai problème de lecture. */}
            {diag && diag.failedBatches > 0 ? (
              <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-amber-700">
                ⚠ {diag.failedBatches} lot{diag.failedBatches > 1 ? "s" : ""} d&apos;appels HubSpot en échec
                {diag.firstErrorStatus ? ` (statut ${diag.firstErrorStatus}` : ""}
                {diag.firstErrorStatus === 403 ? " — scope d'association manquant sur l'app OAuth" : diag.firstErrorStatus ? ")" : ""}.
                La lecture des associations n&apos;a pas abouti : ce n&apos;est pas « 0 hiérarchie », c&apos;est un
                problème d&apos;accès à corriger.
              </p>
            ) : diag && diag.companiesWithAssoc > 0 ? (
              <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-amber-700">
                ⚠ {diag.companiesWithAssoc.toLocaleString("fr-FR")} entreprises ont bien des associations
                entreprise↔entreprise, mais aucune n&apos;a été reconnue comme « parent ».
                {diag.typeIdsSeen.length > 0 && <> Types d&apos;association vus : <span className="font-mono">[{diag.typeIdsSeen.join(", ")}]</span> ; on cherchait le parent parmi <span className="font-mono">[{diag.parentTypeIds.join(", ")}]</span>.</>}
                {diag.labelsSeen.length > 0 && <> Libellés vus : {diag.labelsSeen.map((l) => `« ${l} »`).join(", ")}.</>}
                {" "}Envoie-moi cette ligne : j&apos;ajoute le bon type de parent.
              </p>
            ) : (
              <p className="mt-0.5 text-slate-500">
                Ce n&apos;est pas un dysfonctionnement : ta base HubSpot ne contient pas d&apos;association
                entreprise↔entreprise lisible. Valide des suggestions dans la table ci-dessous — c&apos;est elle
                qui écrit les associations dans HubSpot — ou déclare des liens directement dans HubSpot puis relance.
              </p>
            )}
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
