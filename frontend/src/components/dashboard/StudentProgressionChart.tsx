"use client";

import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { TrendingUp } from "lucide-react";

interface TrendItem {
  quiz_title: string;
  percentage: number;
  date: string;
}

interface StudentProgressionChartProps {
  trend?: TrendItem[];
}

export default function StudentProgressionChart({ trend }: StudentProgressionChartProps) {
  if (!trend || trend.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center space-y-2 py-8 text-slate-400">
        <TrendingUp className="h-8 w-8 text-slate-300 dark:text-slate-700" />
        <p className="text-xs font-medium">Complete your first quiz to begin tracking your score progression curve over time.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={trend} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
        <defs>
          <linearGradient id="studentProgressGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
        <XAxis dataKey="date" stroke="currentColor" opacity={0.5} tickLine={false} axisLine={false} dy={8} style={{ fontSize: 10 }} />
        <YAxis stroke="currentColor" opacity={0.5} tickLine={false} axisLine={false} dx={-8} style={{ fontSize: 10 }} domain={[0, 100]} />
        <Tooltip contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.9)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "14px", fontSize: "11px", color: "#fff" }} />
        <Area type="monotone" dataKey="percentage" name="Score %" stroke="#06b6d4" strokeWidth={2.5} fillOpacity={1} fill="url(#studentProgressGlow)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
