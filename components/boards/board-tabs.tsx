"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Onglets des Tableaux de bord : « Vue d'ensemble » + les tableaux créés par
 * l'utilisateur + le CTA « ＋ Nouveau tableau ». Chaque tableau est une page
 * entièrement personnalisable (tuiles KPI + tables de données) sous sa propre
 * clé board_<id> — sources réglables dans « Outil source par page ».
 */
export type BoardTab = { id: string; name: string };

const BASE = "/dashboard/tableaux-de-bord";

export function BoardTabs({ boards }: { boards: BoardTab[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tabs = [
    { href: BASE, label: "Vue d'ensemble" },
    ...boards.map((b) => ({ href: `${BASE}/${b.id}`, label: b.name })),
  ];

  async function create() {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.board?.id) {
        setError(d.error ?? "Création impossible.");
        return;
      }
      setCreating(false);
      setName("");
      router.push(`${BASE}/${d.board.id}`);
      router.refresh();
    } catch {
      setError("Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-card-border">
      <div className="flex items-center gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const isActive = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`relative shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium transition ${
                isActive ? "text-accent" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {t.label}
              {isActive && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent" />}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => { setCreating(true); setError(null); }}
          className="shrink-0 whitespace-nowrap px-3 py-2 text-sm font-medium text-fuchsia-600 transition hover:text-fuchsia-700"
        >
          ＋ Nouveau tableau
        </button>
      </div>

      {/* ── Modal de création : juste un nom, la page arrive prête à câbler. ── */}
      {creating && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !busy && setCreating(false)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-900">Nouveau tableau de bord</h3>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Une page vierge à composer : tes KPIs (funnel de câblage sur tes outils) et tes tables de données.
              Les sources se choisissent dans Paramètres → Intégrations → Outil source par page.
            </p>
            <label className="mt-4 block text-[11px] font-medium text-slate-500">
              Nom du tableau
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="Ex : Reporting ERP, Cockpit CEO…"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900 focus:border-accent focus:outline-none"
              />
            </label>
            {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setCreating(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={busy || !name.trim()}
                onClick={create}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Création…" : "Créer le tableau"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
