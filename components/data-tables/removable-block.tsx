"use client";

/**
 * Enveloppe un bloc « en dur » d'une page pour le rendre retirable.
 * Le retrait enregistre un masquage (page_tiles, kind=hide_block) — le bloc
 * se réaffiche depuis « ＋ Ajouter un bloc » (BlocksManager).
 *
 * Le contrôle est l'icône CORBEILLE discrète en haut à GAUCHE (la flèche de
 * repli des blocs est en haut à droite — ne pas superposer) — MÊME icône que
 * la suppression d'une table de données (une seule visualisation pour la même
 * action « retirer »). Une étape de confirmation (l'icône passe en rouge) évite
 * les retraits accidentels.
 *
 * La pastille n'apparaît QUE pendant la personnalisation de la page (bouton
 * « Personnaliser les KPIs ») — pas au simple survol du bloc.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { usePageEditMode } from "@/components/data-tables/page-edit-mode";

export function RemovableBlock({
  pageKey,
  blockKey,
  label,
  children,
}: {
  pageKey: string;
  blockKey: string;
  label: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const editing = usePageEditMode();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Sortie du mode édition → on annule toute confirmation en attente.
  useEffect(() => {
    if (!editing) setConfirming(false);
  }, [editing]);

  // La demande de confirmation expire toute seule.
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

  async function hide() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/page-tiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_key: pageKey, kind: "hide_block", tile_key: blockKey, title: label }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <div className="relative">
      {/* Visible uniquement en mode personnalisation — pas au survol. */}
      {editing && (
        <button
          type="button"
          title={confirming ? (busy ? "Retrait…" : "Cliquer à nouveau pour confirmer le retrait") : `Retirer le bloc « ${label} »`}
          aria-label={`Retirer le bloc « ${label} »`}
          disabled={busy}
          onClick={() => (confirming ? hide() : setConfirming(true))}
          className={`absolute -top-3 left-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border bg-white shadow-sm transition disabled:opacity-50 ${
            confirming
              ? "border-rose-300 bg-rose-50 text-rose-600"
              : "border-slate-200 text-slate-300 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
        </button>
      )}
      {children}
    </div>
  );
}
