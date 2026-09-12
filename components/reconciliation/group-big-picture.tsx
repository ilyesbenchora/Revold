/**
 * Vue « BIG PICTURE » des groupes déclarés — reprise de la visualisation de la
 * capture marketing (page Résolution d'entités) : la holding en bandeau
 * indigo (nom, SIREN, nombre de sociétés reliées, CA consolidé du groupe),
 * les filiales indentées sous une ligne de filiation avec leur SIREN et leur
 * CA signé. Remplace l'ancienne liste à plat des groupes déclarés.
 */

export type GroupNode = { id: string; name: string; siren: string | null; ca: number };
export type BigPictureGroup = { root: GroupNode; children: GroupNode[]; total: number };

const eur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Math.round(v));

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

          {/* ── Filiales (ligne de filiation) ── */}
          <div className="mt-2 space-y-1.5 pl-4">
            {g.children.map((c) => (
              <div key={c.id} className="flex items-center gap-2 border-l-2 border-slate-200 pl-3">
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-slate-800">{c.name}</p>
                    <p className="font-mono text-[10px] text-slate-500">{c.siren ? `SIREN ${c.siren}` : "SIREN —"}</p>
                  </div>
                  <span className="shrink-0 text-[11px] font-bold tabular-nums text-slate-700">
                    {c.ca > 0 ? eur(c.ca) : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
