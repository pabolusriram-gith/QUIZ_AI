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
    <div className="relative min-h-screen bg-[#02050c] text-slate-100 flex flex-col justify-between items-center px-6 overflow-hidden">
      
      {/* Decorative Blur Background Panels */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden="true">
        <div className="absolute top-[20%] left-[20%] h-[500px] w-[500px] rounded-full bg-indigo-500/5 blur-[150px]" />
        <div className="absolute bottom-[20%] right-[20%] h-[500px] w-[500px] rounded-full bg-cyan-500/5 blur-[150px]" />
      </div>

      {/* Header logo */}
      <header className="w-full max-w-6xl py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <BrainCircuit className="h-6 w-6 text-indigo-400 group-hover:text-cyan-400 transition-colors" />
          <span className="text-base font-extrabold font-display text-white tracking-tight">
            QuizVerse <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">AI</span>
          </span>
        </Link>
      </header>

      {/* Main card */}
      <main className="flex-1 w-full max-w-md flex flex-col justify-center py-12 relative z-10">
        <AnimatePresence mode="wait">
          
          {step === "pin" ? (
            <motion.div
              key="pin-step"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="glass-panel border-white/5 rounded-3xl p-8 space-y-6 shadow-2xl hover:border-cyan-500/20 transition-all duration-300"
            >
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-wider select-none">
                  <Sparkles className="h-3 w-3 animate-pulse" />
                  <span>Participant Lobby</span>
                </div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight">Join Live Quiz</h2>
                <p className="text-slate-400 text-xs font-medium">Enter the Game PIN provided by your host to begin.</p>
              </div>

              <form onSubmit={handleValidatePin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Game PIN</label>
                  <Input
                    type="text"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.toUpperCase())}
                    placeholder="e.g. 123456"
                    disabled={loading}
                    className="bg-white/3 border-white/10 rounded-xl h-12 text-center text-lg font-black tracking-widest text-white uppercase focus:border-cyan-500/50"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading || !pin.trim()}
                  className="w-full h-11.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10 border-none cursor-pointer text-xs"
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

              <div className="text-center pt-2">
                <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Home</span>
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="nickname-step"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="glass-panel border-white/5 rounded-3xl p-8 space-y-6 shadow-2xl hover:border-indigo-500/20 transition-all duration-300"
            >
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-wider select-none">
                  <Sparkles className="h-3 w-3" />
                  <span>Connected</span>
                </div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight">Choose Nickname</h2>
                <p className="text-slate-400 text-xs font-medium">Entering lobby for:</p>
                <div className="p-3 bg-white/3 border border-white/5 rounded-xl inline-block max-w-full">
                  <div className="text-xs font-bold text-white truncate">{quizDetails?.title}</div>
                  {isLiveSession ? (
                    <div className="inline-flex items-center gap-1 text-[10px] text-cyan-400 font-semibold mt-0.5">
                      <Zap className="h-2.5 w-2.5" />
                      <span>
                        Live Session
                        {liveQuestionCount !== null ? ` • ${liveQuestionCount} Questions` : ""}
                      </span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                      {quizDetails?.subject} • {quizDetails?.questions?.length || 0} Questions
                    </div>
                  )}
                </div>
              </div>

              <form onSubmit={handleJoin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Your Nickname</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="e.g. GuestPlayer"
                      disabled={loading}
                      maxLength={20}
                      minLength={3}
                      className="bg-white/3 border-white/10 rounded-xl h-12 pl-10 text-white font-semibold text-sm focus:border-indigo-500/50"
                    />
                  </div>
                  <p className="text-[10px] text-slate-600 font-medium pl-1">
                    3–20 characters. Letters, numbers, hyphens, underscores only.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={loading || nickname.trim().length < 3}
                  className="w-full h-11.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10 border-none cursor-pointer text-xs"
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

              <div className="text-center pt-2">
                <button
                  onClick={() => setStep("pin")}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer border-none bg-transparent"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Change Game PIN</span>
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-[10px] text-slate-600 font-semibold select-none">
        &copy; {new Date().getFullYear()} QuizVerse AI. All rights reserved.
      </footer>
    </div>
  );
}

export default function JoinQuizPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#02050c] text-white flex flex-col items-center justify-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <span className="text-xs text-slate-500 font-bold">Loading Join Portal...</span>
      </div>
    }>
      <JoinQuizContent />
    </Suspense>
  );
}
