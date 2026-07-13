"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { ReportSpec, ReportBlock } from "@/lib/ai/agents/agent-runtime";

const COLORS = ["#d946ef", "#6366f1", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

function Chart({ block }: { block: ReportBlock }) {
  const data = block.data ?? [];
  if (data.length === 0) return null;

  if (block.type === "donut") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  const axis = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={40} />
      <Tooltip />
    </>
  );

  if (block.type === "line") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          {axis}
          <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  if (block.type === "area") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="agentArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d946ef" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          {axis}
          <Area type="monotone" dataKey="value" stroke="#a21caf" strokeWidth={2} fill="url(#agentArea)" />
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  // bar (défaut)
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        {axis}
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AgentReport({ spec }: { spec: ReportSpec }) {
  // Regroupe les blocs KPI consécutifs sur une même rangée.
  const groups: ReportBlock[][] = [];
  for (const b of spec.blocks) {
    const last = groups[groups.length - 1];
    if (b.type === "kpi" && last && last[0]?.type === "kpi") last.push(b);
    else groups.push([b]);
  }

  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-white p-4">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-500">Rapport</div>
      <h3 className="text-sm font-semibold text-slate-900">{spec.title}</h3>
      {spec.summary && <p className="mt-0.5 text-sm text-slate-600">{spec.summary}</p>}

      <div className="mt-3 space-y-4">
        {groups.map((group, gi) => {
          if (group[0].type === "kpi") {
            return (
              <div key={gi} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {group.map((b, i) => (
                  <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="text-[11px] text-slate-500">{b.label}</div>
                    <div className="mt-0.5 text-lg font-semibold text-slate-900">{b.value}</div>
                    {b.hint && <div className="text-[11px] text-slate-400">{b.hint}</div>}
                  </div>
                ))}
              </div>
            );
          }
          const b = group[0];
          if (b.type === "table") {
            return (
              <div key={gi}>
                {b.title && <div className="mb-1 text-xs font-medium text-slate-600">{b.title}</div>}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        {(b.columns ?? []).map((c, i) => (
                          <th key={i} className="px-2 py-1.5 font-medium">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(b.rows ?? []).map((r, ri) => (
                        <tr key={ri} className="border-b border-slate-100">
                          {r.map((cell, ci) => (
                            <td key={ci} className="px-2 py-1.5 text-slate-700">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }
          return (
            <div key={gi}>
              {b.title && <div className="mb-1 text-xs font-medium text-slate-600">{b.title}</div>}
              <Chart block={b} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
