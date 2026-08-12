"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { 
  PlayCircle, 
  Clock, 
  ArrowRight, 
  Lock, 
  CheckCircle 
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import api from "@/services/api";
import { toast } from "sonner";

export default function StudentDashboard() {
  const { currentUser } = useAuth();
  const [studentData, setStudentData] = useState<{
    available: any[];
    completed: any[];
    upcoming: any[];
  } | null>(null);
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

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title="Student Quiz Dashboard"
        description="Access your assessments, review grades, and track your learning progress."
      />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl border border-white/5 bg-slate-900/10 backdrop-blur-md p-6 md:p-8"
      >
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-[80px] pointer-events-none" />
        <div className="max-w-2xl space-y-3 relative z-10">
          <h2 className="text-3xl font-extrabold font-display text-white tracking-tight">
            {greeting}, <span className="brand-text-gradient">{currentUser?.full_name || "Student"}</span> 👋
          </h2>
          <p className="text-slate-400 text-sm font-medium">
            Ready to test your knowledge? Choose any active assessment below, or resume an in-progress session to continue.
          </p>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
          <span className="text-xs text-slate-500 font-bold">Synchronizing assessment records...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Available and Upcoming Quizzes */}
          <div className="lg:col-span-2 space-y-8">
            {/* Available Section */}
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <PlayCircle className="h-4.5 w-4.5 text-cyan-400 animate-pulse" />
                <span>Available Quizzes</span>
              </h3>
              {studentData?.available && studentData.available.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {studentData.available.map((quiz) => (
                    <div key={quiz.id} className="glass-panel border-white/5 rounded-2xl p-5 flex flex-col justify-between h-[180px] hover:border-cyan-500/30 transition-colors group">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[10px] font-bold text-cyan-400 px-2 py-0.5 rounded-full bg-cyan-500/10">
                            {quiz.subject}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold">
                            Attempts: {quiz.attempts_taken} / {quiz.max_attempts}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white truncate group-hover:text-cyan-300 transition-colors">{quiz.title}</h4>
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{quiz.description || "No description provided."}</p>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-white/5">
                        <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{quiz.duration} min</span>
                        </span>
                        <Link href={`/assessment/${quiz.id}`}>
                          <Button className={`h-8 px-4 text-xs font-semibold rounded-lg cursor-pointer flex items-center gap-1.5 ${
                            quiz.has_active_attempt 
                              ? "bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse" 
                              : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
                          }`}>
                            <span>{quiz.has_active_attempt ? "Resume Quiz" : "Start Quiz"}</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-panel border-white/5 rounded-2xl p-8 text-center text-slate-500 text-xs font-semibold">
                  No quizzes assigned yet.
                </div>
              )}
            </div>

            {/* Upcoming Section */}
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="h-4.5 w-4.5 text-indigo-400" />
                <span>Scheduled & Upcoming</span>
              </h3>
              {studentData?.upcoming && studentData.upcoming.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {studentData.upcoming.map((quiz) => (
                    <div key={quiz.id} className="glass-panel border-white/5 rounded-2xl p-5 flex flex-col justify-between h-[150px] opacity-75">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-indigo-400 px-2 py-0.5 rounded-full bg-indigo-500/10">
                            {quiz.subject}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            <span>Locked</span>
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-300 truncate">{quiz.title}</h4>
                        <div className="text-[10px] text-slate-500 font-bold">
                          Starts: {new Date(quiz.available_from).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-[10px] text-indigo-300/80 font-bold pt-2 border-t border-white/5">
                        Unlocks automatically when start window is reached.
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-panel border-white/5 rounded-2xl p-6 text-center text-slate-500 text-xs font-semibold">
                  No upcoming scheduled assessments.
                </div>
              )}
            </div>
          </div>

          {/* Completed attempts / results column */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <CheckCircle className="h-4.5 w-4.5 text-emerald-400" />
              <span>Recent Completions</span>
            </h3>
            {studentData?.completed && studentData.completed.length > 0 ? (
              <div className="space-y-4">
                {studentData.completed.map((quiz) => (
                  <div key={quiz.id} className="glass-panel border-white/5 rounded-2xl p-4.5 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{quiz.subject}</span>
                        <h4 className="text-xs font-bold text-white truncate mt-0.5" title={quiz.title}>{quiz.title}</h4>
                      </div>
                      {quiz.missed ? (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Missed
                        </span>
                      ) : (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${
                          quiz.best_percentage >= (quiz.pass_percentage || 40)
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}>
                          {quiz.best_percentage >= (quiz.pass_percentage || 40) ? "Pass" : "Fail"}
                        </span>
                      )}
                    </div>

                    {!quiz.missed && (
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold bg-white/1.5 border border-white/5 rounded-xl p-2.5">
                        <span>Highest Score: {quiz.best_score} / {quiz.total_marks}</span>
                        <span className="text-cyan-400">{quiz.best_percentage}%</span>
                      </div>
                    )}

                    {quiz.completed_at && quiz.attempt_id && (
                      <div className="flex justify-between items-center text-[9px] text-slate-500 pt-2 border-t border-white/5">
                        <span>Completions: {quiz.attempts_taken} / {quiz.max_attempts}</span>
                        <Link href={`/assessment/${quiz.id}?view=results&attemptId=${quiz.attempt_id}`}>
                          <span className="text-cyan-400 hover:text-cyan-300 font-bold cursor-pointer flex items-center gap-0.5">
                            <span>Details</span>
                            <ArrowRight className="h-3 w-3" />
                          </span>
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-panel border-white/5 rounded-2xl p-8 text-center text-slate-500 text-xs font-semibold">
                You haven&apos;t completed any quizzes yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
