"use client";

/**
 * Enveloppe un bloc « en dur » d'une page pour le rendre retirable.
 * Le retrait enregistre un masquage (page_tiles, kind=hide_block) — le bloc
 * se réaffiche depuis « ＋ Ajouter un bloc » (BlocksManager).
 */

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

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
  const [busy, setBusy] = useState(false);

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
    }
  }

  return (
    <div className="group/block relative">
      <button
        type="button"
        title={`Retirer le bloc « ${label} »`}
        disabled={busy}
        onClick={hide}
        className="absolute -right-1 -top-1 z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-[11px] font-bold text-slate-400 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 group-hover/block:flex"
      >
        ✕
      </button>
      {children}
    </div>
  );
}
