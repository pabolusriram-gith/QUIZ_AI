"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrainCircuit, Sparkles, User, Play, ArrowLeft, Loader2, Zap } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/services/api";
import { toast } from "sonner";

function JoinQuizContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithToken, isAuthenticated, currentUser } = useAuth();
  
  const [pin, setPin] = useState("");
  const [nickname, setNickname] = useState("");
  const [step, setStep] = useState<"pin" | "nickname">("pin");
  const [quizDetails, setQuizDetails] = useState<any>(null);
  const [isLiveSession, setIsLiveSession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [liveQuestionCount, setLiveQuestionCount] = useState<number | null>(null);

  // Sync PIN from query parameters on load
  useEffect(() => {
    const pinParam = searchParams.get("pin");
    if (pinParam) {
      setPin(pinParam.toUpperCase());
    }
  }, [searchParams]);

  // Step 1: Validate PIN
  const handleValidatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      toast.error("Please enter a Game PIN.");
      return;
    }

    setLoading(true);
    const cleanedPin = pin.trim();
    try {
      // 1. Try checking if it's a live Game Session PIN first
      try {
        const sessionRes = await api.get(`/sessions/${cleanedPin}`);
        const sessionData = sessionRes.data;

        // Fetch the actual quiz for question count
        let questionCount: number | null = null;
        if (sessionData.quiz_id) {
          try {
            const quizRes = await api.get(`/quizzes/${sessionData.quiz_id}`);
            questionCount = quizRes.data?.questions?.length ?? null;
          } catch {
            // Non-critical — quiz details not available
          }
        }

        setLiveQuestionCount(questionCount);
        setQuizDetails({
          id: sessionData.quiz_id,
          title: sessionData.quiz_title || "Live Assessment",
          subject: "Live Session",
          questions: questionCount !== null ? Array(questionCount).fill(null) : []
        });
        setIsLiveSession(true);
        setStep("nickname");
        setLoading(false);
        return;
      } catch (sessionErr: any) {
        // If the session explicitly ended (HTTP 410), surface the error and stop
        if (sessionErr?.response?.status === 410) {
          toast.error(sessionErr.response.data?.detail || "This game session has already ended.");
          setLoading(false);
          return;
        }
        // Not a live game session (404 or other), fall back to standard quiz code
        console.log("Not a live game session, checking standard quiz_code...");
      }

      // 2. Check standard quiz_code
      const res = await api.get(`/quizzes/code/${cleanedPin}`);
      setQuizDetails(res.data);
      setIsLiveSession(false);

      if (isAuthenticated) {
        // Teachers and admins should not take quizzes via the join page
        if (currentUser?.role === "teacher" || currentUser?.role === "admin") {
          toast.info(`Quiz found: "${res.data.title}". As a teacher, use the Quiz Dashboard to manage it.`);
          setLoading(false);
          return;
        }
        // Students who are already logged in go directly to the assessment
        toast.success(`Connected to: ${res.data.title}`);
        router.push(`/assessment/${res.data.id}`);
      } else {
        setStep("nickname");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Game PIN not found or is not published.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Join Quiz (Guest login by nickname + Redirect)
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNickname = nickname.trim();

    if (!trimmedNickname) {
      toast.error("Please enter a nickname.");
      return;
    }
    // Backend validation: nickname must be 3–20 alphanumeric characters
    if (trimmedNickname.length < 3 || trimmedNickname.length > 20) {
      toast.error("Nickname must be between 3 and 20 characters.");
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedNickname)) {
      toast.error("Nickname can only contain letters, numbers, underscores, and hyphens.");
      return;
    }
    if (!quizDetails) {
      toast.error("Quiz context lost. Please try again.");
      setStep("pin");
      return;
    }

    setLoading(true);
    try {
      // 1. Call guest-login on backend if not authenticated
      if (!isAuthenticated) {
        const res = await api.post("/auth/guest-login", { nickname: trimmedNickname });
        // 2. Set tokens and authenticate local state in AuthContext
        await loginWithToken(res.data.access_token, res.data.refresh_token, false);
      }

      // 3. For live sessions: pre-register via the HTTP join endpoint so that all
      //    backend guards (capacity, cross-session duplicate, late-join policy) run
      //    before we open a WebSocket.  The endpoint returns "joined" or "rejoined".
      if (isLiveSession) {
        // Retrieve the freshly-set (or pre-existing) access token
        const { tokenStorage } = await import("@/utils/storage");
        const currentToken = tokenStorage.getAccessToken();
        try {
          const joinRes = await api.post(
            `/sessions/${pin.trim()}/join`,
            { nickname: trimmedNickname },
            currentToken
              ? { params: { token: currentToken } }
              : undefined
          );
          if (joinRes.data && joinRes.data.connection_token) {
            sessionStorage.setItem(`connection_token:${pin.trim()}:${trimmedNickname}`, joinRes.data.connection_token);
          }
          if (joinRes.data && joinRes.data.access_token && joinRes.data.refresh_token) {
            await loginWithToken(joinRes.data.access_token, joinRes.data.refresh_token, false);
          }
        } catch (joinErr: any) {
          const status = joinErr?.response?.status;
          const detail = joinErr?.response?.data?.detail;
          if (status === 410) {
            toast.error(detail || "This game session has already ended.");
          } else if (status === 409) {
            toast.error(detail || "Nickname is already taken or you are already in a session.");
          } else if (status === 400) {
            toast.error(detail || "Cannot join this session right now.");
          } else {
            toast.error(detail || "Failed to join the game session.");
          }
          return;
        }
      }

      toast.success(`Welcome ${trimmedNickname}! Joining assessment...`);

      // 4. Redirect based on session type
      if (isLiveSession) {
        router.push(`/waiting/${pin.trim()}?nickname=${encodeURIComponent(trimmedNickname)}`);
      } else {
        router.push(`/assessment/${quizDetails.id}`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Failed to join quiz session.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#0d1e57] via-[#091745] to-[#061033] text-slate-100 flex flex-col justify-between items-center px-6 overflow-hidden">
      
      {/* Dynamic Background Mesh & Ambient Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden="true">
        {/* Subtle Tech Dot Matrix Grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#818cf835_1.2px,transparent_1.2px)] bg-[size:30px_30px] [mask-image:radial-gradient(ellipse_80%_70%_at_50%_45%,#000_70%,transparent_100%)] opacity-90" />
        
        {/* Overhead Aurora Glow Beam */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[380px] bg-gradient-to-b from-indigo-400/40 via-cyan-400/20 to-transparent blur-[90px]" />

        {/* Floating Animated Orbs */}
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            x: [0, 35, 0],
            y: [0, -25, 0],
          }}
          transition={{
            duration: 13,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -top-24 -left-16 h-[580px] w-[580px] rounded-full bg-gradient-to-tr from-indigo-500/45 via-blue-600/35 to-violet-500/30 blur-[120px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.18, 1],
            x: [0, -30, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 16,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -bottom-24 -right-16 h-[580px] w-[580px] rounded-full bg-gradient-to-bl from-cyan-400/40 via-sky-500/35 to-blue-600/30 blur-[130px]"
        />
        
        {/* Center Card Ambient Backlight */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[520px] w-[520px] rounded-full bg-indigo-500/25 blur-[100px]" />
      </div>

      {/* Header logo */}
      <header className="w-full max-w-6xl py-6 flex items-center justify-between z-10">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-500 via-indigo-500 to-cyan-400 shadow-md shadow-indigo-500/40 ring-1 ring-white/30 group-hover:scale-105 transition-transform duration-200">
            <BrainCircuit className="h-5 w-5 text-white" />
          </div>
          <span className="text-base font-extrabold font-display text-white tracking-tight drop-shadow-sm">
            QuizVerse <span className="bg-gradient-to-r from-indigo-300 via-cyan-300 to-sky-200 bg-clip-text text-transparent">AI</span>
          </span>
        </Link>
      </header>

      {/* Main card */}
      <main className="flex-1 w-full max-w-md flex flex-col justify-center py-10 relative z-10">
        <AnimatePresence mode="wait">
          
          {step === "pin" ? (
            <motion.div
              key="pin-step"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="relative group/card"
            >
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-indigo-500/40 via-cyan-400/30 to-blue-500/40 opacity-85 blur-2xl group-hover/card:opacity-100 transition-opacity duration-500 -z-10" />
              <div className="bg-[#101e4a]/90 backdrop-blur-2xl border border-indigo-400/25 rounded-2xl p-8 space-y-6 shadow-[0_30px_70px_-15px_rgba(2,8,30,0.8),0_0_40px_rgba(99,102,241,0.25)] hover:border-indigo-400/40 transition-all duration-300">
                <div className="text-center space-y-2.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-400/20 border border-cyan-400/40 text-cyan-200 text-[10px] font-bold uppercase tracking-wider select-none shadow-sm">
                    <Sparkles className="h-3 w-3 animate-pulse text-cyan-300" />
                    <span>Participant Lobby</span>
                  </div>
                  <h2 className="text-2xl font-extrabold text-white tracking-tight font-display drop-shadow-sm">Join Live Quiz</h2>
                  <p className="text-slate-300 text-xs font-medium max-w-[280px] mx-auto">Enter the Game PIN provided by your host to begin.</p>
                </div>

                <form onSubmit={handleValidatePin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block pl-0.5">Game PIN</label>
                    <Input
                      type="text"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.toUpperCase())}
                      placeholder="e.g. 123456"
                      disabled={loading}
                      className="bg-[#172a63]/90 border border-indigo-300/30 rounded-xl h-12 text-center text-xl font-black tracking-widest text-white uppercase hover:border-indigo-300/60 focus:border-cyan-300 focus:bg-[#1d3375] focus:ring-4 focus:ring-cyan-400/20 placeholder:text-slate-400 transition-all duration-200"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || !pin.trim()}
                    className="w-full h-11.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 hover:from-indigo-400 hover:via-indigo-500 hover:to-cyan-400 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/35 border-none cursor-pointer text-xs transition-all duration-200 active:scale-[0.99]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                        <span>Verifying PIN...</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        <span>Connect</span>
                      </>
                    )}
                  </Button>
                </form>

                <div className="text-center pt-1">
                  <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-cyan-300 transition-colors">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back to Home</span>
                  </Link>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="nickname-step"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="relative group/card"
            >
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-indigo-500/40 via-cyan-400/30 to-blue-500/40 opacity-85 blur-2xl group-hover/card:opacity-100 transition-opacity duration-500 -z-10" />
              <div className="bg-[#101e4a]/90 backdrop-blur-2xl border border-indigo-400/25 rounded-2xl p-8 space-y-6 shadow-[0_30px_70px_-15px_rgba(2,8,30,0.8),0_0_40px_rgba(99,102,241,0.25)] hover:border-indigo-400/40 transition-all duration-300">
                <div className="text-center space-y-2.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/25 border border-indigo-400/40 text-indigo-200 text-[10px] font-bold uppercase tracking-wider select-none shadow-sm">
                    <Sparkles className="h-3 w-3 text-indigo-300" />
                    <span>PIN Verified</span>
                  </div>
                  <h2 className="text-2xl font-extrabold text-white tracking-tight font-display drop-shadow-sm">Choose Nickname</h2>
                  <p className="text-slate-300 text-xs font-medium">Entering lobby for:</p>
                  <div className="p-3.5 bg-[#172a63]/90 border border-indigo-300/30 rounded-xl w-full text-center">
                    <div className="text-xs font-bold text-white truncate">{quizDetails?.title}</div>
                    {isLiveSession ? (
                      <div className="inline-flex items-center gap-1 text-[11px] text-cyan-300 font-semibold mt-1">
                        <Zap className="h-3 w-3" />
                        <span>
                          Live Session
                          {liveQuestionCount !== null ? ` • ${liveQuestionCount} Questions` : ""}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-300 font-medium mt-1">
                        {quizDetails?.subject} • {quizDetails?.questions?.length || 0} Questions
                      </div>
                    )}
                  </div>
                </div>

                <form onSubmit={handleJoin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block pl-0.5">Your Nickname</label>
                    <div className="relative group">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-300 group-focus-within:text-cyan-300 transition-colors" />
                      <Input
                        type="text"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="e.g. GuestPlayer"
                        disabled={loading}
                        maxLength={20}
                        minLength={3}
                        className="bg-[#172a63]/90 border border-indigo-300/30 rounded-xl h-12 pl-10 pr-4 text-white font-semibold text-sm hover:border-indigo-300/60 focus:border-indigo-300 focus:bg-[#1d3375] focus:ring-4 focus:ring-indigo-400/20 placeholder:text-slate-400 transition-all duration-200"
                      />
                    </div>
                    <p className="text-[10px] text-slate-300 font-medium pl-1">
                      3–20 characters. Letters, numbers, hyphens, underscores only.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || nickname.trim().length < 3}
                    className="w-full h-11.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 hover:from-indigo-400 hover:via-indigo-500 hover:to-cyan-400 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/35 border-none cursor-pointer text-xs transition-all duration-200 active:scale-[0.99]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                        <span>Joining game...</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        <span>Start Quiz</span>
                      </>
                    )}
                  </Button>
                </form>

                <div className="text-center pt-1">
                  <button
                    onClick={() => setStep("pin")}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer border-none bg-transparent"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Change Game PIN</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-[10px] text-slate-400 font-medium select-none z-10">
        &copy; {new Date().getFullYear()} QuizVerse AI. All rights reserved.
      </footer>
    </div>
  );
}

export default function JoinQuizPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#091745] text-slate-100 flex flex-col items-center justify-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        <span className="text-xs text-slate-300 font-medium">Loading Join Portal...</span>
      </div>
    }>
      <JoinQuizContent />
    </Suspense>
  );
}
