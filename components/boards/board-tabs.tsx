"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * LA rangée principale des Tableaux de bord (les pages n'affichent pas la
 * rangée Dashboard au-dessus — elle ferait doublon) : « Vue d'ensemble »
 * (le tableau par défaut) + les onglets créés par l'utilisateur + le CTA
 * « ＋ Nouvel onglet » pour en ajouter, directement dans la rangée.
 * Chaque tableau est une page entièrement personnalisable (tuiles KPI +
 * tables de données) sous sa propre clé board_<id> — sources réglables dans
 * « Outil source par page ».
 */
export type BoardTab = { id: string; name: string };

/** Template proposé à la création (sérialisé côté serveur — entités réellement synchronisées). */
export type BoardTemplateOption = { id: string; label: string; description: string };

const BASE = "/dashboard/tableaux-de-bord";

export function BoardTabs({ boards, templates = [] }: { boards: BoardTab[]; templates?: BoardTemplateOption[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<string | null>(null);
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
        body: JSON.stringify({ name: n, template }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.board?.id) {
        setError(d.error ?? "Création impossible.");
        return;
      }
      setCreating(false);
      setName("");
      setTemplate(null);
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
          ＋ Nouvel onglet
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
            <h3 className="text-sm font-semibold text-slate-900">Nouvel onglet</h3>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Une page vierge à composer : tes KPIs (funnel de câblage sur tes outils) et tes tables de données.
              Les sources se choisissent dans Paramètres → Intégrations → Outil source par page.
            </p>
            <label className="mt-4 block text-[11px] font-medium text-slate-500">
              Nom de l&apos;onglet
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="Ex : Reporting ERP, Cockpit CEO…"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900 focus:border-accent focus:outline-none"
              />
            </label>

            {/* ── Composition de départ : page vierge ou template basé sur les
                   entités réellement synchronisées — tout reste modifiable. ── */}
            {templates.length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] font-medium text-slate-500">Composition de départ</p>
                <div className="mt-1.5 max-h-44 space-y-1.5 overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={() => setTemplate(null)}
                    className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition ${
                      template === null ? "border-accent bg-accent/5" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-slate-800">Page vierge</span>
                      <span className="block text-[11px] text-slate-400">Tu composes tout toi-même — tuiles et tables.</span>
                    </span>
                  </button>
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTemplate(t.id)}
                      className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition ${
                        template === t.id ? "border-accent bg-accent/5" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-slate-800">{t.label}</span>
                        <span className="block text-[11px] text-slate-400">{t.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
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
                {busy ? "Création…" : "Créer l'onglet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
