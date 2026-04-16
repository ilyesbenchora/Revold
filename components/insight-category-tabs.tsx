"use client";

import { useState } from "react";
import { InsightCard } from "@/components/insight-card";

type Insight = {
  key: string;
  severity: "critical" | "warning" | "info";
  title: string;
  body: string;
  recommendation: string;
};

type Bloc = {
  id: "commercial" | "marketing" | "data";
  label: string;
  insights: Insight[];
  dot: string;
};

type Props = {
  blocs: Bloc[];
  hubspotLinks: Record<string, string>;
};

export function InsightCategoryTabs({ blocs, hubspotLinks }: Props) {
  const [activeTab, setActiveTab] = useState(blocs[0]?.id ?? "commercial");
  const active = blocs.find((b) => b.id === activeTab) ?? blocs[0];

  return (
    <div className="space-y-4">
      {/* Tab pills */}
      <div className="flex gap-2">
        {blocs.map((bloc) => {
          const isActive = bloc.id === activeTab;
          return (
            <button
              key={bloc.id}
              type="button"
              onClick={() => setActiveTab(bloc.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-white shadow-sm border border-card-border text-slate-900"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${bloc.dot}`} />
              {bloc.label}
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                isActive ? "bg-slate-100 text-slate-700" : "bg-slate-50 text-slate-400"
              }`}>
                {bloc.insights.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      {active && (
        active.insights.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <p className="text-sm text-emerald-700">Toutes les recommandations ont été traitées pour cette catégorie.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {active.insights.map((insight) => (
              <InsightCard
                key={insight.key}
                templateKey={insight.key}
                severity={insight.severity}
                title={insight.title}
                body={insight.body}
                recommendation={insight.recommendation}
                hubspotUrl={hubspotLinks[active.id]}
                category={active.id}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
