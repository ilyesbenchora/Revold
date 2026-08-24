"use client";

/**
 * SECTIONS DE PAGE (façon Notion) — bouton flottant discret + en-têtes nommés.
 *
 * Monté une fois DANS le conteneur de la page (dernier enfant du <section>
 * racine). Il :
 *  - affiche un « ＋ » flottant FIXE (reste visible au scroll) ; un clic crée
 *    une section À L'ENDROIT où on se trouve dans la page (le bloc de haut
 *    niveau le plus proche du haut de l'écran) et ouvre la saisie du nom ;
 *  - injecte les en-têtes de section (titre) AVANT le bloc d'ancrage, parmi les
 *    blocs existants — les rapports en dessous « appartiennent » visuellement à
 *    la section ;
 *  - en mode « Personnaliser les KPIs » (usePageEditMode), les titres — y
 *    compris ceux déjà créés — sont renommables et supprimables.
 *
 * Persistance : table page_sections (anchor = index du bloc top-level cible).
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePageEditMode } from "./page-edit-mode";

type Section = { id: string; title: string; anchor: number };

/** Bloc top-level considéré « sous le pli » (sous l'en-tête collant). */
const SCROLL_THRESHOLD = 140;

export function PageSections({ pageKey }: { pageKey: string }) {
  const markerRef = useRef<HTMLDivElement | null>(null);
  const editing = usePageEditMode();
  const [sections, setSections] = useState<Section[]>([]);
  const [ready, setReady] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hostsRef = useRef<Map<string, HTMLElement>>(new Map());
  const arrangingRef = useRef(false);
  const [, force] = useState(0);

  // ── Chargement des sections de la page ──
  useEffect(() => {
    let alive = true;
    fetch(`/api/page-sections?page_key=${encodeURIComponent(pageKey)}`)
      .then((r) => (r.ok ? r.json() : { sections: [] }))
      .then((d) => { if (alive) { setSections(Array.isArray(d.sections) ? d.sections : []); setReady(true); } })
      .catch(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [pageKey]);

  // Blocs de haut niveau réels de la page (hors marqueur + hôtes de section).
  const realBlocks = useCallback((): HTMLElement[] => {
    const container = markerRef.current?.parentElement;
    if (!container) return [];
    return (Array.from(container.children) as HTMLElement[]).filter(
      (c) => c !== markerRef.current && !c.dataset.pageSectionHost,
    );
  }, []);

  // Place chaque hôte d'en-tête AVANT son bloc d'ancrage (idempotent).
  const arrange = useCallback(() => {
    const container = markerRef.current?.parentElement;
    if (!container) return;
    arrangingRef.current = true;
    const blocks = realBlocks();
    const seen = new Set<string>();
    for (const s of [...sections].sort((a, b) => a.anchor - b.anchor)) {
      seen.add(s.id);
      let host = hostsRef.current.get(s.id);
      if (!host) {
        host = document.createElement("div");
        host.dataset.pageSectionHost = s.id;
        hostsRef.current.set(s.id, host);
      }
      const target = blocks[Math.min(s.anchor, blocks.length)] ?? null;
      if (target) {
        if (host.nextSibling !== target || host.parentElement !== container) container.insertBefore(host, target);
      } else if (container.lastElementChild !== host) {
        container.appendChild(host);
      }
    }
    for (const [id, host] of hostsRef.current) {
      if (!seen.has(id)) { host.remove(); hostsRef.current.delete(id); }
    }
    force((n) => n + 1);
    // Les mutations ci-dessus sont synchrones ; l'observer se déclenche en
    // microtâche → on lève le drapeau juste après pour ignorer notre propre bruit.
    setTimeout(() => { arrangingRef.current = false; }, 0);
  }, [sections, realBlocks]);

  useLayoutEffect(() => { if (ready) arrange(); }, [arrange, ready]);

  // Recalcule quand le contenu de la page change (blocs async, tables ajoutées).
  useEffect(() => {
    const container = markerRef.current?.parentElement;
    if (!container) return;
    const obs = new MutationObserver(() => { if (!arrangingRef.current) arrange(); });
    obs.observe(container, { childList: true });
    const onReload = () => arrange();
    window.addEventListener("revold:reload-page-tables", onReload);
    return () => { obs.disconnect(); window.removeEventListener("revold:reload-page-tables", onReload); };
  }, [arrange]);

  // Nettoyage à l'unmount : retire les hôtes injectés.
  useEffect(() => () => {
    for (const [, host] of hostsRef.current) host.remove();
    hostsRef.current.clear();
  }, []);

  // ── Ajouter une section À L'ENDROIT du scroll ──
  async function addHere() {
    if (busy) return;
    const blocks = realBlocks();
    let anchor = blocks.length; // par défaut : en bas
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].getBoundingClientRect().top >= SCROLL_THRESHOLD) { anchor = i; break; }
    }
    setBusy(true);
    try {
      const res = await fetch("/api/page-sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_key: pageKey, anchor }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.section) {
        setSections((p) => [...p, d.section as Section]);
        setEditId(d.section.id); // saisie du nom immédiate
      }
    } finally {
      setBusy(false);
    }
  }

  async function rename(id: string, title: string) {
    const clean = title.trim();
    setEditId(null);
    setSections((p) => p.map((s) => (s.id === id ? { ...s, title: clean || "Nouvelle section" } : s)));
    await fetch(`/api/page-sections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: clean }),
    }).catch(() => {});
  }

  async function remove(id: string) {
    setSections((p) => p.filter((s) => s.id !== id));
    await fetch(`/api/page-sections/${id}`, { method: "DELETE" }).catch(() => {});
  }

  // En-tête inliné (PAS un composant imbriqué : éviter le remount à chaque
  // `force`, qui volerait le focus de l'input d'édition).
  const renderHeader = (s: Section) => {
    const isEdit = editId === s.id;
    return (
      <div className="flex items-center gap-2 pt-3">
        <span className="h-5 w-1 shrink-0 rounded-full bg-accent/60" />
        {isEdit ? (
          <input
            autoFocus
            defaultValue={s.title === "Nouvelle section" ? "" : s.title}
            placeholder="Nom de la section (ex. Marges)"
            onBlur={(e) => rename(s.id, e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") { setEditId(null); force((n) => n + 1); }
            }}
            className="min-w-0 flex-1 border-b border-accent/40 bg-transparent text-lg font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-300"
          />
        ) : (
          <h2 className="text-lg font-semibold text-slate-900">{s.title}</h2>
        )}
        {editing && !isEdit && (
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setEditId(s.id)}
              title="Renommer la section"
              className="rounded-md px-1.5 py-0.5 text-xs text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              ✎
            </button>
            <button
              type="button"
              onClick={() => remove(s.id)}
              title="Supprimer la section"
              className="rounded-md px-1.5 py-0.5 text-xs text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
            >
              ✕
            </button>
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      <div ref={markerRef} className="hidden" data-page-sections-marker />

      {/* Bouton flottant DISCRET, fixe au scroll (bord droit, centré) : ajoute
          une section à l'endroit où on se trouve dans la page. */}
      <button
        type="button"
        onClick={addHere}
        disabled={busy}
        aria-label="Ajouter une section à cet endroit"
        title="Ajouter une section à cet endroit"
        className="fixed right-3 top-1/2 z-40 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/85 text-slate-400 shadow-sm backdrop-blur transition hover:border-accent hover:text-accent hover:shadow disabled:opacity-40"
      >
        <span className="text-lg leading-none">＋</span>
      </button>

      {ready &&
        sections.map((s) => {
          const host = hostsRef.current.get(s.id);
          return host ? createPortal(renderHeader(s), host, s.id) : null;
        })}
    </>
  );
}
