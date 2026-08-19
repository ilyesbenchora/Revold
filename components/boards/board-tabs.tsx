"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Rangées d'onglets des Tableaux de bord — DEUX niveaux :
 *  - rangée RACINE (sans parentId) : « Vue d'ensemble » (tableau par défaut)
 *    + les tableaux créés + « ＋ Nouveau tableau » ;
 *  - rangée d'un TABLEAU (parentId = id du tableau) : ses onglets (sous-pages)
 *    + « ＋ Nouvel onglet ».
 * Chaque tableau / onglet est une page entièrement personnalisable (tuiles
 * KPI + tables de données) sous sa propre clé board_<id> — sources réglables
 * dans « Outil source par page ».
 */
export type BoardTab = { id: string; name: string };

/** Template proposé à la création (sérialisé côté serveur — entités réellement synchronisées). */
export type BoardTemplateOption = { id: string; label: string; description: string };

const BASE = "/dashboard/tableaux-de-bord";

export function BoardTabs({
  boards,
  templates = [],
  parentId = null,
  activeHref,
}: {
  boards: BoardTab[];
  templates?: BoardTemplateOption[];
  /** id du tableau parent → la rangée liste ses ONGLETS (« ＋ Nouvel onglet »). */
  parentId?: string | null;
  /** Onglet à surligner quand l'URL ne suffit pas (tableau parent actif sur un onglet). */
  activeHref?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<string | null>(null);
  // Visibilité de la nouvelle page : privé / équipe / espace (défaut : espace).
  const [visibility, setVisibility] = useState<"private" | "team" | "workspace">("workspace");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTabRow = parentId != null;
  const tabs = [
    ...(isTabRow ? [] : [{ href: BASE, label: "Vue d'ensemble" }]),
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
        body: JSON.stringify({ name: n, template, visibility, ...(parentId ? { parentId } : {}) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.board?.id) {
        setError(d.error ?? "Création impossible.");
        return;
      }
      setCreating(false);
      setName("");
      setTemplate(null);
      setVisibility("workspace");
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
          const isActive = pathname === t.href || activeHref === t.href;
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
          {isTabRow ? "＋ Nouvel onglet" : "＋ Nouveau tableau"}
        </button>
        {/* La galerie des Templates est une page À PART (sidebar Dashboard →
            Templates) — pas d'onglet ici. */}
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
            <h3 className="text-sm font-semibold text-slate-900">
              {isTabRow ? "Nouvel onglet" : "Nouveau tableau de bord"}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {isTabRow
                ? "Une sous-page de ce tableau, vierge à composer : tes KPIs et tes tables de données."
                : "Une page vierge à composer : tes KPIs (funnel de câblage sur tes outils) et tes tables de données."}{" "}
              Les sources se choisissent dans Paramètres → Intégrations → Outil source par page.
            </p>
            <label className="mt-4 block text-[11px] font-medium text-slate-500">
              {isTabRow ? "Nom de l'onglet" : "Nom du tableau"}
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="Ex : Reporting ERP, Cockpit CEO…"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900 focus:border-accent focus:outline-none"
              />
            </label>

            {/* ── Visibilité : moi / mon équipe / tout l'espace — modifiable
                   ensuite à tout moment depuis la page (sélecteur en haut). ── */}
            <div className="mt-3">
              <p className="text-[11px] font-medium text-slate-500">Visible par</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {([
                  { id: "private", label: "🔒 Moi uniquement" },
                  { id: "team", label: "👥 Mon équipe" },
                  { id: "workspace", label: "🌐 Tout l'espace" },
                ] as const).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setVisibility(o.id)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                      visibility === o.id
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

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
            {/* Renvoi vers la galerie : aperçu détaillé des templates + compositeur agent. */}
            {!isTabRow && (
              <p className="mt-2 text-[11px] text-slate-400">
                <Link href={`${BASE}/templates`} className="font-medium text-fuchsia-600 hover:underline">
                  Voir la galerie des templates
                </Link>
                {" "}— ou laisse l&apos;agent ✨ composer ton tableau depuis cette page.
              </p>
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
                {busy ? "Création…" : isTabRow ? "Créer l'onglet" : "Créer le tableau"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
