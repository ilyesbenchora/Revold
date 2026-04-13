"use client";

import { useState } from "react";

type SourceStat = { source: string; label: string; count: number; pct: number };
type DrillDown = { value: string; count: number; pct: number };

type Props = {
  sources: SourceStat[];
  drillDown1: DrillDown[];
  drillDown2: DrillDown[];
  total: number;
};

type Tab = "source" | "dd1" | "dd2";

/** Translate drill-down 1 technical values to French */
const DD1_LABELS: Record<string, string> = {
  INTEGRATION: "Intégration tierce",
  API: "Import via API",
  IMPORT: "Import fichier",
  CRM_UI: "Saisie manuelle CRM",
  FORM: "Formulaire",
  MEETING: "Prise de rendez-vous",
  SEQUENCE: "Séquence email",
  WORKFLOW: "Workflow automatisé",
  SALESFORCE: "Synchronisation Salesforce",
  MIGRATION: "Migration de données",
  CONTACTS_WEB: "Formulaire web",
  SOCIAL: "Réseaux sociaux",
  EMAIL: "Email marketing",
  PAID: "Publicité payante",
  ORGANIC: "Recherche organique",
};

/** Resolve drill-down 2 values: replace numeric IDs with readable labels */
function resolveDd2Label(value: string): string {
  // Numeric IDs are HubSpot app/integration IDs — show as "App #ID"
  if (/^\d+$/.test(value)) return `Application #${value}`;
  // Known technical values
  const DD2_LABELS: Record<string, string> = {
    "sample-contact": "Contact exemple HubSpot",
    "leadin-bot": "Bot conversationnel",
    "CRM_UI": "Interface CRM",
  };
  return DD2_LABELS[value] ?? value;
}

function BarList({ items }: { items: Array<{ label: string; count: number; pct: number }> }) {
  const maxCount = Math.max(...items.map((s) => s.count), 1);
  return (
    <div className="space-y-1.5">
      {items.map((s) => (
        <div key={s.label} className="flex items-center gap-3">
          <span className="w-36 shrink-0 text-[11px] font-medium text-slate-700 truncate" title={s.label}>{s.label}</span>
          <div className="flex-1 h-5 rounded bg-slate-100 overflow-hidden relative">
            <div
              className="h-full rounded bg-indigo-500 transition-all"
              style={{ width: `${Math.max(1, (s.count / maxCount) * 100)}%` }}
            />
            {s.count > 0 && (
              <span className="absolute inset-y-0 right-2 flex items-center text-[10px] font-semibold text-slate-600 tabular-nums">
                {s.count.toLocaleString("fr-FR")}
              </span>
            )}
          </div>
          <span className="w-10 shrink-0 text-right text-[10px] font-medium text-slate-500 tabular-nums">{s.pct} %</span>
        </div>
      ))}
    </div>
  );
}

export function TrackingSourcesBlock({ sources, drillDown1, drillDown2, total }: Props) {
  const [tab, setTab] = useState<Tab>("source");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTab("source")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
              tab === "source" ? "bg-accent text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Source d&apos;origine
          </button>
          <button
            type="button"
            onClick={() => setTab("dd1")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
              tab === "dd1" ? "bg-accent text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Type de source
          </button>
          <button
            type="button"
            onClick={() => setTab("dd2")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
              tab === "dd2" ? "bg-accent text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Détail de la source
          </button>
        </div>
        <p className="text-[10px] text-slate-400">{total.toLocaleString("fr-FR")} contacts</p>
      </div>

      {tab === "source" && (
        <BarList items={sources.map((s) => ({ label: s.label, count: s.count, pct: s.pct }))} />
      )}
      {tab === "dd1" && (
        drillDown1.length > 0
          ? <BarList items={drillDown1.map((d) => ({ label: DD1_LABELS[d.value] ?? d.value, count: d.count, pct: d.pct }))} />
          : <p className="py-4 text-center text-xs text-slate-400">Aucune donnée</p>
      )}
      {tab === "dd2" && (
        drillDown2.length > 0
          ? <BarList items={drillDown2.map((d) => ({ label: resolveDd2Label(d.value), count: d.count, pct: d.pct }))} />
          : <p className="py-4 text-center text-xs text-slate-400">Aucune donnée</p>
      )}
    </div>
  );
}
