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

type CardState = "idle" | "busy" | "hidden";

function CoachingCard({
  item,
  category,
  onChange,
}: {
  item: UnifiedCoaching;
  category: string;
  onChange: () => void;
}) {
  const [state, setState] = useState<CardState>("idle");
  const [error, setError] = useState<string | null>(null);

  const sev = SEV_STYLE[item.severity];
  const status = item.status ?? "active";
  const statusInfo = STATUS_STYLE[status];
  const isManual = item.source === "manual";
  const isActive = status === "active";
  const dimmed = status === "removed" || status === "done";

  if (state === "hidden") return null;

  /** Dismiss / restore unifié — route automatique selon source. */
  async function changeStatus(target: "done" | "removed" | "active") {
    if (state === "busy") return;
    setState("busy");
    setError(null);

    try {
      let res: Response;
      if (isManual && item.reportCoachingId) {
        // Manuel : PATCH report_coachings
        res = await fetch(`/api/reports/coachings/${item.reportCoachingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: target }),
        });
      } else if (target === "active") {
        // Auto-insight : restore
        res = await fetch("/api/insights/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateKey: item.templateKey }),
        });
      } else {
        // Auto-insight : dismiss done/removed
        res = await fetch("/api/insights/dismiss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateKey: item.templateKey,
            status: target,
            title: item.title,
            body: item.body,
            recommendation: item.recommendation,
            severity: item.severity,
            category,
            hubspotUrl: item.hubspotUrl,
          }),
        });
      }

      const data = await res.json().catch(() => null);
      if (res.ok && (data?.success || data?.ok)) {
        setState("hidden");
        onChange();
      } else {
        setError((data?.error as string) || `Erreur ${res.status}`);
        setState("idle");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
      setState("idle");
    }
  }

  const isInternal = !!item.hubspotUrl?.startsWith("/");
  const ctaLabel =
    item.actionLabel ?? (item.hubspotUrl
      ? isInternal
        ? "Voir dans Revold"
        : "À faire dans HubSpot"
      : null);

  return (
    <article
      className={`relative rounded-xl border p-5 transition ${sev.border} ${sev.bg} ${state === "busy" ? "opacity-50" : ""} ${dimmed ? "opacity-70" : ""}`}
    >
      {/* Cross retirer (top-right) — uniquement sur les actifs */}
      {isActive && (
        <button
          onClick={() => changeStatus("removed")}
          disabled={state === "busy"}
          aria-label="Retirer ce coaching"
          title="Retirer ce coaching"
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-red-500 transition hover:bg-red-100 disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      {/* Badges header */}
      <div className="flex items-center gap-2 pr-6 flex-wrap">
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${sev.badge}`}>{sev.label}</span>
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {ACTION_TYPE_LABELS[item.actionType]}
        </span>
        {isManual && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusInfo.cls}`}>
            {statusInfo.label}
          </span>
        )}
        {item.kpiLabel && (
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            KPI : {item.kpiLabel}
          </span>
        )}
        {item.sourceReportTitle && (
          <span className="text-[11px] text-slate-500">issu de « {item.sourceReportTitle} »</span>
        )}
      </div>

      {/* Titre + body */}
      <h3 className="mt-3 text-base font-semibold text-slate-900">{item.title}</h3>
      <p className="mt-1.5 text-sm text-slate-700 leading-relaxed">{item.body}</p>

      {/* Bloc Coaching à faire (anciennement "Action à faire"/"Recommandation") */}
      {item.recommendation && item.recommendation !== item.body && (
        <div className="mt-3 rounded-lg bg-white/60 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-fuchsia-700">
            ✨ Coaching à faire
          </p>
          <p className="mt-1 text-sm font-medium text-slate-800 leading-relaxed">{item.recommendation}</p>
        </div>
      )}

      {/* Erreur API */}
      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Footer CTAs */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {/* CTA principal : ouvrir HubSpot ou page interne Revold */}
        {item.hubspotUrl && ctaLabel && (
          <a
            href={item.hubspotUrl}
            target={isInternal ? undefined : "_blank"}
            rel={isInternal ? undefined : "noopener noreferrer"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500"
          >
            {ctaLabel}
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        )}

        {/* Marquer comme fait (vert) — pour tous les actifs */}
        {isActive && (
          <button
            onClick={() => changeStatus("done")}
            disabled={state === "busy"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
            Marquer comme fait
          </button>
        )}

        {/* Restaurer — pour done / removed */}
        {!isActive && (
          <button
            onClick={() => changeStatus("active")}
            disabled={state === "busy"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-card-border bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9" />
              <polyline points="3 4 3 12 11 12" />
            </svg>
            Restaurer
          </button>
        )}

        {/* Date d'activation pour les manuels */}
        {item.createdAt && (
          <span className="ml-auto text-[10px] text-slate-400">
            Activé le {new Date(item.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        )}
      </div>
    </article>
  );
}

export function CoachingPageTabs({ allItems, categoryLabel }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("mine");
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
        <div className="space-y-3">
          {filteredItems.map((c) => (
            <CoachingCard
              key={c.id}
              item={c}
              category={apiCategory}
              onChange={() => router.refresh()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
