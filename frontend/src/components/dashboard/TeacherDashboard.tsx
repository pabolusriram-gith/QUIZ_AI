"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import dynamic from "next/dynamic";
import { 
  Sparkles, 
  Plus, 
  GraduationCap, 
  PenTool, 
  Layers, 
  PlayCircle, 
  Clock, 
  ArrowRight, 
  FileText,
  FileDown,
  ListTodo,
  UploadCloud
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import api from "@/services/api";
import { toast } from "sonner";
import ImportQuestionBankModal from "@/components/modals/ImportQuestionBankModal";

const ChartCard = dynamic(() => import("@/components/ui/ChartCard"), {
  ssr: false,
  loading: () => (
    <div className="h-72 w-full rounded-3xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 animate-pulse flex items-center justify-center text-xs text-slate-400 font-bold">
      Loading chart analytics...
    </div>
  ),
});

interface DashboardData {
  manual_quizzes: number;
  ai_quizzes: number;
  question_bank: number;
  total_plays: number;
  performance_data: Array<{ name: string; Manual: number; AI: number; Plays: number }>;
  recent_activities: Array<{
    id: string;
    type: "manual" | "ai" | "play";
    title: string;
    timestamp: string;
    status: string;
  }>;
}

export default function TeacherDashboard() {
  const { currentUser } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);

  const teacherName = currentUser?.full_name || "Educator";

  const fetchDashboardData = () => {
    api.get("/quizzes/teacher/dashboard")
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        toast.error("Failed to load teacher dashboard statistics.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Time-of-day greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };
  const greeting = getGreeting();

  const totalQuizzes = data ? (data.manual_quizzes + data.ai_quizzes) : 0;

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Dashboard"
        description="Comprehensive overview of your classroom assessments, questions, and student engagement."
        actions={
          <Link
            href="/create-quiz"
            className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold rounded-2xl px-5 h-11 flex items-center gap-2 shadow-sm shadow-indigo-600/20 border-none cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:outline-none"
          >
            <Plus className="h-4.5 w-4.5" />
            <span>Create Quiz</span>
          </Link>
        }
      />

      {/* --- Personalized Welcome Hero Section --- */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-100/50 dark:bg-slate-900/60 backdrop-blur-md p-6 md:p-8 shadow-sm"
      >
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-[80px] pointer-events-none" />
        <div className="absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-[80px] pointer-events-none" />
        
        <div className="max-w-2xl space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-Powered Assessment & Examination Platform</span>
          </div>

          <h2 className="text-3xl md:text-4xl font-extrabold font-display text-slate-900 dark:text-white tracking-tight leading-tight">
            {greeting}, <span className="bg-gradient-to-r from-indigo-500 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">{teacherName}</span> 👋
          </h2>

          <p className="text-slate-600 dark:text-slate-300 text-sm md:text-base font-medium leading-relaxed">
            Ready to design your next quiz? Compose custom questions with detailed explanations or let the AI generate high-quality assessments in seconds.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link
              href="/create-quiz"
              className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-100/90 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 hover:bg-slate-200/90 dark:hover:bg-slate-700 active:bg-slate-300/80 dark:active:bg-slate-600 font-bold px-4 h-10 flex items-center cursor-pointer shadow-xs transition-all focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
            >
              <PenTool className="h-4 w-4 mr-1.5 text-indigo-500" />
              <span>Create Assessment</span>
            </Link>
            <div className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl">
              <GraduationCap className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <span>Role: {currentUser?.role?.toUpperCase() || "TEACHER"}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {loading ? (
        // Premium skeleton loading state
        <div className="space-y-8 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[...Array(4)].map((_, idx) => (
              <div key={idx} className="h-28 rounded-3xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-[320px] rounded-3xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800" />
            <div className="h-[320px] rounded-3xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800" />
          </div>
        </div>
      ) : totalQuizzes === 0 ? (
        // Proper Empty State if Teacher has no Quizzes
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="glass-panel border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-5"
        >
          <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Layers className="h-8 w-8" />
          </div>
          <div className="space-y-2 max-w-sm">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white font-display">Create your first quiz</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Your educator workspace is ready! Generate highly customized questions using our AI generator or draft assessments manually to get started.
            </p>
          </div>
          <Link
            href="/create-quiz"
            className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold px-6 h-11 rounded-2xl shadow-md shadow-indigo-600/20 cursor-pointer flex items-center gap-2 transition-all focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:outline-none"
          >
            <Plus className="h-4.5 w-4.5" />
            <span>Create First Quiz</span>
          </Link>
        </motion.div>
      ) : (
        // Dynamic dashboard if educator has quizzes
        <>
          {/* --- Quiz Statistics Summary Row --- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <StatCard
              title="Manual Quizzes"
              value={data ? String(data.manual_quizzes) : "0"}
              description="Teacher crafted assessments"
              icon={<PenTool className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />}
              glowColor="indigo"
            />
            <StatCard
              title="AI Quizzes"
              value={data ? String(data.ai_quizzes) : "0"}
              description="AI assisted generation drafts"
              icon={<Sparkles className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />}
              glowColor="cyan"
            />
            <StatCard
              title="Question Bank"
              value={data ? String(data.question_bank) : "0"}
              description="Total active database items"
              icon={<Layers className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />}
              glowColor="emerald"
            />
            <StatCard
              title="Total Plays"
              value={data ? String(data.total_plays) : "0"}
              description="Student quiz attempts"
              icon={<PlayCircle className="h-5 w-5 text-rose-500 dark:text-rose-400" />}
              glowColor="rose"
            />
          </div>

          {/* --- Quick Actions Grid --- */}
          <div className="glass-panel border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-display tracking-tight">
                Quick Actions
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Build assessments manually, generate with AI, or manage your Question Bank.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* Primary CTA */}
              <Link 
                href="/create-quiz" 
                className="sm:col-span-2 lg:col-span-1 w-full h-[56px] px-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 active:from-indigo-700 active:to-cyan-700 text-white font-bold text-sm flex items-center justify-between cursor-pointer transition-all shadow-md shadow-indigo-600/15 hover:shadow-indigo-600/25 hover:-translate-y-px group focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
              >
                <span className="flex items-center gap-2.5">
                  <PenTool className="h-4 w-4 shrink-0" />
                  <span>Create Quiz Manually</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 opacity-80 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              {/* AI Question Generator */}
              <Link 
                href="/create-quiz" 
                className="w-full h-[56px] px-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 hover:bg-slate-200/70 active:bg-slate-200 dark:bg-slate-900/60 dark:hover:bg-slate-800/80 dark:active:bg-slate-800 hover:border-cyan-500/40 dark:hover:border-cyan-500/40 text-slate-800 dark:text-slate-100 font-bold text-sm flex items-center justify-between cursor-pointer transition-all group shadow-xs focus-visible:ring-2 focus-visible:ring-cyan-500/40 focus-visible:outline-none"
              >
                <span className="flex items-center gap-2.5">
                  <Sparkles className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                  <span>AI Question Generator</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              {/* Generate from Document (PDF) */}
              <Link 
                href="/create-quiz?source=file" 
                className="w-full h-[56px] px-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 hover:bg-slate-200/70 active:bg-slate-200 dark:bg-slate-900/60 dark:hover:bg-slate-800/80 dark:active:bg-slate-800 hover:border-indigo-500/40 dark:hover:border-indigo-500/40 text-slate-800 dark:text-slate-100 font-bold text-sm flex items-center justify-between cursor-pointer transition-all group shadow-xs focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
              >
                <span className="flex items-center gap-2.5">
                  <FileText className="h-4 w-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
                  <span>Generate from Document (PDF)</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              {/* Generate from Slides (PPT) */}
              <Link 
                href="/create-quiz?source=file" 
                className="w-full h-[56px] px-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 hover:bg-slate-200/70 active:bg-slate-200 dark:bg-slate-900/60 dark:hover:bg-slate-800/80 dark:active:bg-slate-800 hover:border-cyan-500/40 dark:hover:border-cyan-500/40 text-slate-800 dark:text-slate-100 font-bold text-sm flex items-center justify-between cursor-pointer transition-all group shadow-xs focus-visible:ring-2 focus-visible:ring-cyan-500/40 focus-visible:outline-none"
              >
                <span className="flex items-center gap-2.5">
                  <Layers className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                  <span>Generate from Slides (PPT)</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              {/* Manage Question Bank */}
              <Link 
                href="/dashboard/question-bank" 
                className="w-full h-[56px] px-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 hover:bg-slate-200/70 active:bg-slate-200 dark:bg-slate-900/60 dark:hover:bg-slate-800/80 dark:active:bg-slate-800 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 text-slate-800 dark:text-slate-100 font-bold text-sm flex items-center justify-between cursor-pointer transition-all group shadow-xs focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:outline-none"
              >
                <span className="flex items-center gap-2.5">
                  <ListTodo className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Manage Question Bank</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              {/* Import Action (Active Interactive Presentation) */}
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="w-full h-[56px] px-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 hover:bg-slate-200/70 active:bg-slate-200 dark:bg-slate-900/60 dark:hover:bg-slate-800/80 dark:active:bg-slate-800 hover:border-indigo-500/40 dark:hover:border-indigo-500/40 text-slate-800 dark:text-slate-100 font-bold text-sm flex items-center justify-between cursor-pointer transition-all group shadow-xs focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
                title="Import questions from CSV or JSON into your assessments"
              >
                <span className="flex items-center gap-2.5">
                  <UploadCloud className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>Import Question Bank</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* --- Engagement Analytics Charts & Suggested Next Steps --- */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ChartCard
                title="Classroom Engagement History"
                description="Comparison of student response plays versus quiz drafts."
                data={data?.performance_data || []}
                xDataKey="name"
                yDataKey="Plays"
                yDataKey2="AI"
                glowColor="indigo"
              />
            </div>

            {/* Suggested Next Steps */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="glass-panel border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col justify-between"
            >
              <div>
                <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Suggested Next Steps
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Recommended workflow actions for active courses.
                  </p>
                </div>

                <div className="space-y-2.5 my-4">
                  <Link
                    href="/create-quiz"
                    className="flex items-start gap-3 p-3 rounded-2xl bg-slate-100/70 dark:bg-slate-800/50 hover:bg-slate-200/70 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700/70 border border-slate-200/70 dark:border-slate-700/60 transition-all cursor-pointer group focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
                  >
                    <div className="h-8 w-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                      <PenTool className="h-3.5 w-3.5" />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-cyan-400 transition-colors">
                        Draft Structured Assessment
                      </h5>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Configure questions with custom time limits and negative marks.
                      </p>
                    </div>
                  </Link>

                  <Link
                    href="/create-quiz"
                    className="flex items-start gap-3 p-3 rounded-2xl bg-slate-100/70 dark:bg-slate-800/50 hover:bg-slate-200/70 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700/70 border border-slate-200/70 dark:border-slate-700/60 transition-all cursor-pointer group focus-visible:ring-2 focus-visible:ring-cyan-500/40 focus-visible:outline-none"
                  >
                    <div className="h-8 w-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                        Launch AI Question Generator
                      </h5>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Provide topic constraints to generate varied questions instantly.
                      </p>
                    </div>
                  </Link>
                </div>
              </div>

              <Link 
                href="/create-quiz" 
                className="w-full mt-2 h-10 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/60 dark:hover:border-indigo-500/60 bg-slate-100/90 dark:bg-slate-800/80 hover:bg-slate-200/90 dark:hover:bg-slate-700 active:bg-slate-300/80 dark:active:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
              >
                <span>Open Quiz Creator</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </motion.div>
          </div>

          {/* --- Recent Activity Row --- */}
          {data?.recent_activities && data.recent_activities.length > 0 && (
            <div className="glass-panel border-slate-200 dark:border-slate-800 rounded-3xl p-6">
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-display tracking-tight mb-4">
                Recent Activity & Submissions
              </h3>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {data.recent_activities.map((act) => (
                  <div key={act.id} className="py-3.5 first:pt-0 last:pb-0 flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-900 dark:text-white">{act.title}</h5>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                          {new Date(act.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      act.type === "play"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : act.type === "ai"
                        ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20"
                        : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
                    }`}>
                      {act.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Import Question Bank Modal */}
      <ImportQuestionBankModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={() => {
          fetchDashboardData();
        }}
      />
    </div>
  );
}
