"use client";

/**
 * Enveloppe un bloc « en dur » d'une page pour le rendre retirable.
 * Le retrait enregistre un masquage (page_tiles, kind=hide_block) — le bloc
 * se réaffiche depuis « ＋ Ajouter un bloc » (BlocksManager).
 *
 * Le contrôle est une pastille « ✕ Retirer » en haut à GAUCHE (la flèche de
 * repli des blocs est en haut à droite — ne pas superposer), avec une étape
 * de confirmation pour éviter les retraits accidentels.
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
          title={confirming ? "Cliquer à nouveau pour confirmer" : `Retirer le bloc « ${label} »`}
          disabled={busy}
          onClick={() => (confirming ? hide() : setConfirming(true))}
          className={`absolute -top-3 left-2 z-10 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold shadow-sm transition disabled:opacity-50 ${
            confirming
              ? "border-rose-300 bg-rose-50 text-rose-700"
              : "border-slate-200 bg-white text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
          }`}
        >
          {confirming ? (busy ? "Retrait…" : "Confirmer le retrait ?") : "✕ Retirer"}
        </button>
      )}
      {children}
    </div>
  );
}
