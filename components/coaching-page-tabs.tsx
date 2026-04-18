"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ACTION_TYPE_LABELS,
  type CoachingActionType,
  type UnifiedCoaching,
} from "@/lib/reports/coaching-types";

type TabId = "mine" | "critical" | "warning" | "info";

const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: "mine", label: "Mes coachings IA", emoji: "✨" },
  { id: "critical", label: "Critiques", emoji: "🔴" },
  { id: "warning", label: "Vigilance", emoji: "🟠" },
  { id: "info", label: "Infos", emoji: "🔵" },
];

const SEV_STYLE: Record<UnifiedCoaching["severity"], { bg: string; border: string; badge: string; label: string }> = {
  critical: { bg: "bg-red-50", border: "border-red-200", badge: "bg-red-100 text-red-700", label: "Critique" },
  warning: { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-100 text-amber-700", label: "Vigilance" },
  info: { bg: "bg-indigo-50", border: "border-indigo-200", badge: "bg-indigo-100 text-indigo-700", label: "Info" },
};

const STATUS_STYLE: Record<NonNullable<UnifiedCoaching["status"]>, { label: string; cls: string }> = {
  active: { label: "Actif", cls: "bg-emerald-100 text-emerald-700" },
  done: { label: "Réalisé", cls: "bg-blue-100 text-blue-700" },
  removed: { label: "Retiré", cls: "bg-slate-200 text-slate-600" },
};

type Props = {
  /** ensemble des coachings de la page (tous status, toutes sources) */
  allItems: UnifiedCoaching[];
  /** label catégorie pour les phrases (ex: "ventes", "marketing") */
  categoryLabel: string;
};

export function CoachingPageTabs({ allItems, categoryLabel }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("mine");
  const [actionFilter, setActionFilter] = useState<CoachingActionType | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Items affichables selon l'onglet courant
  const tabItems = useMemo(() => {
    if (tab === "mine") return allItems.filter((i) => i.source === "manual");
    return allItems.filter((i) => i.severity === tab && (i.status ?? "active") === "active");
  }, [allItems, tab]);

  // Action types présents dans l'onglet courant (pour les chips)
  const availableActionTypes = useMemo(() => {
    const set = new Set<CoachingActionType>();
    for (const i of tabItems) set.add(i.actionType);
    return [...set];
  }, [tabItems]);

  const filteredItems = useMemo(
    () => (actionFilter === "all" ? tabItems : tabItems.filter((i) => i.actionType === actionFilter)),
    [tabItems, actionFilter],
  );

  // Compteurs pour les onglets
  const counts = useMemo(() => {
    const mine = allItems.filter((i) => i.source === "manual").length;
    const crit = allItems.filter((i) => i.severity === "critical" && (i.status ?? "active") === "active").length;
    const warn = allItems.filter((i) => i.severity === "warning" && (i.status ?? "active") === "active").length;
    const info = allItems.filter((i) => i.severity === "info" && (i.status ?? "active") === "active").length;
    return { mine, critical: crit, warning: warn, info };
  }, [allItems]);

  async function patchManual(id: string, status: "active" | "done" | "removed") {
    if (busyId) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/reports/coachings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  function onTabChange(t: TabId) {
    setTab(t);
    setActionFilter("all");
  }

  return (
    <div className="space-y-4">
      {/* Onglets */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 overflow-x-auto">
        {TABS.map((t) => {
          const active = tab === t.id;
          const count = counts[t.id];
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={`flex-1 min-w-fit rounded-md px-3 py-1.5 text-xs font-medium transition flex items-center justify-center gap-2 ${
                active ? "bg-white text-accent shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span aria-hidden>{t.emoji}</span>
              <span>{t.label}</span>
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                  active ? "bg-accent text-white" : "bg-accent/15 text-accent"
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Chips filtre par type d'action */}
      {availableActionTypes.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 mr-1">
            Type d&apos;action :
          </span>
          <button
            type="button"
            onClick={() => setActionFilter("all")}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
              actionFilter === "all"
                ? "bg-accent text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Tous ({tabItems.length})
          </button>
          {availableActionTypes.map((at) => {
            const selected = actionFilter === at;
            const cnt = tabItems.filter((i) => i.actionType === at).length;
            return (
              <button
                key={at}
                type="button"
                onClick={() => setActionFilter(at)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                  selected ? "bg-accent text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {ACTION_TYPE_LABELS[at]} ({cnt})
              </button>
            );
          })}
        </div>
      )}

      {/* Liste */}
      {filteredItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-500">
            {tab === "mine"
              ? `Aucun coaching IA activé pour ${categoryLabel} pour l'instant. Activez-en depuis vos rapports.`
              : tab === "critical"
                ? "Aucun coaching critique en cours."
                : tab === "warning"
                  ? "Aucun point de vigilance en cours."
                  : "Aucune information à signaler."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((c) => {
            const sev = SEV_STYLE[c.severity];
            const status = c.status ?? "active";
            const statusInfo = STATUS_STYLE[status];
            const isManual = c.source === "manual";
            const dimmed = status === "removed" || status === "done";
            return (
              <div
                key={c.id}
                className={`rounded-xl border ${sev.border} ${sev.bg} p-4 space-y-3 ${dimmed ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sev.badge}`}>
                        {sev.label}
                      </span>
                      <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {ACTION_TYPE_LABELS[c.actionType]}
                      </span>
                      {isManual && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusInfo.cls}`}>
                          {statusInfo.label}
                        </span>
                      )}
                      {c.kpiLabel && (
                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                          KPI : {c.kpiLabel}
                        </span>
                      )}
                      {c.sourceReportTitle && (
                        <span className="text-[10px] text-slate-500">
                          issu de « {c.sourceReportTitle} »
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900">{c.title}</h4>
                  </div>
                </div>

                <p className="text-[12px] text-slate-700 leading-relaxed">{c.body}</p>

                {c.recommendation && c.recommendation !== c.body && (
                  <div className="rounded-lg bg-white/60 px-3 py-2">
                    <p className="text-[11px] font-semibold text-fuchsia-700 mb-0.5">
                      ✨ Recommandation
                    </p>
                    <p className="text-[11px] text-slate-700 leading-relaxed">{c.recommendation}</p>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                  <span className="text-[10px] text-slate-400">
                    {c.createdAt && (
                      <>Activé le {new Date(c.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</>
                    )}
                  </span>

                  <div className="flex items-center gap-3">
                    {c.hubspotUrl && (
                      <a
                        href={c.hubspotUrl}
                        target={c.hubspotUrl.startsWith("/") ? undefined : "_blank"}
                        rel={c.hubspotUrl.startsWith("/") ? undefined : "noopener noreferrer"}
                        className="text-[10px] font-medium text-accent underline hover:text-accent/80"
                      >
                        {c.actionLabel ?? "Ouvrir"} →
                      </a>
                    )}
                    {isManual && c.reportCoachingId && (
                      <>
                        {status === "active" && (
                          <>
                            <button
                              type="button"
                              disabled={busyId === c.reportCoachingId}
                              onClick={() => patchManual(c.reportCoachingId!, "done")}
                              className="text-[10px] font-medium text-emerald-700 underline hover:text-emerald-800 disabled:opacity-50"
                            >
                              Marquer fait
                            </button>
                            <button
                              type="button"
                              disabled={busyId === c.reportCoachingId}
                              onClick={() => patchManual(c.reportCoachingId!, "removed")}
                              className="text-[10px] font-medium text-slate-500 underline hover:text-slate-700 disabled:opacity-50"
                            >
                              Retirer
                            </button>
                          </>
                        )}
                        {(status === "done" || status === "removed") && (
                          <button
                            type="button"
                            disabled={busyId === c.reportCoachingId}
                            onClick={() => patchManual(c.reportCoachingId!, "active")}
                            className="text-[10px] font-medium text-fuchsia-700 underline hover:text-fuchsia-800 disabled:opacity-50"
                          >
                            Restaurer
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
