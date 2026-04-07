"use client";

import { KpiChart } from "@/components/kpi-chart";

type ChartRow = {
  date: string;
  closingRate: number;
  pipelineCoverage: number;
  dealVelocity: number;
  salesScore: number;
  mqlToSql: number;
  leadVelocity: number;
  funnelLeakage: number;
  marketingScore: number;
  dataCompleteness: number;
  stagnationRate: number;
  activitiesPerDeal: number;
  crmScore: number;
};

export function DashboardCharts({ data }: { data: ChartRow[] }) {
  return (
    <div className="space-y-6">
      {/* Sales Charts */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
          Tendances Sales
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <KpiChart
            data={data.map((d) => ({ date: d.date, value: d.closingRate }))}
            label="Taux de closing (%)"
            color="#6366f1"
            format={(v) => `${v}%`}
          />
          <KpiChart
            data={data.map((d) => ({ date: d.date, value: d.pipelineCoverage }))}
            label="Couverture pipeline (x)"
            color="#818cf8"
            format={(v) => `${v}x`}
          />
        </div>
      </div>

      {/* Marketing Charts */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Tendances Marketing
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <KpiChart
            data={data.map((d) => ({ date: d.date, value: d.mqlToSql }))}
            label="MQL → SQL (%)"
            color="#f59e0b"
            format={(v) => `${v}%`}
          />
          <KpiChart
            data={data.map((d) => ({ date: d.date, value: d.leadVelocity }))}
            label="Vélocité leads (%)"
            color="#d97706"
            format={(v) => `+${v}%`}
          />
        </div>
      </div>

      {/* CRM Ops Charts */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Tendances CRM Ops
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <KpiChart
            data={data.map((d) => ({ date: d.date, value: d.dataCompleteness }))}
            label="Complétude données (%)"
            color="#10b981"
            format={(v) => `${v}%`}
          />
          <KpiChart
            data={data.map((d) => ({ date: d.date, value: d.activitiesPerDeal }))}
            label="Activités / deal"
            color="#059669"
          />
        </div>
      </div>
    </div>
  );
}
