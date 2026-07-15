"use client";

import { useMemo, useState } from "react";
import {
  ACTION_TYPE_LABELS,
  type CoachingActionType,
  type UnifiedCoaching,
} from "@/lib/reports/coaching-types";

type TabId = "mine" | "critical" | "warning" | "info";

// "Mes coachings IA" est désormais affiché sur la vue d'ensemble (pas sur les
// pages catégorie) pour éviter la redondance.
const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: "critical", label: "Critiques", emoji: "🔴" },
  { id: "warning", label: "Vigilance", emoji: "🟠" },
  { id: "info", label: "Infos", emoji: "🔵" },
];

const SEV_STYLE: Record<UnifiedCoaching["severity"], { bg: string; border: string; badge: string; label: string; llmBtn: string }> = {
  critical: {
    bg: "bg-red-50",
    border: "border-red-200",
    badge: "bg-red-100 text-red-700",
    label: "Critique",
    llmBtn: "border-red-300 bg-white text-red-700 hover:bg-red-100",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    label: "Vigilance",
    llmBtn: "border-amber-300 bg-white text-amber-800 hover:bg-amber-100",
  },
  info: {
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    badge: "bg-indigo-100 text-indigo-700",
    label: "Info",
    llmBtn: "border-indigo-300 bg-white text-indigo-700 hover:bg-indigo-100",
  },
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

const CAT_AGENT: Record<string, string> = {
  commercial: "coaching-ventes",
  marketing: "coaching-marketing",
  data: "coaching-data",
  integration: "coaching-integration",
  "cross-source": "coaching-cross-source",
  "data-model": "coaching-data-model",
};

function CoachingCard({ item, category }: { item: UnifiedCoaching; category: string }) {
  const sev = SEV_STYLE[item.severity];
  const isManual = item.source === "manual";
  const statusInfo = STATUS_STYLE[item.status ?? "active"];
  const agentKey = CAT_AGENT[category] ?? "coaching-ventes";
  const ctx = item.reportCoachingId
    ? `rc=${encodeURIComponent(item.reportCoachingId)}`
    : `bt=${encodeURIComponent(item.title)}&bp=${encodeURIComponent(item.recommendation || item.body || "")}`;
  const coachHref = `/dashboard/agents/${agentKey}?${ctx}`;

  return (
    <article className={`relative rounded-xl border p-5 transition ${sev.border} ${sev.bg}`}>
      <div className="flex flex-wrap items-center gap-2 pr-6">
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${sev.badge}`}>{sev.label}</span>
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {ACTION_TYPE_LABELS[item.actionType]}
        </span>
        {isManual && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusInfo.cls}`}>{statusInfo.label}</span>
        )}
        {item.kpiLabel && (
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-slate-600">KPI : {item.kpiLabel}</span>
        )}
        {item.sourceReportTitle && (
          <span className="text-[11px] text-slate-500">issu de « {item.sourceReportTitle} »</span>
        )}
      </div>

      <h3 className="mt-3 text-base font-semibold text-slate-900">{item.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{item.body}</p>

      {item.recommendation && item.recommendation !== item.body && (
        <div className="mt-3 rounded-lg bg-white/60 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-fuchsia-700">✨ Coaching à faire</p>
          <p className="mt-1 text-sm font-medium leading-relaxed text-slate-800">{item.recommendation}</p>
        </div>
      )}

      <div className="mt-4">
        <a
          href={coachHref}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:opacity-90"
        >
          Démarrer mon coaching
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
        </a>
      </div>
    </article>
  );
}

export function CoachingPageTabs({ allItems, categoryLabel }: Props) {
  const [tab, setTab] = useState<TabId>("critical");
  const [actionFilter, setActionFilter] = useState<CoachingActionType | "all">("all");

  // Items affichables selon l'onglet courant
  const tabItems = useMemo(() => {
    if (tab === "mine") return allItems.filter((i) => i.source === "manual");
    return allItems.filter((i) => i.severity === tab && (i.status ?? "active") === "active");
  }, [allItems, tab]);

  const availableActionTypes = useMemo(() => {
    const set = new Set<CoachingActionType>();
    for (const i of tabItems) set.add(i.actionType);
    return [...set];
  }, [tabItems]);

  const filteredItems = useMemo(
    () => (actionFilter === "all" ? tabItems : tabItems.filter((i) => i.actionType === actionFilter)),
    [tabItems, actionFilter],
  );

  const counts = useMemo(() => {
    const mine = allItems.filter((i) => i.source === "manual").length;
    const crit = allItems.filter((i) => i.severity === "critical" && (i.status ?? "active") === "active").length;
    const warn = allItems.filter((i) => i.severity === "warning" && (i.status ?? "active") === "active").length;
    const info = allItems.filter((i) => i.severity === "info" && (i.status ?? "active") === "active").length;
    return { mine, critical: crit, warning: warn, info };
  }, [allItems]);

  function onTabChange(t: TabId) {
    setTab(t);
    setActionFilter("all");
  }

  // Catégorie applicative pour les routes API insights/dismiss (commercial/marketing/...)
  const apiCategory = filteredItems[0]?.category ?? "commercial";

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
        <div className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 scroll-smooth">
          {filteredItems.map((c) => (
            <div key={c.id} className="snap-start shrink-0" style={{ width: "min(440px, 90vw)" }}>
              <CoachingCard item={c} category={apiCategory} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
