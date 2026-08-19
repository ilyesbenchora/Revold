"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Actions d'un tableau de bord personnalisé : renommer (inline) et supprimer
 * (confirmation en deux clics — le 1er clic arme, le 2e supprime).
 */
export function BoardActions({ boardId, name }: { boardId: string; name: string }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState(name);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rename() {
    const n = value.trim();
    if (!n || busy) return;
    if (n === name) { setRenaming(false); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/boards/${boardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Renommage impossible.");
        return;
      }
      setRenaming(false);
      router.refresh();
    } catch {
      setError("Renommage impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    if (!armed) { setArmed(true); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/boards/${boardId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Suppression impossible.");
        return;
      }
      router.push("/dashboard/tableaux-de-bord");
      router.refresh();
    } catch {
      setError("Suppression impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {renaming ? (
        <>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && rename()}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            disabled={busy || !value.trim()}
            onClick={rename}
            className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "…" : "Enregistrer"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => { setRenaming(false); setValue(name); }}
            className="text-xs font-medium text-slate-400 hover:text-slate-600"
          >
            Annuler
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setRenaming(true)}
          className="text-xs font-medium text-slate-400 transition hover:text-slate-600 hover:underline"
        >
          ✎ Renommer
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={remove}
        onBlur={() => setArmed(false)}
        className={`text-xs font-medium transition hover:underline disabled:opacity-50 ${
          armed ? "text-rose-600" : "text-slate-400 hover:text-rose-600"
        }`}
      >
        {armed ? "Confirmer la suppression ?" : "Supprimer"}
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}
