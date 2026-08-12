"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/layout/PageHeader";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatCard } from "@/components/ui/StatCard";
import { ChartCard } from "@/components/ui/ChartCard";
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
  ListTodo
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import api from "@/services/api";
import { toast } from "sonner";

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

  const teacherName = currentUser?.full_name || "Educator";

  useEffect(() => {
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
    <div className="space-y-8 pb-10">
      {/* Page Header */}
      <PageHeader
        title="Dashboard"
        description="Overview of your classroom learning workspace."
        actions={
          <Link
            href="/create-quiz"
            className={buttonVariants({ className: "bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl px-5 h-11 flex items-center gap-2 brand-button-glow border-none cursor-pointer" })}
          >
            <Plus className="h-4.5 w-4.5" />
            <span>Create Quiz</span>
          </Link>
        }
      />

      {/* --- Personalized Welcome Hero Section --- */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl border border-white/5 bg-slate-900/10 backdrop-blur-md p-6 md:p-8"
      >
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-[80px] pointer-events-none" />
        <div className="absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-[80px] pointer-events-none" />
        
        <div className="max-w-2xl space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-cyan-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>Dual Assessment Workspace v2.0</span>
          </div>

          <h2 className="text-3xl md:text-4xl font-extrabold font-display text-white tracking-tight leading-tight">
            {greeting}, <span className="brand-text-gradient">{teacherName}</span> 👋
          </h2>

          <p className="text-slate-400 text-sm md:text-base font-medium leading-relaxed">
            Ready to create your next assessment? Create your own questions from scratch or let AI help you generate them in seconds.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              href="/create-quiz"
              className={buttonVariants({ variant: "outline", className: "rounded-xl border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 font-semibold px-4 cursor-pointer h-10 border" })}
            >
              Create Assessment
            </Link>
            <div className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-500 bg-white/3 border border-white/5 rounded-xl">
              <GraduationCap className="h-4 w-4 text-cyan-400" />
              <span>Role: {currentUser?.role || "Teacher"}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {loading ? (
        // Premium skeleton loading state
        <div className="space-y-8 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[...Array(4)].map((_, idx) => (
              <div key={idx} className="h-28 rounded-2xl bg-white/3 border border-white/5" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-[320px] rounded-2xl bg-white/3 border border-white/5" />
            <div className="h-[320px] rounded-2xl bg-white/3 border border-white/5" />
          </div>
        </div>
      ) : totalQuizzes === 0 ? (
        // Proper Empty State if Teacher has no Quizzes
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="glass-panel border-white/10 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-6"
        >
          <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Layers className="h-8 w-8 animate-bounce" />
          </div>
          <div className="space-y-2 max-w-sm">
            <h3 className="text-xl font-extrabold text-white">Create your first quiz.</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your dashboard is ready! Generate highly customized questions using our AI generator or draft assessments manually to get started.
            </p>
          </div>
          <Link href="/create-quiz">
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 h-11 rounded-xl shadow-lg shadow-indigo-500/20 cursor-pointer border-none flex items-center gap-2">
              <Plus className="h-4.5 w-4.5" />
              <span>Create First Quiz</span>
            </Button>
          </Link>
        </motion.div>
      ) : (
        // Dynamic dashboard if educator has quizzes
        <>
          {/* --- Quiz Statistics Summary Row --- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard
              title="Manual Quizzes"
              value={data ? String(data.manual_quizzes) : "0"}
              description="Manually created quizzes"
              icon={<PenTool className="h-5 w-5 text-indigo-400" />}
              glowColor="indigo"
            />
            <StatCard
              title="AI Quizzes"
              value={data ? String(data.ai_quizzes) : "0"}
              description="AI assisted generation drafts"
              icon={<Sparkles className="h-5 w-5 text-cyan-400" />}
              glowColor="cyan"
            />
            <StatCard
              title="Question Bank"
              value={data ? String(data.question_bank) : "0"}
              description="Total active database items"
              icon={<Layers className="h-5 w-5 text-emerald-400" />}
              glowColor="emerald"
            />
            <StatCard
              title="Total Plays"
              value={data ? String(data.total_plays) : "0"}
              description="Student participations"
              icon={<PlayCircle className="h-5 w-5 text-rose-400" />}
              glowColor="rose"
            />
          </div>

          {/* --- Suggested Actions & Quick Actions Grid --- */}
          <div className="glass-panel border-white/5 rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white font-display tracking-tight">Quick Actions & Suggestions</h3>
              <p className="text-xs text-slate-400 mt-1">Create quizzes manually, use the AI helper, or manage your question records.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <Link href="/create-quiz" className="w-full">
                <button className="w-full h-12 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold text-xs flex items-center justify-between cursor-pointer transition-all shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 group">
                  <span className="flex items-center gap-2">
                    <PenTool className="h-4 w-4 shrink-0" />
                    <span>Create Quiz Manually</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 opacity-70 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </Link>

              <Link href="/create-quiz" className="w-full">
                <button className="w-full h-12 px-4 rounded-xl border border-white/10 bg-white/4 hover:bg-white/10 hover:border-cyan-500/30 text-slate-200 font-semibold text-xs flex items-center justify-between cursor-pointer transition-all group">
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-400 shrink-0" />
                    <span>AI Question Generator</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 opacity-70 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </Link>

              <button className="w-full h-12 px-4 rounded-xl border border-white/5 bg-white/3 text-slate-400 font-semibold text-xs flex items-center justify-between cursor-not-allowed select-none">
                <span className="flex items-center gap-2">
                  <FileDown className="h-4 w-4 text-slate-500 shrink-0" />
                  <span>Import Question Bank</span>
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-white/5 px-2 py-0.5 rounded-md">Soon</span>
              </button>

              <Link href="/create-quiz?source=file" className="w-full">
                <button className="w-full h-12 px-4 rounded-xl border border-white/5 bg-white/3 hover:bg-white/8 text-slate-300 font-semibold text-xs flex items-center justify-between cursor-pointer transition-all group">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-indigo-400 shrink-0" />
                    <span>Generate from PDF</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 opacity-70 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </Link>

              <Link href="/create-quiz?source=file" className="w-full">
                <button className="w-full h-12 px-4 rounded-xl border border-white/5 bg-white/3 hover:bg-white/8 text-slate-300 font-semibold text-xs flex items-center justify-between cursor-pointer transition-all group">
                  <span className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-cyan-400 shrink-0" />
                    <span>Generate from PPT</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 opacity-70 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </Link>

              <Link href="/dashboard/question-bank" className="w-full">
                <button className="w-full h-12 px-4 rounded-xl border border-white/5 bg-white/3 hover:bg-white/8 text-slate-300 font-semibold text-xs flex items-center justify-between cursor-pointer transition-all group">
                  <span className="flex items-center gap-2">
                    <ListTodo className="h-4 w-4 text-cyan-400 shrink-0" />
                    <span>Manage Existing Questions</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 opacity-70 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </Link>
            </div>
          </div>

          {/* --- Engagement Analytics Charts Card --- */}
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

            {/* AI Suggestions / Suggested Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: "easeOut", delay: 0.1 }}
              className="glass-panel border-white/5 rounded-2xl p-6 flex flex-col justify-between"
            >
              <div>
                <h3 className="text-lg font-bold text-white font-display tracking-tight">Suggested Actions</h3>
                <p className="text-xs text-slate-400 mt-1">Recommended workflow options based on current activity.</p>
              </div>

              <div className="space-y-4 my-6">
                <Link href="/create-quiz" className="block p-3.5 rounded-xl bg-white/3 hover:bg-white/5 border border-white/5 transition-colors cursor-pointer group flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                    <PenTool className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors">Assemble MCQ Manually</h5>
                    <p className="text-[10px] text-slate-400 leading-normal">Draft questions line-by-line using standard form grids.</p>
                  </div>
                </Link>

                <Link href="/create-quiz" className="block p-3.5 rounded-xl bg-white/3 hover:bg-white/5 border border-white/5 transition-colors cursor-pointer group flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors">Launch Topic AI Generator</h5>
                    <p className="text-[10px] text-slate-400 leading-normal">Input custom criteria keys to auto-generate question papers.</p>
                  </div>
                </Link>
              </div>

              <Link href="/create-quiz" className="w-full">
                <Button className="w-full h-10 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all">
                  <span>Launch Quiz Builder</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </motion.div>
          </div>

          {/* --- Recent Activity Row --- */}
          {data?.recent_activities && data.recent_activities.length > 0 && (
            <div className="glass-panel border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white font-display tracking-tight mb-4">Recent Activity & History</h3>
              <div className="divide-y divide-white/5">
                {data.recent_activities.map((act) => (
                  <div key={act.id} className="py-4 first:pt-0 last:pb-0 flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="h-9 w-9 rounded-xl bg-white/4 border border-white/5 flex items-center justify-center text-slate-300">
                        <Clock className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-200">{act.title}</h5>
                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                          {new Date(act.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/5 ${
                      act.type === "play"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : (act.type === "ai" ? "bg-cyan-500/10 text-cyan-400" : "bg-indigo-500/10 text-indigo-400")
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
    </div>
  );
}
