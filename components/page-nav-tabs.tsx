"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  mergeNavItems,
  navItemHref,
  slugifyNavLabel,
  type PageNavDef,
  type PageNavItem,
} from "@/lib/settings/page-nav";

/**
 * Barre d'onglets PERSONNALISABLE d'une section (table page_nav) : les
 * onglets standard peuvent être renommés, et des pages custom ajoutées —
 * rendues sur /p/[slug] avec leurs propres tuiles KPI et tableaux
 * configurables (clé `<basePageKey>_<slug>`). Utilisée par les sections
 * Ventes et Marketing (une PageNavDef par section).
 */
export function PageNavTabs({ nav }: { nav: PageNavDef }) {
  const pathname = usePathname();
  const router = useRouter();
  const [tabs, setTabs] = useState<PageNavItem[]>(nav.defaults);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PageNavItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/page-nav?nav_key=${nav.navKey}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setTabs(mergeNavItems(nav, d.items as PageNavItem[]));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.navKey]);

  function openEditor() {
    setDraft(tabs.map((t) => ({ ...t })));
    setError(null);
    setEditing(true);
  }

  function patchDraft(i: number, label: string) {
    setDraft((d) => d.map((t, j) => (j === i ? { ...t, label } : t)));
  }

  function addPage() {
    setDraft((d) => [...d, { slug: "", label: "", custom: true }]);
  }

  function removePage(i: number) {
    setDraft((d) => d.filter((_, j) => j !== i));
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    // Slug d'une nouvelle page custom dérivé de son libellé (stable ensuite —
    // les tuiles/tableaux de la page y sont accrochés).
    const items = draft
      .filter((t) => t.label.trim())
      .map((t) => (t.custom && !t.slug ? { ...t, slug: slugifyNavLabel(t.label) } : t));
    try {
      const res = await fetch("/api/page-nav", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nav_key: nav.navKey, items }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? "Enregistrement impossible.");
        return;
      }
      setTabs(mergeNavItems(nav, (d.items as PageNavItem[]) ?? items));
      setEditing(false);
      router.refresh();
    } catch {
      setError("Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-b border-card-border">
      <div className="flex items-center gap-1">
        {tabs.map((t) => {
          const href = navItemHref(nav, t);
          const isActive = pathname === href;
          return (
            <Link
              key={`${t.custom ? "c" : "s"}-${t.slug}`}
              href={href}
              className={`relative px-4 py-2 text-sm font-medium transition ${
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
          onClick={openEditor}
          title="Renommer les onglets ou ajouter une page"
          aria-label="Personnaliser les onglets"
          className="ml-auto rounded-md px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
        >
          ✎ Onglets
        </button>
      </div>

      {editing && (
        <div className="mb-3 mt-1 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <p className="text-xs font-semibold text-slate-700">Personnaliser les onglets</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Renomme les onglets, ou ajoute une page : elle aura ses propres tuiles KPI et tableaux, à composer
            comme sur les autres pages.
          </p>
          <div className="mt-3 space-y-2">
            {draft.map((t, i) => (
              <div key={`${t.custom ? "c" : "s"}-${t.slug}-${i}`} className="flex items-center gap-2">
                <input
                  value={t.label}
                  onChange={(e) => patchDraft(i, e.target.value)}
                  placeholder={t.custom ? "Nom de la nouvelle page" : undefined}
                  className="w-72 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-accent"
                />
                {t.custom ? (
                  <>
                    <span className="rounded-full bg-fuchsia-50 px-1.5 py-0.5 text-[9px] font-bold text-fuchsia-600">PAGE CUSTOM</span>
                    <button
                      type="button"
                      onClick={() => removePage(i)}
                      className="rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                    >
                      Supprimer
                    </button>
                  </>
                ) : (
                  <span className="text-[10px] text-slate-400">onglet standard — renommable</span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addPage}
              className="rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-3 py-1.5 text-xs font-semibold text-fuchsia-700 transition hover:bg-fuchsia-100"
            >
              ＋ Ajouter une page
            </button>
            <div className="ml-auto flex items-center gap-2">
              {error && <span className="text-xs text-rose-500">{error}</span>}
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
