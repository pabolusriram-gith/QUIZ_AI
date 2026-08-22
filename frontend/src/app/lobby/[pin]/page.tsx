"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { tokenStorage } from "@/utils/storage";
import api from "@/services/api";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trophy, BarChart3, Users, Clock, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";

// Import custom components
import HostLobby from "@/components/live/HostLobby";
import HostControls from "@/components/live/HostControls";
import QuestionPanel from "@/components/live/QuestionPanel";
import ParticipantTable from "@/components/live/ParticipantTable";
import Leaderboard from "@/components/live/Leaderboard";
import StatisticsPanel from "@/components/live/StatisticsPanel";
import ConnectionStatus from "@/components/live/ConnectionStatus";
import LoadingSkeleton from "@/components/live/shared/LoadingSkeleton";
import ErrorState from "@/components/live/shared/ErrorState";
import EmptyState from "@/components/live/shared/EmptyState";
import ReconnectOverlay from "@/components/live/shared/ReconnectOverlay";

interface Participant {
  id: string;
  nickname: string;
  connected: boolean;
  score: number;
}

interface TimelineEvent {
  time: string;
  text: string;
}

interface Submission {
  nickname: string;
  correct: boolean;
  score: number;
  time_spent: number;
  selections: string[];
}

interface StudentStat {
  correct: number;
  total: number;
  totalTime: number;
}

export default function HostLobbyPage() {
  const params = useParams();
  const router = useRouter();
  const token = tokenStorage.getAccessToken();
  const pin = params?.pin as string;

  // REST State
  const [session, setSession] = useState<any>(null);
  const [quiz, setQuiz] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  // WebSocket State
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadedPlayers, setLoadedPlayers] = useState<string[]>([]);
  const [answeredPlayers, setAnsweredPlayers] = useState<string[]>([]);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [studentStats, setStudentStats] = useState<Record<string, StudentStat>>({});

  // UI State
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsQuality, setWsQuality] = useState<"connected" | "reconnecting" | "offline">("connected");
  const [latency, setLatency] = useState<number | null>(null);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([
    { time: new Date().toLocaleTimeString(), text: "Lobby monitor session initialized." }
  ]);
  const [resultsTab, setResultsTab] = useState<"leaderboard" | "distribution" | "questions">("leaderboard");
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  // Local Interaction State
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [actionPending, setActionPending] = useState<Record<string, boolean>>({
    release: false,
    pause: false,
    resume: false,
    lock: false,
    unlock: false,
    extend: false,
    skip: false,
    end: false,
    next: false,
    latejoin: false,
    autoadvance: false
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPongAtRef = useRef<number>(Date.now());
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pingSentAtRef = useRef<number | null>(null);

  const runHostCommand = async (actionKey: string, apiCall: () => Promise<any>, successMsg?: string) => {
    setActionPending(prev => ({ ...prev, [actionKey]: true }));
    try {
      await apiCall();
      if (successMsg) {
        toast.success(successMsg);
      }
    } catch (err: any) {
      console.error(`Command ${actionKey} failed:`, err);
      toast.error(err.response?.data?.detail || `Action failed.`);
    } finally {
      setActionPending(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  // Fetch session details on load (State Recovery)
  useEffect(() => {
    if (!pin) return;

    const fetchSession = async () => {
      try {
        const res = await api.get(`/sessions/${pin}`);
        setSession(res.data);
      } catch (err: any) {
        console.error(err);
        toast.error(err.response?.data?.detail || "Failed to load lobby session.");
        router.push("/dashboard/live-quiz");
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [pin, router]);

  // Fetch full quiz structure when session is loaded
  useEffect(() => {
    if (!session?.quiz_id) return;
    api.get(`/quizzes/${session.quiz_id}`)
      .then(res => {
        setQuiz(res.data);
      })
      .catch(err => {
        console.error("Failed to load quiz details:", err);
      });
  }, [session?.quiz_id]);

  // Load analytics when quiz is finished
  useEffect(() => {
    if (session?.status !== "finished" || !pin) return;

    const fetchAnalytics = async () => {
      try {
        setLoadingAnalytics(true);
        const res = await api.get(`/sessions/${pin}/analytics`);
        setAnalytics(res.data);
      } catch (err) {
        console.error("Failed to load session analytics:", err);
        toast.error("Failed to load quiz reports.");
      } finally {
        setLoadingAnalytics(false);
      }
    };

    fetchAnalytics();
  }, [session?.status, pin]);

  // Establish WebSocket connection
  useEffect(() => {
    if (!pin || !token || loading) return;

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    const wsBaseUrl = apiBaseUrl.replace(/^https:\/\//i, "wss://").replace(/^http:\/\//i, "ws://");
    const wsUrl = `${wsBaseUrl}/sessions/ws/session/${pin}?role=host&token=${token}`;

    console.log("[WS] Connecting to host channel:", wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected successfully.");
      setWsConnected(true);
      setWsQuality("connected");
      reconnectAttemptsRef.current = 0;
      lastPongAtRef.current = Date.now();

      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      heartbeatIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          pingSentAtRef.current = Date.now();
          ws.send(JSON.stringify({ type: "ping", payload: {} }));

          const timeSinceLastPong = Date.now() - lastPongAtRef.current;
          if (timeSinceLastPong > 30000) {
            setWsQuality("offline");
          } else if (timeSinceLastPong > 10000) {
            setWsQuality("reconnecting");
          } else {
            setWsQuality("connected");
          }
        } else {
          setWsQuality("offline");
        }
      }, 10000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[WS] Message received:", data);

        const timeStr = new Date().toLocaleTimeString();

        if (data.type === "pong") {
          lastPongAtRef.current = Date.now();
          setWsQuality("connected");
          if (pingSentAtRef.current) {
            setLatency(Date.now() - pingSentAtRef.current);
          }
          return;
        }

        const payload = data.payload;

        if (data.type === "session_update" && payload) {
          if (payload.status !== undefined) {
            setSession((prev: any) => ({ ...prev, status: payload.status }));
          }
          if (payload.participants !== undefined) {
            setParticipants(payload.participants);
          }
          if (payload.answered_count !== undefined) {
            setAnsweredCount(payload.answered_count);
          }
          if (payload.answered_players !== undefined) {
            setAnsweredPlayers(payload.answered_players);
          }

          if (payload.last_submission) {
            const sub: Submission = payload.last_submission;
            setSubmissions(prev => {
              const filtered = prev.filter(s => s.nickname !== sub.nickname);
              return [...filtered, sub];
            });

            setStudentStats(prev => {
              const current = prev[sub.nickname] || { correct: 0, total: 0, totalTime: 0 };
              return {
                ...prev,
                [sub.nickname]: {
                  correct: current.correct + (sub.correct ? 1 : 0),
                  total: current.total + 1,
                  totalTime: current.totalTime + sub.time_spent
                }
              };
            });
          }
        } else if (data.type === "player_joined" && payload) {
          toast.success(`${payload.nickname} joined!`);
          setTimeline(prev => [
            { time: timeStr, text: `Student "${payload.nickname}" joined the session.` },
            ...prev
          ]);
        } else if (data.type === "player_left" && payload) {
          toast.error(`${payload.nickname} left the session.`);
          setTimeline(prev => [
            { time: timeStr, text: `Student "${payload.nickname}" left the session.` },
            ...prev
          ]);
        } else if (data.type === "question_loaded" && payload) {
          if (payload.loaded_players !== undefined) {
            setLoadedPlayers(payload.loaded_players);
          }
        } else if (data.type === "start_timer" && payload) {
          setSubmissions([]);
          setSession((prev: any) => ({
            ...prev,
            current_question_started_at: payload.current_question_started_at,
            current_question_end_time: payload.current_question_end_time,
            answers_locked: false
          }));
          setTimeline(prev => [
            { time: timeStr, text: `Question ${payload.current_question_index + 1} timer started.` },
            ...prev
          ]);
        } else if (data.type === "next_question" && payload) {
          setSubmissions([]);
          setLoadedPlayers([]);
          setAnsweredPlayers([]);
          setAnsweredCount(0);
          setSession((prev: any) => ({
            ...prev,
            current_question_index: payload.current_question_index,
            current_question_started_at: null,
            current_question_end_time: null,
            answers_locked: false
          }));
          setTimeline(prev => [
            { time: timeStr, text: `Question index changed to ${payload.current_question_index + 1}.` },
            ...prev
          ]);
        } else if (data.type === "pause_game") {
          toast.warning("Quiz session paused.");
          setSession((prev: any) => ({ ...prev, is_paused: true }));
          setTimeline(prev => [
            { time: timeStr, text: "Quiz session paused by host." },
            ...prev
          ]);
        } else if (data.type === "resume_game") {
          toast.success("Quiz session resumed.");
          setSession((prev: any) => ({ ...prev, is_paused: false }));
          setTimeline(prev => [
            { time: timeStr, text: "Quiz session resumed by host." },
            ...prev
          ]);
        } else if (data.type === "answer_locked") {
          setSession((prev: any) => ({ ...prev, answers_locked: true }));
        } else if (data.type === "answer_unlocked") {
          setSession((prev: any) => ({ ...prev, answers_locked: false }));
        } else if (data.type === "settings_updated" && payload) {
          if (payload.late_join_policy !== undefined) {
            setSession((prev: any) => ({ ...prev, late_join_policy: payload.late_join_policy }));
            setTimeline(prev => [
              { time: timeStr, text: `Late join policy changed to "${payload.late_join_policy}".` },
              ...prev
            ]);
          }
          if (payload.auto_advance !== undefined) {
            setSession((prev: any) => ({ ...prev, auto_advance: payload.auto_advance }));
            setTimeline(prev => [
              { time: timeStr, text: `Auto advance mode toggled to ${payload.auto_advance ? "ON" : "OFF"}.` },
              ...prev
            ]);
          }
        } else if (data.type === "start_countdown") {
          setTimeline(prev => [
            { time: timeStr, text: "Lobby countdown activated!" },
            ...prev
          ]);
        } else if (data.type === "session_finished" || data.type === "end_game") {
          setSession((prev: any) => ({ ...prev, status: "finished" }));
          setTimeline(prev => [
            { time: timeStr, text: "Quiz session ended." },
            ...prev
          ]);
        }
      } catch (err) {
        console.error("[WS] Error parsing websocket message:", err);
      }
    };

    ws.onclose = (event) => {
      console.log("[WS] Connection closed:", event.code, event.reason);
      setWsConnected(false);
      setWsQuality("offline");
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      if (event.code !== 1000 && event.code !== 4003) {
        const attempts = reconnectAttemptsRef.current;
        const delay = Math.min(3000 * Math.pow(2, attempts), 30000);
        console.log(`[WS] Disconnected. Reconnecting in ${delay / 1000}s...`);
        reconnectAttemptsRef.current += 1;

        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectTrigger(prev => prev + 1);
        }, delay);
      }
    };

    ws.onerror = (error) => {
      console.error("[WS] Error:", error);
    };

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounted");
      }
    };
  }, [pin, token, loading, reconnectTrigger]);

  // Synchronized countdown timer for current question
  useEffect(() => {
    if (!session?.current_question_end_time || session?.is_paused) {
      setTimeLeft(null);
      return;
    }

    const interval = setInterval(() => {
      const endTime = new Date(session.current_question_end_time).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, Math.round((endTime - now) / 1000));
      setTimeLeft(diff);

      if (diff <= 0) {
        clearInterval(interval);
        toast.error("Question timer has expired!");
        setTimeline(prev => [
          { time: new Date().toLocaleTimeString(), text: "Question timer expired." },
          ...prev
        ]);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.current_question_end_time, session?.is_paused]);

  const handleStartLobbyCountdown = useCallback(async () => {
    if (participants.length === 0) {
      toast.warning("Cannot start quiz without players!");
      return;
    }
    setStarting(true);
    try {
      await api.post(`/sessions/${pin}/start-countdown`);
      toast.success("Lobby countdown started!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Failed to start quiz.");
    } finally {
      setStarting(false);
    }
  }, [pin, participants.length]);

  const handleToggleLateJoin = useCallback(async () => {
    const nextPolicy = session.late_join_policy === "allow_late_join" ? "disable_after_start" : "allow_late_join";
    await runHostCommand("latejoin", async () => {
      const res = await api.post(`/sessions/${pin}/late-join`, { policy: nextPolicy });
      setSession(res.data);
    }, `Late join policy changed to ${nextPolicy === "allow_late_join" ? "Allowed" : "Locked"}`);
  }, [pin, session?.late_join_policy]);

  const handleToggleAutoAdvance = useCallback(async () => {
    const nextAuto = !session.auto_advance;
    await runHostCommand("autoadvance", async () => {
      const res = await api.post(`/sessions/${pin}/settings`, { auto_advance: nextAuto });
      setSession(res.data);
    }, `Auto Advance changed to ${nextAuto ? "Enabled" : "Disabled"}`);
  }, [pin, session?.auto_advance]);

  const handleCopyPin = useCallback(() => {
    navigator.clipboard.writeText(pin);
    toast.success("Game PIN copied to clipboard!");
  }, [pin]);

  const handleDeleteSession = useCallback(async () => {
    if (confirm("Are you sure you want to permanently delete this game session and all of its associated participant records?")) {
      try {
        await api.delete(`/sessions/${pin}`);
        toast.success("Game session deleted successfully.");
        router.push("/dashboard/live-quiz");
      } catch (err) {
        console.error("Failed to delete session:", err);
        toast.error("Failed to delete session.");
      }
    }
  }, [pin, router]);

  const handleHostAgain = useCallback(() => {
    router.push(`/dashboard/live-quiz?quizId=${session.quiz_id}&action=host`);
  }, [session?.quiz_id, router]);

  const exportLeaderboardCSV = useCallback(() => {
    if (!analytics?.leaderboard) return;
    const headers = ["Rank", "Student", "Score (pts)", "Accuracy (%)", "Avg Response Time (s)"];
    const rows = analytics.leaderboard.map((item: any) => [
      item.rank.toString(),
      item.nickname,
      item.score.toString(),
      item.accuracy.toString(),
      item.average_time.toString()
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map((row: any) => row.map((val: any) => `"${val}"`).join(","))
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `LiveQuiz_Leaderboard_Report_${pin}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Leaderboard CSV exported successfully!");
  }, [analytics, pin]);

  if (loading || !session) {
    return <LoadingSkeleton />;
  }

  // --- STATS COMPUTATIONS ---
  const currentQIndex = session?.current_question_index || 0;
  const currentQ = quiz?.questions?.[currentQIndex];
  const totalQs = quiz?.questions?.length || 0;

  const connectedCount = participants.filter(p => p.connected).length;
  const disconnectedCount = participants.filter(p => !p.connected).length;

  // Live accuracy for active question (correct answers out of submissions)
  const accuracy = submissions.length > 0
    ? (submissions.filter(s => s.correct).length / submissions.length) * 100
    : 0;

  // Average response time for active question
  const avgResponseTime = submissions.length > 0
    ? submissions.reduce((sum, s) => sum + s.time_spent, 0) / submissions.length
    : 0;

  // Answer distribution calculation (mapping A, B, C, D to options)
  const distribution = (currentQ?.options || []).map((opt: any, index: number) => {
    const label = String.fromCharCode(65 + index);
    const count = submissions.filter(s => s.selections?.includes(String(opt.id))).length;
    return { label, count, text: opt.text, is_correct: opt.is_correct };
  });

  // --- RENDERING LOBBY STATE (LOBBY WAIT VIEW) ---
  if (session.status === "waiting") {
    return (
      <div className="container mx-auto p-4 md:p-6 text-white min-h-screen space-y-6 font-sans">
        <header className="flex justify-between items-center border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
              Lobby Waiting
            </span>
            <h2 className="text-sm font-bold text-white tracking-tight">{session.quiz_title}</h2>
          </div>
          <Button
            onClick={() => router.push("/dashboard/live-quiz")}
            className="h-8.5 border border-white/10 hover:bg-white/5 text-xs text-slate-350 hover:text-white"
          >
            Leave Lobby
          </Button>
        </header>

        <HostLobby
          pin={pin}
          session={session}
          participants={participants}
          starting={starting}
          onStartQuiz={handleStartLobbyCountdown}
          onToggleLateJoin={handleToggleLateJoin}
          lateJoinPending={actionPending.latejoin}
        />
      </div>
    );
  }

  // --- RENDERING LOBBY STATE (FINISHED STATE REPORTS) ---
  if (session.status === "finished") {
    if (loadingAnalytics || !analytics) {
      return (
        <div className="min-h-screen bg-[#02050c] text-white flex flex-col justify-center items-center gap-4">
          <Loader2 className="h-10 w-10 text-indigo-400 animate-spin" />
          <p className="text-slate-400 text-xs font-semibold">Generating live quiz reports and analytics...</p>
        </div>
      );
    }

    const { summary, leaderboard: reportLeaderboard } = analytics;

    return (
      <div className="container mx-auto p-4 md:p-6 text-white min-h-screen space-y-6 font-sans">
        <header className="flex flex-wrap justify-between items-center gap-4 border-b border-white/5 pb-4">
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-black text-white">Quiz Presentation Finished</h1>
            <p className="text-slate-400 text-xs font-semibold">Live results, performance graphs, and downloadable reports.</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleHostAgain}
              className="h-9.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl border-none cursor-pointer"
            >
              Host Session Again
            </Button>
            <Button
              onClick={handleDeleteSession}
              className="h-9.5 bg-rose-600/10 border border-rose-500/20 hover:bg-rose-600 text-rose-450 hover:text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              Delete Session
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Summary metrics card */}
          <div className="lg:col-span-1 glass-panel border-white/5 p-6 rounded-3xl space-y-5 shadow-2xl">
            <h3 className="text-sm font-bold border-b border-white/5 pb-2">Session Overview</h3>
            <div className="space-y-3.5 text-xs font-semibold text-slate-350">
              <div className="flex justify-between">
                <span className="text-slate-500">Quiz Title</span>
                <span className="text-white text-right max-w-[150px] truncate">{session.quiz_title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Participants</span>
                <span className="text-white font-mono">{summary.total_participants}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Class Average</span>
                <span className="text-emerald-400 font-bold font-mono">{summary.average_score?.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Questions</span>
                <span className="text-white font-mono">{totalQs}</span>
              </div>
            </div>
            <Button
              onClick={exportLeaderboardCSV}
              className="w-full h-11 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              Export Leaderboard CSV
            </Button>
          </div>

          {/* Results tabs display */}
          <div className="lg:col-span-2 glass-panel border-white/5 p-6 rounded-3xl space-y-6 shadow-2xl">
            <div className="flex border-b border-white/5 pb-2 text-xs font-bold gap-4">
              <button
                onClick={() => setResultsTab("leaderboard")}
                className={`pb-2 border-b-2 transition ${
                  resultsTab === "leaderboard" ? "border-indigo-500 text-white font-extrabold" : "border-transparent text-slate-450 hover:text-white"
                }`}
              >
                Score Leaderboard
              </button>
            </div>

            {resultsTab === "leaderboard" && (
              <Leaderboard leaderboard={reportLeaderboard} />
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- RENDERING LOBBY STATE (ACTIVE LIVE GAME ROOM) ---
  const isStarted = session.current_question_started_at !== null;
  const isPaused = session.is_paused || false;
  const isLocked = session.answers_locked || false;
  const isLastQuestion = currentQIndex + 1 >= totalQs;

  return (
    <div className="container mx-auto p-4 md:p-6 text-white min-h-screen space-y-6 font-sans">
      {/* Header bar */}
      <header className="flex flex-wrap justify-between items-center gap-4 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard/live-quiz")}
            className="p-2 rounded-xl bg-white/3 border border-white/5 text-slate-400 hover:text-white hover:bg-white/6 cursor-pointer transition-all flex items-center justify-center"
            title="Leave Session"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="space-y-0.5">
            <h2 className="text-sm font-black text-white leading-none">{session.quiz_title}</h2>
            <div className="flex gap-2 items-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <span>PIN: {pin}</span>
              <span>•</span>
              <ConnectionStatus status={wsQuality} latency={latency} />
            </div>
          </div>
        </div>
      </header>

      {/* Control panel */}
      <HostControls
        pin={pin}
        isStarted={isStarted}
        isPaused={isPaused}
        isLocked={isLocked}
        isLastQuestion={isLastQuestion}
        actionPending={actionPending}
        autoAdvance={session.auto_advance || false}
        onToggleAutoAdvance={handleToggleAutoAdvance}
        onRelease={() => runHostCommand("release", () => api.post(`/sessions/${pin}/start-timer`))}
        onPause={() => runHostCommand("pause", () => api.post(`/sessions/${pin}/pause`))}
        onResume={() => runHostCommand("resume", () => api.post(`/sessions/${pin}/resume`))}
        onExtend={() => runHostCommand("extend", () => api.post(`/sessions/${pin}/extend-timer`))}
        onNext={() => runHostCommand("next", () => api.post(`/sessions/${pin}/next-question`))}
        onEnd={() => runHostCommand("end", () => api.post(`/sessions/${pin}/end`))}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Progress details and stats charts */}
        <div className="lg:col-span-8 space-y-6">
          {/* Question Panel */}
          <QuestionPanel
            question={currentQ}
            currentIdx={currentQIndex}
            totalQs={totalQs}
            timeLeft={timeLeft}
            isPaused={isPaused}
            answeredCount={answeredCount}
            totalPlayers={participants.length}
          />

          {/* Distribution Graph Statistics */}
          <StatisticsPanel
            submissionsCount={submissions.length}
            accuracy={accuracy}
            avgResponseTime={avgResponseTime}
            distribution={distribution}
          />
        </div>

        {/* Right Column: Participant Connection Status & Leaderboard */}
        <div className="lg:col-span-4 space-y-6">
          {/* Leaderboard standings */}
          <Leaderboard leaderboard={participants.slice(0, 5)} />

          {/* Participant status scroll table */}
          <ParticipantTable
            participants={participants}
            answeredNicknames={answeredPlayers}
          />
        </div>
      </div>
    </div>
  );
}
