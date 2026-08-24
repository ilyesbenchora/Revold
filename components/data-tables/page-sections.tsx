"use client";

/**
 * SECTIONS DE PAGE (façon Notion) — bouton flottant discret + en-têtes nommés,
 * ET renommage des titres de sections DÉJÀ EN PLACE.
 *
 * Monté une fois DANS le conteneur de la page (dernier enfant du <section>
 * racine). Il :
 *  - affiche un « ＋ » flottant FIXE (reste visible au scroll) ; un clic crée
 *    une section À L'ENDROIT du scroll (bloc de haut niveau le plus proche du
 *    haut de l'écran) et ouvre la saisie du nom ;
 *  - injecte ces en-têtes AVANT le bloc d'ancrage, parmi les blocs existants ;
 *  - en mode « Personnaliser les KPIs » (usePageEditMode), rend renommables /
 *    supprimables les sections ajoutées ET renommables les titres CODÉS EN DUR
 *    (Marge, CA…) : un ✎ à côté du titre, override persisté par clé stable
 *    dérivée du libellé d'origine (aucun câblage par page requis).
 *
 * Persistance : table page_sections. Ligne section_key NULL = section ajoutée
 * (anchor). Ligne section_key non nul = override de titre existant.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePageEditMode } from "./page-edit-mode";

type Section = { id: string; title: string; anchor: number };
type Override = { id: string; title: string };
type Row = { id: string; title: string; anchor: number; section_key?: string | null };

const SCROLL_THRESHOLD = 140;

/** Clé stable d'un titre existant : minuscules, sans accents, alphanum → « - ». */
const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);

/** Premier nœud texte non vide d'un élément (le libellé, avant les badges). */
function leadingTextNode(el: Element): Text | null {
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === Node.TEXT_NODE && (n.nodeValue ?? "").trim()) return n as Text;
  }
  return null;
}

export function PageSections({ pageKey }: { pageKey: string }) {
  const markerRef = useRef<HTMLDivElement | null>(null);
  const editing = usePageEditMode();
  const [added, setAdded] = useState<Section[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [ready, setReady] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [titleBtns, setTitleBtns] = useState<Array<{ key: string; def: string }>>([]);
  const [titleEdit, setTitleEdit] = useState<{ key: string; def: string; value: string; top: number; left: number; width: number } | null>(null);

  const hostsRef = useRef<Map<string, HTMLElement>>(new Map()); // en-têtes ajoutés
  const btnHostsRef = useRef<Map<string, HTMLElement>>(new Map()); // ✎ des titres existants
  const arrangingRef = useRef(false);
  const [, force] = useState(0);

  // ── Chargement ──
  useEffect(() => {
    let alive = true;
    fetch(`/api/page-sections?page_key=${encodeURIComponent(pageKey)}`)
      .then((r) => (r.ok ? r.json() : { sections: [] }))
      .then((d) => {
        if (!alive) return;
        const rows: Row[] = Array.isArray(d.sections) ? d.sections : [];
        setAdded(rows.filter((r) => !r.section_key).map((r) => ({ id: r.id, title: r.title, anchor: r.anchor })));
        const ov: Record<string, Override> = {};
        for (const r of rows) if (r.section_key) ov[r.section_key] = { id: r.id, title: r.title };
        setOverrides(ov);
        setReady(true);
      })
      .catch(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [pageKey]);

  const realBlocks = useCallback((): HTMLElement[] => {
    const container = markerRef.current?.parentElement;
    if (!container) return [];
    return (Array.from(container.children) as HTMLElement[]).filter(
      (c) => c !== markerRef.current && !c.dataset.pageSectionHost,
    );
  }, []);

  // Place les en-têtes AJOUTÉS avant leur bloc d'ancrage (idempotent).
  const arrange = useCallback(() => {
    const container = markerRef.current?.parentElement;
    if (!container) return;
    arrangingRef.current = true;
    const blocks = realBlocks();
    const seen = new Set<string>();
    for (const s of [...added].sort((a, b) => a.anchor - b.anchor)) {
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
    setTimeout(() => { arrangingRef.current = false; }, 0);
  }, [added, realBlocks]);

  // Applique les overrides de titre + prépare les ✎ (en mode édition).
  const applyTitles = useCallback(() => {
    const list: Array<{ key: string; def: string }> = [];
    const seen = new Set<string>();
    for (const block of realBlocks()) {
      const h2 = block.querySelector("h2");
      if (!h2) continue;
      const tn = leadingTextNode(h2);
      if (!tn) continue;
      if (!h2.dataset.secRaw) h2.dataset.secRaw = tn.nodeValue ?? "";
      const raw = h2.dataset.secRaw;
      const def = raw.trim();
      if (!def) continue;
      const key = slug(def);
      h2.dataset.secKey = key;
      const trailing = raw.match(/\s+$/)?.[0] ?? "";
      const desired = (overrides[key]?.title ?? def) + trailing;
      if (tn.nodeValue !== desired) tn.nodeValue = desired;

      if (editing && !seen.has(key)) {
        seen.add(key);
        list.push({ key, def });
        let host = btnHostsRef.current.get(key);
        if (!host) {
          host = document.createElement("span");
          host.dataset.secBtnHost = key;
          btnHostsRef.current.set(key, host);
        }
        if (host.parentElement !== h2) h2.appendChild(host);
      }
    }
    // Retire les ✎ obsolètes (hors édition ou titres disparus).
    for (const [key, host] of btnHostsRef.current) {
      if (!editing || !seen.has(key)) { host.remove(); btnHostsRef.current.delete(key); }
    }
    setTitleBtns(list);
  }, [overrides, editing, realBlocks]);

  const syncAll = useCallback(() => { arrange(); applyTitles(); }, [arrange, applyTitles]);

  useLayoutEffect(() => { if (ready) syncAll(); }, [ready, syncAll]);

  useEffect(() => {
    const container = markerRef.current?.parentElement;
    if (!container) return;
    const obs = new MutationObserver(() => { if (!arrangingRef.current) syncAll(); });
    obs.observe(container, { childList: true });
    const onReload = () => syncAll();
    window.addEventListener("revold:reload-page-tables", onReload);
    return () => { obs.disconnect(); window.removeEventListener("revold:reload-page-tables", onReload); };
  }, [syncAll]);

  useEffect(() => () => {
    for (const [, host] of hostsRef.current) host.remove();
    for (const [, host] of btnHostsRef.current) host.remove();
    hostsRef.current.clear();
    btnHostsRef.current.clear();
  }, []);

  // ── Ajouter une section à l'endroit du scroll ──
  async function addHere() {
    if (busy) return;
    const blocks = realBlocks();
    let anchor = blocks.length;
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
      if (res.ok && d.section) { setAdded((p) => [...p, d.section as Section]); setEditId(d.section.id); }
    } finally {
      setBusy(false);
    }
  }

  async function renameAdded(id: string, title: string) {
    const clean = title.trim();
    setEditId(null);
    setAdded((p) => p.map((s) => (s.id === id ? { ...s, title: clean || "Nouvelle section" } : s)));
    await fetch(`/api/page-sections/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: clean }),
    }).catch(() => {});
  }

  async function removeAdded(id: string) {
    setAdded((p) => p.filter((s) => s.id !== id));
    await fetch(`/api/page-sections/${id}`, { method: "DELETE" }).catch(() => {});
  }

  // ── Override d'un titre existant ──
  function openTitleEdit(key: string, def: string) {
    const h2 = markerRef.current?.parentElement?.querySelector<HTMLElement>(`h2[data-sec-key="${key}"]`);
    const rect = h2?.getBoundingClientRect();
    setTitleEdit({
      key, def,
      value: overrides[key]?.title ?? def,
      top: (rect ? rect.bottom : 120) + 6,
      left: rect ? rect.left : 24,
      width: Math.min(rect ? rect.width : 260, 340),
    });
  }

  async function saveTitle() {
    if (!titleEdit) return;
    const { key, def, value } = titleEdit;
    const clean = value.trim();
    setTitleEdit(null);
    // Vide ou identique au défaut → réinitialise (supprime l'override).
    if (!clean || clean === def) {
      const existing = overrides[key];
      setOverrides((p) => { const n = { ...p }; delete n[key]; return n; });
      if (existing?.id) await fetch(`/api/page-sections/${existing.id}`, { method: "DELETE" }).catch(() => {});
      return;
    }
    setOverrides((p) => ({ ...p, [key]: { id: p[key]?.id ?? "tmp", title: clean } }));
    try {
      const res = await fetch("/api/page-sections", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_key: pageKey, section_key: key, title: clean }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.section) setOverrides((p) => ({ ...p, [key]: { id: d.section.id, title: d.section.title } }));
    } catch { /* optimiste : le titre reste appliqué localement */ }
  }

  const renderAddedHeader = (s: Section) => {
    const isEdit = editId === s.id;
    return (
      <div className="flex items-center gap-2">
        {isEdit ? (
          <input
            autoFocus
            defaultValue={s.title === "Nouvelle section" ? "" : s.title}
            placeholder="Nom de la section (ex. Marges)"
            onBlur={(e) => renameAdded(s.id, e.currentTarget.value)}
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
            <button type="button" onClick={() => setEditId(s.id)} title="Renommer la section" className="rounded-md px-1.5 py-0.5 text-xs text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">✎</button>
            <button type="button" onClick={() => removeAdded(s.id)} title="Supprimer la section" className="rounded-md px-1.5 py-0.5 text-xs text-slate-400 transition hover:bg-rose-50 hover:text-rose-500">✕</button>
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      <div ref={markerRef} className="hidden" data-page-sections-marker />

      {/* Bouton flottant DISCRET, fixe au scroll (bord droit, centré). */}
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

      {/* En-têtes de section AJOUTÉS (portails dans les hôtes injectés). */}
      {ready && added.map((s) => {
        const host = hostsRef.current.get(s.id);
        return host ? createPortal(renderAddedHeader(s), host, s.id) : null;
      })}

      {/* ✎ des titres EXISTANTS (mode édition). */}
      {editing && titleBtns.map(({ key, def }) => {
        const host = btnHostsRef.current.get(key);
        return host
          ? createPortal(
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); openTitleEdit(key, def); }}
                title="Renommer cette section"
                className="ml-1 rounded-md px-1.5 py-0.5 text-xs font-normal text-slate-300 transition hover:bg-slate-100 hover:text-slate-600"
              >
                ✎
              </button>,
              host, key,
            )
          : null;
      })}

      {/* Popover de renommage d'un titre existant. */}
      {titleEdit && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setTitleEdit(null)} />
          <div className="fixed z-50 rounded-xl border border-slate-200 bg-white p-3 shadow-lg" style={{ top: titleEdit.top, left: titleEdit.left, width: titleEdit.width }}>
            <input
              autoFocus
              value={titleEdit.value}
              placeholder={titleEdit.def}
              onChange={(e) => setTitleEdit((t) => (t ? { ...t, value: e.target.value } : t))}
              onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setTitleEdit(null); }}
              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-accent"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <button type="button" onClick={() => setTitleEdit((t) => (t ? { ...t, value: "" } : t))} className="text-[11px] text-slate-400 transition hover:text-slate-600">Par défaut</button>
              <button type="button" onClick={saveTitle} className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-500">Enregistrer</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
