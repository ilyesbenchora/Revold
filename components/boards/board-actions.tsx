"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Actions d'un tableau de bord personnalisé : visibilité (privé / équipe /
 * espace de travail), renommer (inline) et supprimer (confirmation en deux
 * clics — le 1er clic arme, le 2e supprime).
 */

export const VISIBILITY_OPTIONS: { id: "private" | "team" | "workspace"; label: string; hint: string }[] = [
  { id: "private", label: "🔒 Moi uniquement", hint: "Visible par toi seul (et les admins)." },
  { id: "team", label: "👥 Mon équipe", hint: "Visible par les membres de ton espace de travail (pôle)." },
  { id: "workspace", label: "🌐 Tout l'espace de travail", hint: "Visible par toute l'organisation." },
];

export function BoardActions({
  boardId,
  name,
  visibility = "workspace",
}: {
  boardId: string;
  name: string;
  visibility?: "private" | "team" | "workspace";
}) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState(name);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Visibilité : modifiable À TOUT MOMENT sur un tableau/onglet existant. ──
  const [vis, setVis] = useState(visibility);

  async function changeVisibility(next: "private" | "team" | "workspace") {
    if (busy || next === vis) return;
    const prev = vis;
    setVis(next);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/boards/${boardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: next }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setVis(prev);
        setError(d.error ?? "Changement de visibilité impossible.");
        return;
      }
      router.refresh();
    } catch {
      setVis(prev);
      setError("Changement de visibilité impossible.");
    } finally {
      setBusy(false);
    }
  }

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
      {/* Visibilité du tableau / de l'onglet — appliquée immédiatement. */}
      <select
        value={vis}
        disabled={busy}
        onChange={(e) => changeVisibility(e.target.value as "private" | "team" | "workspace")}
        title={VISIBILITY_OPTIONS.find((o) => o.id === vis)?.hint}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 outline-none focus:border-accent disabled:opacity-50"
      >
        {VISIBILITY_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
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
