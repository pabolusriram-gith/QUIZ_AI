"use client";

import React, { useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Link from "next/link";
import dynamic from "next/dynamic";
import { StatCard } from "@/components/ui/StatCard";
import {
  BrainCircuit,
  Zap,
  Clock,
  Wrench,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Layers,
} from "lucide-react";
import api from "@/services/api";

const AIAnalyticsCharts = dynamic(
  () => import("@/components/analytics/AIAnalyticsCharts"),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-72 rounded-3xl bg-slate-100 dark:bg-slate-800/50 animate-pulse border border-slate-200 dark:border-slate-800" />
        <div className="h-72 rounded-3xl bg-slate-100 dark:bg-slate-800/50 animate-pulse border border-slate-200 dark:border-slate-800" />
      </div>
    ),
  }
);

// ── Types ──────────────────────────────────────────────────────────────────────
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

interface RequestTrace {
  request_id: string;
  timestamp: string;
  request_type: string;
  provider: string;
  model: string;
  total_ms: number;
  success: boolean;
  repair_count: number;
  validation_failures: number;
  total_questions_generated: number;
}

interface AIMetricsData {
  successful_requests: number;
  rejected_requests: number;
  avg_latency_ms: number;
  self_healing_actions: number;
  providers: Record<string, ProviderStats>;
  daily_series: DaySeries[];
  request_traces?: RequestTrace[];
}

// ── Provider colour palette ────────────────────────────────────────────────────
const PROVIDER_COLORS: Record<string, string> = {
  gemini: "#6366f1",
  groq: "#06b6d4",
  openai: "#10b981",
  mock: "#f59e0b",
};

const PROVIDER_LABEL: Record<string, string> = {
  gemini: "Google Gemini",
  groq: "Groq Cloud",
  openai: "OpenAI",
  mock: "Mock Fallback",
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function fmtMs(ms: number) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

const TRACES_PER_PAGE = 10;

export default function AIAnalyticsPage() {
  const [data, setData] = useState<AIMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTraces, setShowTraces] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tracePage, setTracePage] = useState(1);

  const fetchMetrics = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await api.get<AIMetricsData>("/ai/metrics", {
        params: { include_traces: true, trace_limit: 50 },
      });
      setData(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message || "Failed to load AI metrics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics(true);
  }, [fetchMetrics]);

  // Build pie-chart data from providers
  const pieData = data
    ? Object.entries(data.providers)
        .filter(([, s]) => s.total > 0)
        .map(([name, s]) => ({
          name: PROVIDER_LABEL[name] || name,
          value: s.total,
          color: PROVIDER_COLORS[name] || "#888",
        }))
    : [];

  // Trim daily series to last 14 days for readability
  const barData = data?.daily_series.slice(-14) ?? [];

  const successRate =
    data && data.successful_requests + data.rejected_requests > 0
      ? Math.round(
          (data.successful_requests /
            (data.successful_requests + data.rejected_requests)) *
            100
        )
      : 0;

  // Pagination for traces
  const traces = data?.request_traces ?? [];
  const totalPages = Math.max(1, Math.ceil(traces.length / TRACES_PER_PAGE));
  const paginatedTraces = traces.slice(
    (tracePage - 1) * TRACES_PER_PAGE,
    tracePage * TRACES_PER_PAGE
  );

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="AI Generation Analytics"
        description="Observability and runtime telemetry for AI question generation, latency tracking, and autonomous self-healing activity."
      />

      {/* Sub-navigation: Classroom ↔ AI Analytics */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-0">
        <Link
          href="/dashboard/analytics"
          className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 -mb-px transition-colors"
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Classroom Performance</span>
        </Link>
        <Link
          href="/dashboard/analytics/ai"
          className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 -mb-px transition-colors"
        >
          <BrainCircuit className="h-3.5 w-3.5" />
          <span>AI Generation Analytics</span>
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex justify-end">
        <button
          id="ai-analytics-refresh"
          onClick={() => fetchMetrics(false)}
          disabled={refreshing || loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span>{refreshing ? "Refreshing Metrics…" : "Refresh"}</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[340px] gap-3">
          <div className="h-9 w-9 rounded-full border-3 border-indigo-500 border-t-transparent animate-spin" />
          <span className="text-xs text-slate-500 font-bold">Synchronizing telemetry streams...</span>
        </div>
      ) : error ? (
        <div className="glass-panel rounded-3xl py-16 text-center text-slate-500 font-medium">
          {error}
        </div>
      ) : data ? (
        <>
          {/* Stat Cards Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <StatCard
              title="AI Generations"
              value={data.successful_requests}
              icon={<BrainCircuit className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />}
              glowColor="indigo"
              description="Successful AI requests completed"
            />
            <StatCard
              title="Success Rate"
              value={`${successRate}%`}
              icon={<Zap className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />}
              glowColor="emerald"
              description="Requests resolved without errors"
            />
            <StatCard
              title="Avg Latency"
              value={fmtMs(data.avg_latency_ms)}
              icon={<Clock className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />}
              glowColor="cyan"
              description="Mean end-to-end response time"
            />
            <StatCard
              title="Self-Healing"
              value={data.self_healing_actions}
              icon={<Wrench className="h-5 w-5 text-rose-500 dark:text-rose-400" />}
              glowColor="rose"
              description="JSON schema auto-repairs applied"
            />
          </div>

          {/* Lazy-Loaded Charts */}
          <AIAnalyticsCharts
            barData={barData}
            pieData={pieData}
            providers={data.providers}
            providerColors={PROVIDER_COLORS}
            providerLabel={PROVIDER_LABEL}
            fmtMs={fmtMs}
          />

          {/* Observability Trace Logs with Pagination */}
          <div className="glass-panel border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <button
              id="ai-analytics-traces-toggle"
              onClick={() => setShowTraces(!showTraces)}
              className="w-full flex justify-between items-center p-6 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
            >
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider text-left">
                  Recent Generation Telemetry Logs
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 text-left mt-0.5">
                  Detailed per-request trace records — showing {traces.length} total entries.
                </p>
              </div>
              {showTraces ? (
                <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
              )}
            </button>

            {showTraces && (
              <div className="border-t border-slate-200 dark:border-slate-800">
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-[11px] border-collapse min-w-[700px]">
                    <thead className="sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm z-10">
                      <tr className="text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 text-[10px]">
                        <th className="px-5 py-3">Timestamp</th>
                        <th className="px-5 py-3">Action Type</th>
                        <th className="px-5 py-3">Engine Provider</th>
                        <th className="px-5 py-3">Model Tag</th>
                        <th className="px-5 py-3 text-center">Latency</th>
                        <th className="px-5 py-3 text-center">Auto-Repairs</th>
                        <th className="px-5 py-3 text-center">Output Count</th>
                        <th className="px-5 py-3 text-center">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {paginatedTraces.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-5 py-8 text-center text-slate-400 font-medium">
                            No generation traces logged yet.
                          </td>
                        </tr>
                      ) : (
                        paginatedTraces.map((t) => (
                          <tr
                            key={t.request_id}
                            className="text-slate-700 dark:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="px-5 py-2.5 font-mono text-[10px] whitespace-nowrap text-slate-400">{fmtDate(t.timestamp)}</td>
                            <td className="px-5 py-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                t.request_type === "generate"
                                  ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                                  : t.request_type === "regenerate"
                                  ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20"
                                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              }`}>
                                {t.request_type}
                              </span>
                            </td>
                            <td className="px-5 py-2.5 font-bold" style={{ color: PROVIDER_COLORS[t.provider] ?? undefined }}>
                              {PROVIDER_LABEL[t.provider] || t.provider}
                            </td>
                            <td className="px-5 py-2.5 font-mono text-[10px] text-slate-400">{t.model}</td>
                            <td className="px-5 py-2.5 text-center font-mono font-semibold text-[10px]">
                              {fmtMs(t.total_ms)}
                            </td>
                            <td className="px-5 py-2.5 text-center">
                              {t.repair_count > 0 ? (
                                <span className="text-amber-600 dark:text-amber-400 font-bold px-2 py-0.5 rounded bg-amber-500/10">{t.repair_count}</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-5 py-2.5 text-center font-bold text-slate-600 dark:text-slate-300">
                              {t.total_questions_generated || "—"}
                            </td>
                            <td className="px-5 py-2.5 text-center">
                              {t.success ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                              ) : (
                                <XCircle className="h-4 w-4 text-rose-500 mx-auto" />
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs text-slate-500">
                    <div>
                      Page <span className="font-bold text-slate-900 dark:text-white">{tracePage}</span> of{" "}
                      <span className="font-bold text-slate-900 dark:text-white">{totalPages}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setTracePage((p) => Math.max(1, p - 1))}
                        disabled={tracePage <= 1}
                        className="px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        <span>Prev</span>
                      </button>
                      <button
                        onClick={() => setTracePage((p) => Math.min(totalPages, p + 1))}
                        disabled={tracePage >= totalPages}
                        className="px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <span>Next</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
