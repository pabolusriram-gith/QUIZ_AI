import React from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { PieChart, Clock, Award, BarChart3 } from "lucide-react";
import EmptyState from "./shared/EmptyState";

interface OptionDist {
  label: string; // "A", "B", "C", "D"
  count: number;
  text: string;
  is_correct?: boolean;
}

interface StatisticsPanelProps {
  submissionsCount: number;
  accuracy: number;
  avgResponseTime: number;
  distribution: OptionDist[];
}

export default function StatisticsPanel({
  submissionsCount,
  accuracy,
  avgResponseTime,
  distribution
}: StatisticsPanelProps) {
  const chartData = distribution.map(d => ({
    name: d.label,
    value: d.count,
    isCorrect: d.is_correct
  }));

  const hasSubmissions = submissionsCount > 0;

  return (
    <div className="glass-panel border-white/5 p-6 rounded-3xl space-y-6 shadow-2xl w-full animate-fade-in">
      <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2.5">
        <PieChart className="h-4.5 w-4.5 text-indigo-400" />
        <span>Live Statistics</span>
      </h3>

      {!hasSubmissions ? (
        <EmptyState type="no_responses" />
      ) : (
        <div className="space-y-6">
          {/* Key metrics cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-white/2 border border-white/5 rounded-xl text-center">
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Answered</span>
              <span className="text-base font-black text-white block mt-1">{submissionsCount}</span>
            </div>
            <div className="p-3 bg-white/2 border border-white/5 rounded-xl text-center">
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Accuracy</span>
              <span className="text-base font-black text-emerald-400 block mt-1">
                {Math.round(accuracy)}%
              </span>
            </div>
            <div className="p-3 bg-white/2 border border-white/5 rounded-xl text-center">
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Avg Time</span>
              <span className="text-base font-black text-cyan-400 block mt-1">
                {avgResponseTime.toFixed(1)}s
              </span>
            </div>
          </div>

          {/* Option Selection Distribution Chart */}
          <div className="space-y-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Response Distribution</span>
            <div className="h-44 w-full bg-white/1 rounded-xl p-2 border border-white/3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    stroke="#9CA3AF"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#9CA3AF"
                    fontSize={10}
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={32}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isCorrect ? "#10B981" : "#6366F1"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Label Reference legend */}
          <div className="space-y-1.5 pt-2 border-t border-white/5 text-[9px] text-slate-400 font-semibold">
            {distribution.map((d) => (
              <div key={d.label} className="flex items-start gap-2 leading-relaxed">
                <span className={`px-1.5 py-0.5 rounded font-mono font-bold select-none shrink-0 ${
                  d.is_correct ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/25"
                }`}>
                  {d.label}
                </span>
                <span className="truncate text-slate-300">{d.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
export const MemoizedStatisticsPanel = React.memo(StatisticsPanel);
