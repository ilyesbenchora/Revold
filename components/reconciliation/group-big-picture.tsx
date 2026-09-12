/**
 * Vue « BIG PICTURE » des groupes déclarés — reprise de la visualisation de la
 * capture marketing (page Résolution d'entités) : la holding en bandeau
 * indigo (nom, SIREN, nombre de sociétés reliées, montant consolidé du
 * groupe), les filiales indentées sous une ligne de filiation avec leur SIREN
 * et le montant de leurs DEALS ASSOCIÉS. Sans deal rattaché à une entité,
 * aucune information de montant n'est affichée ; dès qu'une ou plusieurs
 * associations existent, les montants des filiales se CUMULENT sur la mère.
 */

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

export function GroupBigPicture({ groups }: { groups: BigPictureGroup[] }) {
  return (
    <div className="space-y-3">
      {groups.map((g) => (
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
      ))}
    </div>
  );
}
