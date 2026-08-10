"use client";

import { useMemo, useState } from "react";
import {
  ACTION_TYPE_LABELS,
  type CoachingActionType,
  type UnifiedCoaching,
} from "@/lib/reports/coaching-types";

/**
 * Actions de coaching proposées PAR LE COACH (depuis son chat, onglet Actions,
 * ou activées depuis un rapport) — uniquement la source « manual ».
 * Volontairement compact et placé en bas de page : le cœur de la page reste le
 * coaching en direct ; ici, l'utilisateur choisit lui-même quel coaching faire
 * (pas de hiérarchie critique/vigilance/info imposée).
 */

const STATUS_STYLE: Record<NonNullable<UnifiedCoaching["status"]>, { label: string; cls: string }> = {
  active: { label: "Actif", cls: "bg-emerald-100 text-emerald-700" },
  done: { label: "Réalisé", cls: "bg-blue-100 text-blue-700" },
  removed: { label: "Retiré", cls: "bg-slate-200 text-slate-600" },
};

const CAT_AGENT: Record<string, string> = {
  commercial: "coaching-ventes",
  marketing: "coaching-marketing",
  data: "coaching-data",
  // Sofia (Coach Data & Intégration) a repris le périmètre intégration.
  integration: "coaching-data",
  "data-model": "coaching-data-model",
};

function CoachActionCard({ item, category }: { item: UnifiedCoaching; category: string }) {
  const statusInfo = STATUS_STYLE[item.status ?? "active"];
  const agentKey = CAT_AGENT[category] ?? "coaching-ventes";
  const ctx = item.reportCoachingId
    ? `rc=${encodeURIComponent(item.reportCoachingId)}`
    : `bt=${encodeURIComponent(item.title)}&bp=${encodeURIComponent(item.recommendation || item.body || "")}`;
  const coachHref = `/dashboard/agents/${agentKey}?${ctx}`;

  return (
    <article className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-3.5 transition hover:border-fuchsia-200">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
          {ACTION_TYPE_LABELS[item.actionType]}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusInfo.cls}`}>{statusInfo.label}</span>
        {item.kpiLabel && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">KPI : {item.kpiLabel}</span>
        )}
      </div>

      <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900">{item.title}</h3>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{item.recommendation || item.body}</p>
      {item.sourceReportTitle && (
        <p className="mt-1 truncate text-[10px] text-slate-400">issu de « {item.sourceReportTitle} »</p>
      )}

      <div className="mt-auto pt-2.5">
        <a href={coachHref} className="inline-flex items-center gap-1 text-xs font-semibold text-fuchsia-600 transition hover:text-fuchsia-700">
          Démarrer ce coaching
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
        </a>
      </div>
    </article>
  );
}

export function CoachActionsSection({
  items,
  categoryLabel,
  category,
}: {
  /** Coachings proposés par le coach (source « manual » uniquement). */
  items: UnifiedCoaching[];
  categoryLabel: string;
  category: string;
}) {
  const [actionFilter, setActionFilter] = useState<CoachingActionType | "all">("all");

  const availableActionTypes = useMemo(() => {
    const set = new Set<CoachingActionType>();
    for (const i of items) set.add(i.actionType);
    return [...set];
  }, [items]);

  const filtered = actionFilter === "all" ? items : items.filter((i) => i.actionType === actionFilter);

  return (
    <section className="space-y-2.5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">
          Actions proposées par ton coach
          {items.length > 0 && <span className="ml-1.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent">{items.length}</span>}
        </h2>
        <p className="mt-0.5 text-xs text-slate-400">
          Proposées pendant tes séances (onglet Actions du chat) ou activées depuis tes rapports — à toi de choisir lesquelles faire.
        </p>
      </div>

      {availableActionTypes.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActionFilter("all")}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
              actionFilter === "all" ? "bg-accent text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Tous ({items.length})
          </button>
          {availableActionTypes.map((at) => (
            <button
              key={at}
              type="button"
              onClick={() => setActionFilter(at)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
                actionFilter === at ? "bg-accent text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {ACTION_TYPE_LABELS[at]} ({items.filter((i) => i.actionType === at).length})
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center">
          <p className="text-xs text-slate-500">
            Aucune action de coaching pour {categoryLabel} pour l&apos;instant — ton coach t&apos;en proposera pendant vos séances (onglet Actions du chat).
          </p>
        </div>
      ) : (
        <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1.5 scroll-smooth">
          {filtered.map((c) => (
            <div key={c.id} className="snap-start shrink-0" style={{ width: "min(300px, 85vw)" }}>
              <CoachActionCard item={c} category={category} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
