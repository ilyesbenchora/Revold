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
export type GroupNode = { id: string; name: string; siren: string | null; ca: number; deals?: GroupDeal[] };
export type BigPictureGroup = { root: GroupNode; children: GroupNode[]; total: number };

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

/** Normalise pour la recherche : minuscules, sans accents. */
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function GroupBigPicture({ groups }: { groups: BigPictureGroup[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = norm(query.trim());
    if (!term) return groups;
    const digits = query.replace(/\D/g, ""); // SIREN/SIRET tapé avec espaces
    const matchNode = (n: GroupNode) =>
      norm(n.name).includes(term) ||
      (!!n.siren && (norm(n.siren).includes(term) || (digits.length > 0 && n.siren.includes(digits))));
    return groups.filter((g) => matchNode(g.root) || g.children.some(matchNode));
  }, [groups, query]);

  return (
    <div className="space-y-3">
      {/* ── Recherche par nom ou SIREN ── */}
      <div className="relative">
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

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
          Aucun groupe ne correspond à « {query.trim()} ».
        </p>
      ) : (
        filtered.map((g) => (
        <article key={g.root.id} className="rounded-xl border border-slate-200 bg-white p-3">
          {/* ── Tête de groupe (parent) ── */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-indigo-50 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-indigo-900">{g.root.name}</p>
              <p className="font-mono text-[10px] text-indigo-700">{g.root.siren ? `SIREN ${g.root.siren}` : "SIREN —"}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                {g.children.length} société{g.children.length > 1 ? "s" : ""} reliée{g.children.length > 1 ? "s" : ""}
              </span>
              {g.total > 0 && (
                <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  Groupe : {eur(g.total)}
                </span>
              )}
            </div>
          </div>

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
                  {/* Sans deal associé : aucune info de montant (pas même un tiret). */}
                  {c.ca > 0 && (
                    <span className="shrink-0 text-[11px] font-bold tabular-nums text-slate-700">{eur(c.ca)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </article>
        ))
      )}
    </div>
  );
}
