"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/StatCard";
import dynamic from "next/dynamic";

const StudentProgressionChart = dynamic(
  () => import("@/components/dashboard/StudentProgressionChart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-52 w-full flex items-center justify-center text-xs text-slate-400 font-bold animate-pulse">
        Loading score progression...
      </div>
    ),
  }
);

import { 
  PlayCircle, 
  Clock, 
  ArrowRight, 
  Lock, 
  CheckCircle, 
  Trophy, 
  Award, 
  TrendingUp, 
  Sparkles, 
  CheckCircle2 
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import api from "@/services/api";
import { toast } from "sonner";


interface TrendItem {
  quiz_title: string;
  percentage: number;
  date: string;
}

interface StudentDashboardData {
  available: any[];
  completed: any[];
  upcoming: any[];
  overview?: {
    total_completed: number;
    avg_percentage: number;
    quizzes_passed: number;
    total_time_spent: number;
    trend: TrendItem[];
  };
}

export default function StudentDashboard() {
  const { currentUser } = useAuth();
  const [studentData, setStudentData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/quizzes/student/dashboard")
      .then(res => {
        setStudentData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        toast.error("Failed to load student dashboard.");
        setLoading(false);
      });
  }, []);

  // Personalized time-of-day greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };
  const greeting = getGreeting();

  const formatTotalTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const successRate = studentData?.overview && studentData.overview.total_completed > 0
    ? Math.round((studentData.overview.quizzes_passed / studentData.overview.total_completed) * 100)
    : 0;

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Student Learning Hub"
        description="Access active quizzes, review your submission records, and track your learning progress."
      />

      {/* Personalized Welcome Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md p-6 md:p-8 shadow-sm"
      >
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-[80px] pointer-events-none" />
        <div className="absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-[80px] pointer-events-none" />
        
        <div className="max-w-2xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive Student Practice Zone</span>
          </div>

          <h2 className="text-3xl md:text-4xl font-extrabold font-display text-slate-900 dark:text-white tracking-tight leading-tight">
            {greeting}, <span className="bg-gradient-to-r from-cyan-500 via-indigo-400 to-indigo-500 bg-clip-text text-transparent">{currentUser?.full_name || "Student"}</span> 👋
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-sm md:text-base font-medium leading-relaxed">
            Ready to test your comprehension? Choose any active assessment below to begin, or review past performance insights to master key concepts.
          </p>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
          <div className="h-9 w-9 rounded-full border-3 border-cyan-500 border-t-transparent animate-spin" />
          <span className="text-xs text-slate-500 font-bold">Synchronizing assessment records...</span>
        </div>
      ) : (
        <>
          {/* Overview Stats Cards */}
          {studentData?.overview && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              <StatCard
                title="Quizzes Completed"
                value={studentData.overview.total_completed}
                description="Total submitted tests"
                icon={<CheckCircle2 className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />}
                glowColor="emerald"
              />
              <StatCard
                title="Average Grade"
                value={`${studentData.overview.avg_percentage}%`}
                description="Overall performance score"
                icon={<Trophy className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />}
                glowColor="cyan"
              />
              <StatCard
                title="Success Rate"
                value={`${successRate}%`}
                description="Quizzes passed on first try"
                icon={<Award className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />}
                glowColor="indigo"
              />
              <StatCard
                title="Practice Time"
                value={formatTotalTime(studentData.overview.total_time_spent)}
                description="Total time engaged in tests"
                icon={<Clock className="h-5 w-5 text-rose-500 dark:text-rose-400" />}
                glowColor="rose"
              />
            </div>
          )}

          {/* Main Dashboard Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Available and Upcoming Quizzes */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Progression Chart */}
              <div className="glass-panel border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-cyan-500" />
                    <span>Learning Curve & Score Progression</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Historical trend of percentage scores achieved across recent quiz attempts.
                  </p>
                </div>
                <div className="h-52 w-full text-xs font-semibold text-slate-400">
                  <StudentProgressionChart trend={studentData?.overview?.trend} />
                </div>
              </div>

              {/* Available Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <PlayCircle className="h-4.5 w-4.5 text-cyan-600 dark:text-cyan-400" />
                  <span>Available Quizzes</span>
                </h3>
                {studentData?.available && studentData.available.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {studentData.available.map((quiz) => (
                      <div
                        key={quiz.id}
                        className="glass-panel border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col justify-between h-[190px] hover:border-cyan-500/40 transition-all shadow-sm group"
                      >
                        <div className="space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                              {quiz.subject}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">
                              Attempts: {quiz.attempts_taken} / {quiz.max_attempts}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                            {quiz.title}
                          </h4>
                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                            {quiz.description || "Comprehensive assessment covering syllabus requirements."}
                          </p>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800">
                          <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-indigo-400" />
                            <span>{quiz.duration} mins</span>
                          </span>
                          <Link href={`/assessment/${quiz.id}`}>
                            <button className={`h-9 px-4 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none ${
                              quiz.has_active_attempt 
                                ? "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white animate-pulse" 
                                : "bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white"
                            }`}>
                              <span>{quiz.has_active_attempt ? "Resume Quiz" : "Start Quiz"}</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="glass-panel border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center text-slate-500 text-xs font-semibold">
                    No assessments currently assigned to your class.
                  </div>
                )}
              </div>

              {/* Scheduled & Upcoming Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Clock className="h-4.5 w-4.5 text-indigo-500 dark:text-indigo-400" />
                  <span>Scheduled & Upcoming</span>
                </h3>
                {studentData?.upcoming && studentData.upcoming.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {studentData.upcoming.map((quiz) => (
                      <div key={quiz.id} className="glass-panel border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col justify-between h-[155px] opacity-80">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                              {quiz.subject}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              <span>Locked</span>
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-200 truncate">{quiz.title}</h4>
                          <div className="text-[11px] text-slate-500 font-medium">
                            Available From: {new Date(quiz.available_from).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold pt-2 border-t border-slate-200 dark:border-slate-800">
                          Unlocks automatically when test window opens.
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="glass-panel border-slate-200 dark:border-slate-800 rounded-3xl p-6 text-center text-slate-500 text-xs font-semibold">
                    No upcoming scheduled assessments.
                  </div>
                )}
              </div>
            </div>

            {/* Completed attempts / results column */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <CheckCircle className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                <span>Recent Completions</span>
              </h3>
              {studentData?.completed && studentData.completed.length > 0 ? (
                <div className="space-y-3.5">
                  {studentData.completed.map((quiz) => (
                    <div key={quiz.id} className="glass-panel border-slate-200 dark:border-slate-800 rounded-3xl p-4.5 space-y-3 shadow-xs">
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 flex-1 pr-2">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{quiz.subject}</span>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate mt-0.5" title={quiz.title}>{quiz.title}</h4>
                        </div>
                        {quiz.missed ? (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            Missed
                          </span>
                        ) : (
                          <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full border ${
                            quiz.best_percentage >= (quiz.pass_percentage || 40)
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                          }`}>
                            {quiz.best_percentage >= (quiz.pass_percentage || 40) ? "Passed" : "Needs Review"}
                          </span>
                        )}
                      </div>

                      {!quiz.missed && (
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-2.5">
                          <span>Highest Score: {quiz.best_score} / {quiz.total_marks}</span>
                          <span className="text-cyan-600 dark:text-cyan-400 font-extrabold text-xs">{quiz.best_percentage}%</span>
                        </div>
                      )}

                      {quiz.completed_at && quiz.attempt_id && (
                        <div className="flex justify-between items-center text-[10px] text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
                          <span>Attempts Taken: {quiz.attempts_taken} / {quiz.max_attempts}</span>
                          <Link href={`/assessment/${quiz.id}?view=results&attemptId=${quiz.attempt_id}`}>
                            <span className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-bold cursor-pointer flex items-center gap-1">
                              <span>Review Result</span>
                              <ArrowRight className="h-3 w-3" />
                            </span>
                          </Link>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-panel border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center text-slate-500 text-xs font-semibold">
                  You haven&apos;t completed any quizzes yet.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
