"use client";

import { useState } from "react";

/**
 * Partage public d'un tableau de bord — bouton « Partager » : crée (ou
 * retrouve) le lien public en lecture seule /partage/<jeton>, à copier ;
 * « Révoquer » tue le lien immédiatement (recréer génère un NOUVEAU jeton).
 */
export function BoardShareButton({ pageKey, title }: { pageKey: string; title?: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPanel() {
    setOpen(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/boards/share?pageKey=${encodeURIComponent(pageKey)}`);
      const d = await res.json().catch(() => ({}));
      setUrl(d.share?.url ?? null);
    } catch {
      setUrl(null);
    }
  }

  async function create() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/boards/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageKey, title }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.share?.url) {
        setError(d.error ?? "Partage impossible.");
        return;
      }
      setUrl(d.share.url);
    } catch {
      setError("Partage impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/boards/share", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageKey }),
      });
      if (res.ok) {
        setUrl(null);
        setCopied(false);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Révocation impossible.");
      }
    } catch {
      setError("Révocation impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="relative" data-tour="board-share">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : void openPanel())}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
        Partager
        {url && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Lien public actif" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
          <p className="text-xs font-semibold text-slate-800">Lien public en lecture seule</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Toute personne avec le lien voit ce tableau (chiffres recalculés en direct), sans compte Revold.
            Aucune édition possible.
          </p>

          {url ? (
            <>
              <div className="mt-3 flex items-center gap-1.5">
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600 outline-none"
                />
                <button
                  type="button"
                  onClick={() => void copy()}
                  className="shrink-0 rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:opacity-90"
                >
                  {copied ? "Copié ✓" : "Copier"}
                </button>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void revoke()}
                className="mt-2 text-[11px] font-medium text-rose-500 hover:text-rose-600 disabled:opacity-50"
              >
                Révoquer le lien (il cesse de fonctionner immédiatement)
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void create()}
              className="mt-3 w-full rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Création…" : "Créer le lien public"}
            </button>
          )}

          {error && <p className="mt-2 text-[11px] text-rose-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
