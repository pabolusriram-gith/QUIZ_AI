"use client";

import React, { useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/services/api";
import { toast } from "sonner";
import Link from "next/link";
import {
  Filter,
  Layers,
  CheckCircle2,
  RotateCcw,
  TrendingUp,
  GraduationCap,
  ChevronDown,
  Award,
  FileText,
  BrainCircuit,
  AlertCircle,
} from "lucide-react";
import dynamic from "next/dynamic";

const ClassroomAttemptChart = dynamic(
  () => import("@/components/analytics/ClassroomAttemptChart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 w-full flex items-center justify-center text-xs text-slate-400 font-bold animate-pulse">
        Loading attempt timeline...
      </div>
    ),
  }
);

import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";

interface Overview {
  total_quizzes: number;
  total_attempts: number;
  avg_score: number;
  pass_rate: number;
}

interface Trend {
  date: string;
  count: number;
}

interface QuizPerf {
  id: string;
  title: string;
  subject: string;
  attempts: number;
  avg_score: number;
  pass_rate: number;
  max_score: number;
}

interface StudentPerf {
  id: string;
  name: string;
  email: string;
  attempts: number;
  avg_score: number;
  pass_rate: number;
}

interface QuestionDiff {
  id: string;
  text: string;
  difficulty: string;
  topic: string;
  attempts: number;
  correct_rate: number;
}

interface AnalyticsData {
  overview: Overview;
  trends: Trend[];
  quiz_performance: QuizPerf[];
  student_performance: StudentPerf[];
  question_difficulty: QuestionDiff[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Available option sets for dropdowns
  const [quizzesList, setQuizzesList] = useState<{ id: string; title: string }[]>([]);
  const [subjectsList, setSubjectsList] = useState<string[]>([]);

  // Filter States
  const [filterSubject, setFilterSubject] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterSem, setFilterSem] = useState("");
  const [filterQuizId, setFilterQuizId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // 1. Fetch lookup arrays for dropdowns on load
  useEffect(() => {
    api.get("/quizzes?limit=100")
      .then((res) => {
        if (res.data && res.data.items) {
          setQuizzesList(res.data.items);
          const uniqueSubjects: string[] = Array.from(
            new Set((res.data.items as any[]).map((q) => q.subject).filter(Boolean))
          );
          setSubjectsList(uniqueSubjects);
        }
      })
      .catch((err) => console.error("Failed to load quizzes for filter selection:", err));
  }, []);

  // 2. Fetch main analytics content
  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterSubject) params.subject = filterSubject;
      if (filterDept) params.department = filterDept;
      if (filterSem) params.semester = filterSem;
      if (filterQuizId) params.quiz_id = filterQuizId;
      if (startDate) params.start_date = new Date(startDate).toISOString();
      if (endDate) params.end_date = new Date(endDate).toISOString();

      const res = await api.get<AnalyticsData>("/quizzes/analytics", { params });
      setData(res.data);
    } catch {
      toast.error("Failed to load analytics data.");
    } finally {
      setLoading(false);
    }
  }, [filterSubject, filterDept, filterSem, filterQuizId, startDate, endDate]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleResetFilters = () => {
    setFilterSubject("");
    setFilterDept("");
    setFilterSem("");
    setFilterQuizId("");
    setStartDate("");
    setEndDate("");
  };

  const hasActiveFilters = !!(filterSubject || filterDept || filterSem || filterQuizId || startDate || endDate);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Classroom Analytics"
        description="Comprehensive insights into quiz submissions, question metrics, pass benchmarks, and student learning trends."
      />

      {/* Sub-navigation: Classroom ↔ AI Analytics */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-0">
        <Link
          href="/dashboard/analytics"
          className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 -mb-px transition-colors"
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Classroom Performance</span>
        </Link>
        <Link
          href="/dashboard/analytics/ai"
          className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 -mb-px transition-colors"
        >
          <BrainCircuit className="h-3.5 w-3.5" />
          <span>AI Generation Analytics</span>
        </Link>
      </div>

      {/* Toolbar / Filters */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="glass-panel rounded-3xl p-4 sm:p-5 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                showFilters || hasActiveFilters
                  ? "bg-indigo-500/15 border-indigo-500/35 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Filter Analytics</span>
              {hasActiveFilters && (
                <span className="h-4 w-4 rounded-full bg-indigo-600 text-[9px] font-extrabold text-white flex items-center justify-center">
                  {[filterSubject, filterDept, filterSem, filterQuizId, startDate, endDate].filter(Boolean).length}
                </span>
              )}
              <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </button>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden pt-3 border-t border-slate-200 dark:border-slate-800"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                {/* Subject Selector */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Subject</label>
                  <select
                    value={filterSubject}
                    onChange={(e) => setFilterSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition cursor-pointer text-xs"
                  >
                    <option value="" className="bg-white dark:bg-slate-900">All Subjects</option>
                    {subjectsList.map((sub) => (
                      <option key={sub} value={sub} className="bg-white dark:bg-slate-900">{sub}</option>
                    ))}
                  </select>
                </div>

                {/* Quiz Selector */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Target Quiz</label>
                  <select
                    value={filterQuizId}
                    onChange={(e) => setFilterQuizId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition cursor-pointer text-xs"
                  >
                    <option value="" className="bg-white dark:bg-slate-900">All Quizzes</option>
                    {quizzesList.map((q) => (
                      <option key={q.id} value={q.id} className="bg-white dark:bg-slate-900">{q.title}</option>
                    ))}
                  </select>
                </div>

                {/* Department */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Department</label>
                  <Input
                    value={filterDept}
                    onChange={(e) => setFilterDept(e.target.value)}
                    placeholder="e.g. CS"
                    className="bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white h-9 text-xs"
                  />
                </div>

                {/* Semester */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Semester</label>
                  <Input
                    value={filterSem}
                    onChange={(e) => setFilterSem(e.target.value)}
                    placeholder="e.g. Fall"
                    className="bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white h-9 text-xs"
                  />
                </div>

                {/* Start Date */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">From Date</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white h-9 text-xs"
                  />
                </div>

                {/* End Date */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">To Date</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white h-9 text-xs"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Main Content */}
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-3xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="lg:col-span-2 h-80 w-full rounded-3xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800" />
            <Skeleton className="h-80 w-full rounded-3xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800" />
          </div>
        </div>
      ) : !data ? (
        <div className="glass-panel rounded-3xl py-16 text-center text-slate-500 font-semibold">
          Failed to compile metrics. Try reloading the page.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <StatCard
              title="Assessed Quizzes"
              value={data.overview.total_quizzes}
              description="Active tests with submissions"
              icon={<Layers className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />}
              glowColor="indigo"
            />
            <StatCard
              title="Total Submissions"
              value={data.overview.total_attempts}
              description="Completed student attempts"
              icon={<TrendingUp className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />}
              glowColor="cyan"
            />
            <StatCard
              title="Class Average"
              value={`${data.overview.avg_score}%`}
              description="Aggregate mean percentage"
              icon={<Award className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />}
              glowColor="emerald"
            />
            <StatCard
              title="Pass Rate"
              value={`${data.overview.pass_rate}%`}
              description="Passing score threshold"
              icon={<CheckCircle2 className="h-5 w-5 text-rose-500 dark:text-rose-400" />}
              glowColor="rose"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Play attempts trend line */}
            <div className="lg:col-span-2 glass-panel border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-sm">
              <div className="mb-4">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Attempt Activity & Timeline
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Distribution of student submissions logged across the selected timeframe.
                </p>
              </div>
              <div className="h-64 w-full text-xs font-semibold text-slate-400">
                <ClassroomAttemptChart trends={data.trends} />
              </div>
            </div>

            {/* Hardest Questions panel */}
            <div className="glass-panel border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-sm">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Hardest Questions
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 mb-4">
                  Stems with lowest accuracy rates across student attempts.
                </p>
              </div>
              <div className="h-64 w-full overflow-y-auto space-y-2.5 pr-1">
                {data.question_difficulty.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-2 py-8 text-slate-400">
                    <AlertCircle className="h-7 w-7 text-slate-300 dark:text-slate-700" />
                    <p className="text-xs font-medium">No question metrics compiled yet.</p>
                  </div>
                ) : (
                  data.question_difficulty.slice(0, 5).map((q) => (
                    <div
                      key={q.id}
                      className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-3.5 space-y-2"
                    >
                      <div className="flex justify-between items-start gap-3">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 leading-relaxed" title={q.text}>
                          {q.text}
                        </p>
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full shrink-0">
                          {q.correct_rate}% Accuracy
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        <span>Topic: {q.topic || "general"}</span>
                        <span>Attempts: {q.attempts}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Performance breakdown tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quiz Performance Table */}
            <div className="glass-panel border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
              <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-indigo-500" />
                  <span>Quiz Performance Breakdown</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Aggregate statistics grouped per active assessment.
                </p>
              </div>
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-slate-400 text-[10px] font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                      <th className="py-2.5 font-bold">Quiz Title</th>
                      <th className="py-2.5 text-center font-bold">Plays</th>
                      <th className="py-2.5 text-center font-bold">Avg Score</th>
                      <th className="py-2.5 text-center font-bold">Pass %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {data.quiz_performance.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 font-medium">
                          No quiz metrics compiled for selected criteria.
                        </td>
                      </tr>
                    ) : (
                      data.quiz_performance.map((qp) => (
                        <tr key={qp.id} className="text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 font-semibold truncate max-w-[180px]" title={qp.title}>
                            {qp.title}
                          </td>
                          <td className="py-2.5 text-center font-semibold text-slate-500">
                            {qp.attempts}
                          </td>
                          <td className="py-2.5 text-center font-bold text-cyan-600 dark:text-cyan-400">
                            {qp.avg_score}%
                          </td>
                          <td className="py-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                            {qp.pass_rate}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Student Performance Table */}
            <div className="glass-panel border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
              <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <GraduationCap className="h-4.5 w-4.5 text-cyan-500" />
                  <span>Student Leaderboard & Scores</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Aggregated scores grouped per student account.
                </p>
              </div>
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-slate-400 text-[10px] font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                      <th className="py-2.5 font-bold">Student Name</th>
                      <th className="py-2.5 text-center font-bold">Attempts</th>
                      <th className="py-2.5 text-center font-bold">Avg Score</th>
                      <th className="py-2.5 text-center font-bold">Pass %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {data.student_performance.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 font-medium">
                          No student attempts recorded in this timeframe.
                        </td>
                      </tr>
                    ) : (
                      data.student_performance.map((sp) => (
                        <tr key={sp.id} className="text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 font-semibold">
                            <div>{sp.name}</div>
                            <div className="text-[10px] text-slate-400 font-normal truncate max-w-[150px]">{sp.email}</div>
                          </td>
                          <td className="py-2.5 text-center font-semibold text-slate-500">
                            {sp.attempts}
                          </td>
                          <td className="py-2.5 text-center font-bold text-cyan-600 dark:text-cyan-400">
                            {sp.avg_score}%
                          </td>
                          <td className="py-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                            {sp.pass_rate}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
