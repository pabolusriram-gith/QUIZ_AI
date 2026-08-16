"use client";

import React, { useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/services/api";
import { toast } from "sonner";
import {
  FileText,
  
  Filter,
  
  CheckCircle2,
  
  
  RotateCcw,
  
  
  ChevronDown,
  BookOpen,
  
  
  Download,
  Printer
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";

interface AttemptReportItem {
  id: string;
  student_name: string;
  student_email: string;
  quiz_title: string;
  subject: string;
  score: number;
  percentage: number;
  passed: boolean;
  time_spent_seconds: number;
  completed_at: string | null;
  violations: number;
}

interface QuizReportItem {
  id: string;
  title: string;
  subject: string;
  duration: number;
  status: string;
  quiz_code: string;
  department: string | null;
  semester: string | null;
  created_at: string | null;
  attempts_count: number;
  avg_score: number;
  pass_rate: number;
}

interface StudentReportItem {
  id: string;
  name: string;
  email: string;
  department: string;
  semester: string;
  attempts_count: number;
  avg_score: number;
  pass_rate: number;
  total_violations: number;
}

interface ReportData {
  quizzes: QuizReportItem[];
  students: StudentReportItem[];
  attempts: AttemptReportItem[];
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  // Available lookups for filters
  const [quizzesList, setQuizzesList] = useState<{ id: string; title: string }[]>([]);
  const [studentsList, setStudentsList] = useState<{ id: string; name: string }[]>([]);

  // Filter state
  const [filterSubject, setFilterSubject] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterSem, setFilterSem] = useState("");
  const [filterQuizId, setFilterQuizId] = useState("");
  const [filterStudentId, setFilterStudentId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Report View Selection: "attempts" | "quizzes" | "students"
  const [activeTab, setActiveTab] = useState<"attempts" | "quizzes" | "students">("attempts");

  // Load lookup options
  useEffect(() => {
    api.get("/quizzes?limit=100")
      .then((res) => {
        if (res.data && res.data.items) {
          setQuizzesList(res.data.items);
        }
      })
      .catch((err) => console.error("Failed to load filter dropdowns:", err));

    api.get("/quizzes/reports")
      .then((res) => {
        if (res.data && res.data.students) {
          setStudentsList(res.data.students);
        }
      })
      .catch((err) => console.error("Failed to load students list:", err));
  }, []);

  // Fetch Report Data
  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterSubject) params.subject = filterSubject;
      if (filterDept) params.department = filterDept;
      if (filterSem) params.semester = filterSem;
      if (filterQuizId) params.quiz_id = filterQuizId;
      if (filterStudentId) params.student_id = filterStudentId;
      if (startDate) params.start_date = new Date(startDate).toISOString();
      if (endDate) params.end_date = new Date(endDate).toISOString();

      const res = await api.get<ReportData>("/quizzes/reports", { params });
      setData(res.data);
    } catch {
      toast.error("Failed to compile classroom reports.");
    } finally {
      setLoading(false);
    }
  }, [filterSubject, filterDept, filterSem, filterQuizId, filterStudentId, startDate, endDate]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleResetFilters = () => {
    setFilterSubject("");
    setFilterDept("");
    setFilterSem("");
    setFilterQuizId("");
    setFilterStudentId("");
    setStartDate("");
    setEndDate("");
  };

  const hasActiveFilters = !!(filterSubject || filterDept || filterSem || filterQuizId || filterStudentId || startDate || endDate);

  // Format Helper
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins}m ${remaining}s`;
  };

  // Export to Excel / CSV
  const handleExportCSV = () => {
    if (!data) return;
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = "";

    if (activeTab === "attempts") {
      filename = "Quiz_Attempts_Report.csv";
      headers = ["Student Name", "Email", "Quiz Title", "Subject", "Score", "Percentage", "Passed", "Duration", "Completed At", "Proctor Violations"];
      rows = data.attempts.map((a) => [
        a.student_name,
        a.student_email,
        a.quiz_title,
        a.subject,
        a.score.toString(),
        `${a.percentage}%`,
        a.passed ? "YES" : "NO",
        formatTime(a.time_spent_seconds),
        a.completed_at ? new Date(a.completed_at).toLocaleString() : "",
        a.violations.toString()
      ]);
    } else if (activeTab === "quizzes") {
      filename = "Quiz_Performance_Report.csv";
      headers = ["Quiz Title", "Subject", "Code", "Duration (mins)", "Total Attempts", "Average Score", "Pass Rate", "Department", "Semester"];
      rows = data.quizzes.map((q) => [
        q.title,
        q.subject,
        q.quiz_code,
        q.duration.toString(),
        q.attempts_count.toString(),
        `${q.avg_score}%`,
        `${q.pass_rate}%`,
        q.department ?? "",
        q.semester ?? ""
      ]);
    } else {
      filename = "Student_Completions_Report.csv";
      headers = ["Student Name", "Email", "Department", "Semester", "Quizzes Attempted", "Average Grade", "Pass Rate", "Total Anti-Cheat Logs"];
      rows = data.students.map((s) => [
        s.name,
        s.email,
        s.department,
        s.semester,
        s.attempts_count.toString(),
        `${s.avg_score}%`,
        `${s.pass_rate}%`,
        s.total_violations.toString()
      ]);
    }

    // Build CSV Content
    const csvContent = [
      headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","),
      ...rows.map((row) => row.map((val) => `"${val.replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`${filename} exported successfully.`);
  };

  // Export/Print PDF using print CSS layout
  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 print:p-0 print:space-y-4 print:text-black">
      {/* Hide header on print view */}
      <div className="print:hidden">
        <PageHeader
          title="Classroom Reports"
          description="Compile and export quiz summaries, student performance matrices, and cheat violations."
          actions={
            <div className="flex gap-2">
              <button onClick={handlePrintPDF} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-foreground bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl border border-border transition cursor-pointer">
                <Printer className="h-4 w-4" />Print PDF
              </button>
              <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition cursor-pointer">
                <Download className="h-4 w-4" />Export Excel / CSV
              </button>
            </div>
          }
        />
      </div>

      {/* Print only header */}
      <div className="hidden print:block border-b-2 border-black pb-4 mb-6">
        <h1 className="text-2xl font-bold font-display">QuizVerseAI Classroom Report</h1>
        <p className="text-xs text-slate-600 mt-1">Generated on {new Date().toLocaleString()}</p>
      </div>

      {/* Filters Toolbar */}
      <div className="glass-panel rounded-2xl p-4 space-y-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${showFilters || hasActiveFilters ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400" : "bg-slate-50 dark:bg-white/4 border-border text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-white/8"}`}>
              <Filter className="h-3.5 w-3.5" />
              Filter Reports
              <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </button>
            {hasActiveFilters && (
              <button onClick={handleResetFilters} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-white/4 border border-border text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-white/8 transition-colors cursor-pointer">
                <RotateCcw className="h-3.5 w-3.5" />Reset
              </button>
            )}
          </div>
        </div>
 
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                {/* Subject Selector */}
                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Subject</label>
                  <Input value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} placeholder="e.g. Science" className="bg-slate-50 dark:bg-white/4 border-border text-foreground h-9 text-xs focus:border-indigo-500/50" />
                </div>
 
                {/* Quiz Selector */}
                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Quiz</label>
                  <select value={filterQuizId} onChange={(e) => setFilterQuizId(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/4 border border-border text-foreground focus:outline-none focus:border-indigo-500/50 transition cursor-pointer">
                    <option value="" className="bg-popover text-popover-foreground">All Quizzes</option>
                    {quizzesList.map((q) => (
                      <option key={q.id} value={q.id} className="bg-popover text-popover-foreground">{q.title}</option>
                    ))}
                  </select>
                </div>
 
                {/* Student Selector */}
                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Student</label>
                  <select value={filterStudentId} onChange={(e) => setFilterStudentId(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/4 border border-border text-foreground focus:outline-none focus:border-indigo-500/50 transition cursor-pointer">
                    <option value="" className="bg-popover text-popover-foreground">All Students</option>
                    {studentsList.map((s) => (
                      <option key={s.id} value={s.id} className="bg-popover text-popover-foreground">{s.name}</option>
                    ))}
                  </select>
                </div>
 
                {/* Department */}
                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Department</label>
                  <Input value={filterDept} onChange={(e) => setFilterDept(e.target.value)} placeholder="e.g. CS" className="bg-slate-50 dark:bg-white/4 border-border text-foreground h-9 text-xs focus:border-indigo-500/50" />
                </div>
 
                {/* Semester */}
                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Semester</label>
                  <Input value={filterSem} onChange={(e) => setFilterSem(e.target.value)} placeholder="e.g. Autumn" className="bg-slate-50 dark:bg-white/4 border-border text-foreground h-9 text-xs focus:border-indigo-500/50" />
                </div>
 
                {/* Start Date */}
                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">From Date</label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-slate-50 dark:bg-white/4 border-border text-foreground h-9 text-xs focus:border-indigo-500/50" />
                </div>
 
                {/* End Date */}
                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">To Date</label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-slate-50 dark:bg-white/4 border-border text-foreground h-9 text-xs focus:border-indigo-500/50" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tabs list (hidden on print) */}
      <div className="flex border-b border-border gap-4 print:hidden">
        {[
          { key: "attempts", label: "Quiz Attempts" },
          { key: "quizzes", label: "Quiz Performances" },
          { key: "students", label: "Student Matrices" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`pb-3 font-semibold text-xs tracking-wider uppercase border-b-2 transition-all cursor-pointer ${activeTab === t.key ? "border-indigo-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Main loading view */}
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full bg-black/5 dark:bg-white/5 border border-border" variant="glass" />
            ))}
          </div>
          <Skeleton className="h-96 w-full bg-black/5 dark:bg-white/5 border border-border" variant="glass" />
        </div>
      ) : !data ? (
        <div className="glass-panel rounded-2xl py-16 text-center text-muted-foreground">Failed to compile reports.</div>
      ) : (
        <div className="space-y-6">
          
          {/* Quick stats totals */}
          <div className="grid grid-cols-3 gap-4 print:hidden">
            <StatCard title="Total Attempts" value={data.attempts.length} icon={<FileText className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />} glowColor="indigo" />
            <StatCard title="Total Quizzes" value={data.quizzes.length} icon={<BookOpen className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />} glowColor="cyan" />
            <StatCard title="Total Students" value={data.students.length} icon={<CheckCircle2 className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />} glowColor="emerald" />
          </div>
 
          {/* TABLE DISPLAY */}
          <div className="glass-panel rounded-2xl overflow-hidden border-border print:bg-white print:border-none print:shadow-none">
            
            {/* View Title */}
            <div className="px-5 py-4 border-b border-border print:border-black/10">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider print:text-black print:text-sm">
                {activeTab === "attempts" && "Detailed Attempts Summary"}
                {activeTab === "quizzes" && "Detailed Quiz Performance Summary"}
                {activeTab === "students" && "Detailed Student Performance Summary"}
              </h3>
            </div>

            {/* Content Table */}
            <div className="overflow-x-auto">
              
              {/* Attempt report table */}
              {activeTab === "attempts" && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-muted-foreground print:text-black text-[10px] font-bold uppercase border-b border-border print:border-black/20">
                      <th className="px-5 py-3">Student</th>
                      <th className="py-3">Quiz</th>
                      <th className="py-3">Subject</th>
                      <th className="py-3 text-center">Score</th>
                      <th className="py-3 text-center">Result</th>
                      <th className="py-3 text-center">Duration</th>
                      <th className="py-3 text-center">Violations</th>
                      <th className="px-5 py-3">Completed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border print:divide-black/10">
                    {data.attempts.length === 0 ? (
                      <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">No raw quiz attempts match the filters.</td></tr>
                    ) : (
                      data.attempts.map((a) => (
                        <tr key={a.id} className="text-foreground/85 hover:text-foreground print:text-slate-700">
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-foreground print:text-black">{a.student_name}</div>
                            <div className="text-[10px] text-muted-foreground font-normal">{a.student_email}</div>
                          </td>
                          <td className="py-3.5 font-medium">{a.quiz_title}</td>
                          <td className="py-3.5 text-muted-foreground">{a.subject}</td>
                          <td className="py-3.5 text-center font-bold text-cyan-600 dark:text-cyan-400">{a.percentage}%</td>
                          <td className="py-3.5 text-center font-semibold">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${a.passed ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"}`}>{a.passed ? "Pass" : "Fail"}</span>
                          </td>
                          <td className="py-3.5 text-center text-muted-foreground">{formatTime(a.time_spent_seconds)}</td>
                          <td className="py-3.5 text-center font-bold text-amber-500 dark:text-amber-400">{a.violations}</td>
                          <td className="px-5 py-3.5 text-muted-foreground">{a.completed_at ? new Date(a.completed_at).toLocaleString() : "Unknown"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* Quiz report table */}
              {activeTab === "quizzes" && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-muted-foreground print:text-black text-[10px] font-bold uppercase border-b border-border print:border-black/20">
                      <th className="px-5 py-3">Quiz Details</th>
                      <th className="py-3">Subject</th>
                      <th className="py-3 text-center">Quiz Code</th>
                      <th className="py-3 text-center">Duration</th>
                      <th className="py-3 text-center">Plays</th>
                      <th className="py-3 text-center">Avg score</th>
                      <th className="py-3 text-center">Pass rate</th>
                      <th className="px-5 py-3">Created Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border print:divide-black/10">
                    {data.quizzes.length === 0 ? (
                      <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">No quizzes matched.</td></tr>
                    ) : (
                      data.quizzes.map((q) => (
                        <tr key={q.id} className="text-foreground/85 hover:text-foreground print:text-slate-700">
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-foreground print:text-black">{q.title}</div>
                            <div className="text-[10px] text-muted-foreground font-normal">{q.department || "General"} | {q.semester || "General"}</div>
                          </td>
                          <td className="py-3.5 text-muted-foreground">{q.subject}</td>
                          <td className="py-3.5 text-center text-indigo-600 dark:text-indigo-400 font-bold">{q.quiz_code}</td>
                          <td className="py-3.5 text-center text-muted-foreground">{q.duration} mins</td>
                          <td className="py-3.5 text-center text-muted-foreground font-bold">{q.attempts_count}</td>
                          <td className="py-3.5 text-center text-cyan-600 dark:text-cyan-400 font-black">{q.avg_score}%</td>
                          <td className="py-3.5 text-center text-emerald-600 dark:text-emerald-400 font-black">{q.pass_rate}%</td>
                          <td className="px-5 py-3.5 text-muted-foreground">{q.created_at ? new Date(q.created_at).toLocaleDateString() : ""}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* Students report table */}
              {activeTab === "students" && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-muted-foreground print:text-black text-[10px] font-bold uppercase border-b border-border print:border-black/20">
                      <th className="px-5 py-3">Student Name</th>
                      <th className="py-3">Email</th>
                      <th className="py-3">Dept / Sem</th>
                      <th className="py-3 text-center">Quizzes Taken</th>
                      <th className="py-3 text-center">Avg Grade</th>
                      <th className="py-3 text-center">Pass %</th>
                      <th className="px-5 py-3 text-center">Total Violations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border print:divide-black/10">
                    {data.students.length === 0 ? (
                      <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">No students recorded matching filters.</td></tr>
                    ) : (
                      data.students.map((s) => (
                        <tr key={s.id} className="text-foreground/85 hover:text-foreground print:text-slate-700">
                          <td className="px-5 py-3.5 font-semibold text-foreground print:text-black">{s.name}</td>
                          <td className="py-3.5 text-muted-foreground">{s.email}</td>
                          <td className="py-3.5 text-muted-foreground">{s.department} | {s.semester}</td>
                          <td className="py-3.5 text-center text-muted-foreground font-bold">{s.attempts_count}</td>
                          <td className="py-3.5 text-center text-cyan-600 dark:text-cyan-400 font-black">{s.avg_score}%</td>
                          <td className="py-3.5 text-center text-emerald-600 dark:text-emerald-400 font-black">{s.pass_rate}%</td>
                          <td className="px-5 py-3.5 text-center text-rose-600 dark:text-rose-400 font-bold">{s.total_violations}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
