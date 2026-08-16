"use client";

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface ProviderStats {
  total: number;
  success: number;
  failed: number;
  avg_latency_ms: number;
}

interface DaySeries {
  date: string;
  count: number;
  generate: number;
  regenerate: number;
  enhance: number;
}

interface AIAnalyticsChartsProps {
  barData: DaySeries[];
  pieData: Array<{ name: string; value: number; color: string }>;
  providers: Record<string, ProviderStats>;
  providerColors: Record<string, string>;
  providerLabel: Record<string, string>;
  fmtMs: (ms: number) => string;
}

export default function AIAnalyticsCharts({
  barData,
  pieData,
  providers,
  providerColors,
  providerLabel,
  fmtMs,
}: AIAnalyticsChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Daily Usage BarChart */}
      <div className="lg:col-span-2 glass-panel border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex flex-col shadow-sm">
        <div className="mb-4">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Daily Request Activity
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Volume of generate, regenerate, and enhancement requests per day (last 14 days).
          </p>
        </div>
        <div className="h-64 w-full text-xs font-semibold text-slate-400">
          {barData.every((d) => d.count === 0) ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs py-8">
              No AI activity recorded in the last 14 days.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                <XAxis
                  dataKey="date"
                  stroke="currentColor"
                  opacity={0.5}
                  tickLine={false}
                  axisLine={false}
                  dy={8}
                  style={{ fontSize: 10 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis
                  stroke="currentColor"
                  opacity={0.5}
                  tickLine={false}
                  axisLine={false}
                  dx={-8}
                  style={{ fontSize: 10 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.9)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "14px",
                    fontSize: "11px",
                    color: "#fff",
                  }}
                />
                <Bar dataKey="generate" name="Generate" fill="#6366f1" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="regenerate" name="Regenerate" fill="#06b6d4" radius={[0, 0, 0, 0]} stackId="a" />
                <Bar dataKey="enhance" name="Enhance" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Provider Distribution PieChart */}
      <div className="glass-panel border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex flex-col shadow-sm">
        <div className="mb-4">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Provider Distribution
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Proportion of requests routed per AI provider engine.
          </p>
        </div>
        <div className="flex-1 min-h-[200px]">
          {pieData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              No provider data recorded.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="45%"
                  innerRadius={52}
                  outerRadius={76}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.9)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "14px",
                    fontSize: "11px",
                    color: "#fff",
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "11px", fontWeight: 600 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Provider breakdown status pills */}
        <div className="mt-2 space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
          {Object.entries(providers).map(([name, s]) => (
            <div key={name} className="flex justify-between items-center text-[11px] font-semibold">
              <span
                className="flex items-center gap-1.5 font-bold"
                style={{ color: providerColors[name] }}
              >
                <span className="h-2 w-2 rounded-full inline-block" style={{ background: providerColors[name] }} />
                {providerLabel[name] || name}
              </span>
              <span className="text-slate-500 font-mono text-[10px]">
                {s.success}✓ / {s.failed}✗ • {fmtMs(s.avg_latency_ms)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
