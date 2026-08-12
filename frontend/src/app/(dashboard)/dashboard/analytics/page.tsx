"use client";

import React, { useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/services/api";
import { toast } from "sonner";
import {
  
  
  Filter,
  Layers,
  CheckCircle2,
  
  
  RotateCcw,
  
  TrendingUp,
  GraduationCap,
  ChevronDown,
  
  Award,
  
  FileText
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  
  
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from "recharts";
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
    // Load quizzes to populate the quiz dropdown filter
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
    } catch (err: any) {
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
        description="Comprehensive insights into quiz submissions, question metrics, and student scores."
      />

      {/* Toolbar / Filters */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${showFilters || hasActiveFilters ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" : "bg-white/4 border-white/8 text-slate-400 hover:text-white"}`}>
              <Filter className="h-3.5 w-3.5" />
              Filter Analytics
              <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </button>
            {hasActiveFilters && (
              <button onClick={handleResetFilters} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-white/4 border border-white/8 text-slate-400 hover:text-white transition-colors cursor-pointer">
                <RotateCcw className="h-3.5 w-3.5" />Reset
              </button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="pt-3 border-t border-white/5 grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
                {/* Subject Selector */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Subject</label>
                  <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-white/4 border border-white/8 text-white focus:outline-none focus:border-indigo-500/50 transition cursor-pointer">
                    <option value="" className="bg-[#060d1c]">All Subjects</option>
                    {subjectsList.map((sub) => (
                      <option key={sub} value={sub} className="bg-[#060d1c]">{sub}</option>
                    ))}
                  </select>
                </div>

                {/* Quiz Selector */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Quiz</label>
                  <select value={filterQuizId} onChange={(e) => setFilterQuizId(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-white/4 border border-white/8 text-white focus:outline-none focus:border-indigo-500/50 transition cursor-pointer">
                    <option value="" className="bg-[#060d1c]">All Quizzes</option>
                    {quizzesList.map((q) => (
                      <option key={q.id} value={q.id} className="bg-[#060d1c]">{q.title}</option>
                    ))}
                  </select>
                </div>

                {/* Department */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Department</label>
                  <Input value={filterDept} onChange={(e) => setFilterDept(e.target.value)} placeholder="e.g. CS" className="bg-white/4 border-white/8 text-white h-9 text-xs focus:border-indigo-500/50" />
                </div>

                {/* Semester */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Semester</label>
                  <Input value={filterSem} onChange={(e) => setFilterSem(e.target.value)} placeholder="e.g. Autumn" className="bg-white/4 border-white/8 text-white h-9 text-xs focus:border-indigo-500/50" />
                </div>

                {/* Start Date */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">From Date</label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-white/4 border-white/8 text-white h-9 text-xs focus:border-indigo-500/50" />
                </div>

                {/* End Date */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">To Date</label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-white/4 border-white/8 text-white h-9 text-xs focus:border-indigo-500/50" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Main Content loader */}
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full bg-white/5 border border-white/5" variant="glass" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="lg:col-span-2 h-80 w-full bg-white/5 border border-white/5" variant="glass" />
            <Skeleton className="h-80 w-full bg-white/5 border border-white/5" variant="glass" />
          </div>
        </div>
      ) : !data ? (
        <div className="glass-panel rounded-2xl py-16 text-center text-slate-500">Failed to compile metrics. Try reloading.</div>
      ) : (
        <div className="space-y-6">
          {/* Stats widgets */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Analysed Quizzes" value={data.overview.total_quizzes} icon={<Layers className="h-5 w-5 text-indigo-400" />} glowColor="indigo" />
            <StatCard title="Total Attempts" value={data.overview.total_attempts} icon={<TrendingUp className="h-5 w-5 text-cyan-400" />} glowColor="cyan" />
            <StatCard title="Class Average" value={`${data.overview.avg_score}%`} icon={<Award className="h-5 w-5 text-amber-400" />} glowColor="rose" />
            <StatCard title="Pass Rate" value={`${data.overview.pass_rate}%`} icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />} glowColor="emerald" />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Play attempts trend line */}
            <div className="lg:col-span-2 glass-panel border-white/5 rounded-2xl p-5 flex flex-col justify-between">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Attempt Activity & Timeline</h3>
                <p className="text-[10px] text-slate-500">Distribution of students taking assessments over time.</p>
              </div>
              <div className="h-64 w-full text-xs font-semibold text-slate-400">
                {data.trends.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500">No attempts logged in this filter timeframe.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.trends} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="attemptsGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.04)" />
                      <XAxis dataKey="date" stroke="rgba(255, 255, 255, 0.2)" tickLine={false} axisLine={false} dy={8} style={{ fontSize: 9 }} />
                      <YAxis stroke="rgba(255, 255, 255, 0.2)" tickLine={false} axisLine={false} dx={-8} style={{ fontSize: 9 }} />
                      <Tooltip contentStyle={{ background: "rgba(9, 15, 30, 0.9)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "10px", fontSize: "10px" }} />
                      <Area type="monotone" dataKey="count" name="Attempts" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#attemptsGlow)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Hardest Questions panel */}
            <div className="glass-panel border-white/5 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Hardest Questions</h3>
                <p className="text-[10px] text-slate-500 mb-4">Questions with lowest correct accuracy answers.</p>
              </div>
              <div className="h-64 w-full overflow-y-auto space-y-2.5 pr-1">
                {data.question_difficulty.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">No question metrics compiled yet.</div>
                ) : (
                  data.question_difficulty.slice(0, 5).map((q) => (
                    <div key={q.id} className="bg-white/2 border border-white/5 rounded-xl p-3 space-y-2">
                      <div className="flex justify-between items-start gap-3">
                        <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed" title={q.text}>{q.text}</p>
                        <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded shrink-0">{q.correct_rate}% Correct</span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                        <span>Topic: {q.topic || "general"}</span>
                        <span>Attempts: {q.attempts}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Performance breakdown grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quiz Performance Table */}
            <div className="glass-panel border-white/5 rounded-2xl p-5 space-y-3">
              <div className="pb-2 border-b border-white/5">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5"><FileText className="h-4 w-4 text-indigo-400" />Quiz Performance Breakdown</h3>
                <p className="text-[10px] text-slate-500">Aggregate statistics grouped per active quiz.</p>
              </div>
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-slate-500 text-[10px] font-bold uppercase border-b border-white/5">
                      <th className="py-2.5">Quiz Title</th>
                      <th className="py-2.5 text-center">Plays</th>
                      <th className="py-2.5 text-center">Avg Score</th>
                      <th className="py-2.5 text-center">Pass %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/4">
                    {data.quiz_performance.length === 0 ? (
                      <tr><td colSpan={4} className="py-8 text-center text-slate-500">No quiz metrics compiled.</td></tr>
                    ) : (
                      data.quiz_performance.map((qp) => (
                        <tr key={qp.id} className="text-slate-300 hover:text-white">
                          <td className="py-2.5 font-medium truncate max-w-[180px]" title={qp.title}>{qp.title}</td>
                          <td className="py-2.5 text-center font-semibold text-slate-400">{qp.attempts}</td>
                          <td className="py-2.5 text-center font-bold text-cyan-400">{qp.avg_score}%</td>
                          <td className="py-2.5 text-center font-bold text-emerald-400">{qp.pass_rate}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Student Performance Table */}
            <div className="glass-panel border-white/5 rounded-2xl p-5 space-y-3">
              <div className="pb-2 border-b border-white/5">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5"><GraduationCap className="h-4.5 w-4.5 text-cyan-400" />Student Leaderboard & Scores</h3>
                <p className="text-[10px] text-slate-500">Aggregated performances per individual student account.</p>
              </div>
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-slate-500 text-[10px] font-bold uppercase border-b border-white/5">
                      <th className="py-2.5">Student Name</th>
                      <th className="py-2.5 text-center">Attempts</th>
                      <th className="py-2.5 text-center">Avg Score</th>
                      <th className="py-2.5 text-center">Pass %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/4">
                    {data.student_performance.length === 0 ? (
                      <tr><td colSpan={4} className="py-8 text-center text-slate-500">No student attempts recorded.</td></tr>
                    ) : (
                      data.student_performance.map((sp) => (
                        <tr key={sp.id} className="text-slate-300 hover:text-white">
                          <td className="py-2.5 font-medium">
                            <div>{sp.name}</div>
                            <div className="text-[9px] text-slate-500 font-normal">{sp.email}</div>
                          </td>
                          <td className="py-2.5 text-center font-semibold text-slate-400">{sp.attempts}</td>
                          <td className="py-2.5 text-center font-bold text-cyan-400">{sp.avg_score}%</td>
                          <td className="py-2.5 text-center font-bold text-emerald-400">{sp.pass_rate}%</td>
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
