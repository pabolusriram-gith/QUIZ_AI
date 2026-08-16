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

interface Trend {
  date: string;
  count: number;
}

interface ClassroomAttemptChartProps {
  trends: Trend[];
}

export default function ClassroomAttemptChart({ trends }: ClassroomAttemptChartProps) {
  if (!trends || trends.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center space-y-2 py-8 text-slate-400">
        <TrendingUp className="h-8 w-8 text-slate-300 dark:text-slate-700" />
        <p className="text-xs font-medium">No quiz attempts logged in this filter timeframe.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={trends} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
        <defs>
          <linearGradient id="attemptsGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
        <XAxis dataKey="date" stroke="currentColor" opacity={0.5} tickLine={false} axisLine={false} dy={8} style={{ fontSize: 10 }} />
        <YAxis stroke="currentColor" opacity={0.5} tickLine={false} axisLine={false} dx={-8} style={{ fontSize: 10 }} />
        <Tooltip contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.9)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "14px", fontSize: "11px", color: "#fff" }} />
        <Area type="monotone" dataKey="count" name="Attempts" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#attemptsGlow)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
