"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type KpiChartProps = {
  data: { date: string; value: number }[];
  label: string;
  color?: string;
  format?: (v: number) => string;
};

export function KpiChart({ data, label, color = "#6366f1", format }: KpiChartProps) {
  return (
    <div className="card p-5">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <div className="mt-3 h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={format}
              width={50}
            />
            <Tooltip
              formatter={(value) => [format ? format(Number(value)) : value, label]}
              labelStyle={{ color: "#475569", fontSize: 12 }}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                fontSize: 13,
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
