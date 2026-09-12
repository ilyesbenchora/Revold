"use client";

/**
 * Vue « BIG PICTURE » des groupes déclarés — reprise de la visualisation de la
 * capture marketing (page Résolution d'entités) : la holding en bandeau
 * indigo (nom, SIREN, nombre de sociétés reliées, montant consolidé du
 * groupe), les filiales indentées sous une ligne de filiation avec leur SIREN
 * et le montant de leurs DEALS ASSOCIÉS. Sans deal rattaché à une entité,
 * aucune information de montant n'est affichée ; dès qu'une ou plusieurs
 * associations existent, les montants des filiales se CUMULENT sur la mère.
 *
 * Barre de recherche (nom ou SIREN) : indispensable dès qu'il y a des dizaines
 * ou des centaines de groupes — filtre sur la mère ET les filiales.
 */

import { useMemo, useState } from "react";

export type GroupDeal = { name: string | null; amount: number; stage: string | null; pipeline: string | null };
export type GroupNode = {
  id: string;
  name: string;
  siren: string | null;
  ca: number;
  deals?: GroupDeal[];
  /** Tags de hiérarchie (Paramètres → Enrichissement) : clé de tag → valeur CRM. */
  tags?: Record<string, string>;
};
export type BigPictureGroup = { root: GroupNode; children: GroupNode[]; total: number };
/** Définition d'un tag câblé (propriété CRM personnalisée des fiches Entreprise). */
export type GroupTagDef = { key: string; label: string };

const eur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Math.round(v));

/** Lignes « pipeline · étape — montant » des deals associés (3 max + reste). */
function DealLines({ deals }: { deals: GroupDeal[] }) {
  if (deals.length === 0) return null;
  const shown = deals.slice(0, 3);
  return (
    <div className="mt-1 space-y-0.5">
      {shown.map((d, i) => (
        <p key={i} className="truncate text-[9px] text-slate-400">
          <span className="font-medium text-slate-500">{d.pipeline ?? "Pipeline —"}</span>
          {" · "}
          {d.stage ?? "étape —"}
          {" — "}
          <span className="tabular-nums font-semibold text-slate-500">{eur(d.amount)}</span>
        </p>
      ))}
      {deals.length > shown.length && (
        <p className="text-[9px] text-slate-300">+ {deals.length - shown.length} autre{deals.length - shown.length > 1 ? "s" : ""} deal{deals.length - shown.length > 1 ? "s" : ""}</p>
      )}
    </div>
  );
}

/** Tags de hiérarchie d'une entité — affichés À CÔTÉ des montants pour
 *  hiérarchiser les comptes sur la donnée CRM personnalisée. */
function TagBadges({ node, defs, dark = false }: { node: GroupNode; defs: GroupTagDef[]; dark?: boolean }) {
  const entries = defs.map((d) => ({ label: d.label, v: node.tags?.[d.key] })).filter((e): e is { label: string; v: string } => !!e.v);
  if (entries.length === 0) return null;
  return (
    <>
      {entries.map((e) => (
        <span
          key={e.label}
          title={e.label}
          className={
            dark
              ? "rounded-md bg-white/25 px-1.5 py-0.5 text-[9px] font-semibold text-white"
              : "rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600"
          }
        >
          {e.v}
        </span>
      ))}
    </>
  );
}

/** Normalise pour la recherche : minuscules, sans accents. */
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function GroupBigPicture({ groups, tagDefs = [] }: { groups: BigPictureGroup[]; tagDefs?: GroupTagDef[] }) {
  const [query, setQuery] = useState("");
  // Groupes repliés (par id de la mère) — repli/dépli depuis l'entité groupe.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // Filtres par TAG de hiérarchie (Paramètres → Enrichissement) : "" = tous.
  const [tagFilters, setTagFilters] = useState<Record<string, string>>({});

  // Valeurs distinctes de chaque tag sur les groupes affichés (mère + filiales).
  const tagOptions = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const def of tagDefs) {
      const vals = new Set<string>();
      for (const g of groups) for (const n of [g.root, ...g.children]) {
        const v = n.tags?.[def.key];
        if (v) vals.add(v);
      }
      out[def.key] = [...vals].sort((a, b) => a.localeCompare(b, "fr"));
    }
    return out;
  }, [groups, tagDefs]);

  const filtered = useMemo(() => {
    const term = norm(query.trim());
    const digits = query.replace(/\D/g, ""); // SIREN/SIRET tapé avec espaces
    const activeTags = Object.entries(tagFilters).filter(([, v]) => v);
    const matchNode = (n: GroupNode) =>
      norm(n.name).includes(term) ||
      (!!n.siren && (norm(n.siren).includes(term) || (digits.length > 0 && n.siren.includes(digits))));
    // Tag actif : le groupe reste si la mère OU une filiale porte la valeur.
    const matchTags = (g: BigPictureGroup) =>
      activeTags.every(([k, v]) => [g.root, ...g.children].some((n) => n.tags?.[k] === v));
    return groups.filter((g) => (!term || matchNode(g.root) || g.children.some(matchNode)) && matchTags(g));
  }, [groups, query, tagFilters]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // « Tout réduire » tant qu'au moins un groupe visible est déplié ; sinon « Tout déplier ».
  const allCollapsed = filtered.length > 0 && filtered.every((g) => collapsed.has(g.root.id));
  const toggleAll = () =>
    setCollapsed(allCollapsed ? new Set() : new Set(filtered.map((g) => g.root.id)));

  return (
    <div className="space-y-3">
      {/* ── Recherche par nom ou SIREN + repli global ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un groupe par nom d'entreprise ou SIREN…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-accent"
          />
          {query.trim() && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
              {filtered.length} / {groups.length}
            </span>
          )}
        </div>
        {filtered.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
          >
            {allCollapsed ? "Tout déplier" : "Tout réduire"}
          </button>
        )}
      </div>

      {/* ── Filtres par tag de hiérarchie (propriétés CRM câblées dans
             Paramètres → Enrichissement) — un sélecteur par tag. ── */}
      {tagDefs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {tagDefs.map((def) => (
            <label key={def.key} className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
              {def.label}
              <select
                value={tagFilters[def.key] ?? ""}
                onChange={(e) => setTagFilters((prev) => ({ ...prev, [def.key]: e.target.value }))}
                className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[11px] font-medium text-slate-600 outline-none focus:border-accent"
              >
                <option value="">Tous</option>
                {(tagOptions[def.key] ?? []).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>
          ))}
          {Object.values(tagFilters).some(Boolean) && (
            <button
              type="button"
              onClick={() => setTagFilters({})}
              className="text-[11px] font-medium text-slate-400 underline decoration-dotted underline-offset-2 hover:text-slate-600"
            >
              Réinitialiser
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
          Aucun groupe ne correspond à « {query.trim()} ».
        </p>
      ) : (
        filtered.map((g) => {
        const isCollapsed = collapsed.has(g.root.id);
        return (
        <article key={g.root.id} className="rounded-xl border border-slate-200 bg-white p-3">
          {/* ── Tête de groupe (parent) — clic = replier/déplier le groupe ── */}
          <button
            type="button"
            onClick={() => toggle(g.root.id)}
            aria-expanded={!isCollapsed}
            className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-left transition hover:bg-indigo-100/70"
          >
            <div className="flex min-w-0 items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className={`shrink-0 text-indigo-500 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{g.root.name}</p>
                <p className="font-mono text-[10px] text-indigo-700">{g.root.siren ? `SIREN ${g.root.siren}` : "SIREN —"}</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <TagBadges node={g.root} defs={tagDefs} dark />
              <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                {g.children.length} société{g.children.length > 1 ? "s" : ""} reliée{g.children.length > 1 ? "s" : ""}
              </span>
              {g.total > 0 && (
                <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  Groupe : {eur(g.total)}
                </span>
              )}
            </div>
          </button>

          {!isCollapsed && (
            <>
          {/* Deals associés à la société MÈRE elle-même (étape + pipeline). */}
          {(g.root.deals?.length ?? 0) > 0 && (
            <div className="mt-1.5 rounded-lg bg-indigo-50/50 px-3 py-1.5">
              <DealLines deals={g.root.deals!} />
            </div>
          )}

          {/* ── Filiales (ligne de filiation) ── */}
          <div className="mt-2 space-y-1.5 pl-4">
            {g.children.map((c) => (
              <div key={c.id} className="flex items-center gap-2 border-l-2 border-slate-200 pl-3">
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-slate-800">{c.name}</p>
                    <p className="font-mono text-[10px] text-slate-500">{c.siren ? `SIREN ${c.siren}` : "SIREN —"}</p>
                    {/* Étape + pipeline de chaque deal associé (aucune ligne sans deal). */}
                    <DealLines deals={c.deals ?? []} />
                  </div>
                  {/* Sans deal associé : aucune info de montant (pas même un tiret) —
                      les tags de hiérarchie, eux, s'affichent dès qu'ils existent. */}
                  <span className="flex shrink-0 items-center gap-1.5">
                    <TagBadges node={c} defs={tagDefs} />
                    {c.ca > 0 && (
                      <span className="text-[11px] font-bold tabular-nums text-slate-700">{eur(c.ca)}</span>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
            </>
          )}
        </article>
        );
        })
      )}
    </div>
  );
}
