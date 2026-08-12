"use client";

import React, { useState, useEffect, useRef } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/services/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { tokenStorage } from "@/utils/storage";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  Play, Users, QrCode, Copy, RefreshCw, BarChart3,
  Calendar, Info, Plus, Settings2, Clock, Check, HelpCircle,
  Wifi, ShieldAlert, Award, FileText, ChevronRight, Activity,
  Unlock, Lock, CheckCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface Participant {
  id: string;
  nickname: string;
  connected: boolean;
  joined_at?: string;
}

interface GameSession {
  id: string;
  quiz_id: string;
  quiz_title: string;
  game_pin: string;
  status: string;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  max_players: number;
  connected_participant_count: number;
  waiting_participant_count: number;
  total_participant_count: number;
  is_paused: boolean;
  late_join_policy: string;
  question_order: string;
  option_order: string;
  leaderboard_mode: string;
  question_timer_override: number | null;
  current_question_index: number;
}

interface Quiz {
  id: string;
  title: string;
  status: string;
  subject: string;
  question_count: number;
}

interface TimelineEvent {
  time: string;
  text: string;
}

export default function LiveQuizDashboard() {
  const router = useRouter();
  const token = tokenStorage.getAccessToken();
  
  // Dashboard overall states
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [sessions, setSessions] = useState<{
    active: GameSession[];
    waiting: GameSession[];
    recent: GameSession[];
    stats: {
      total_sessions: number;
      active_sessions_count: number;
      waiting_sessions_count: number;
      recent_sessions_count: number;
      total_participants_all_time: number;
      avg_participants_per_session: number;
    };
  }>({
    active: [],
    waiting: [],
    recent: [],
    stats: {
      total_sessions: 0,
      active_sessions_count: 0,
      waiting_sessions_count: 0,
      recent_sessions_count: 0,
      total_participants_all_time: 0,
      avg_participants_per_session: 0
    }
  });

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"waiting" | "active" | "history">("waiting");
  
  // Creator form state
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [allowLateJoin, setAllowLateJoin] = useState(true);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [questionTimer, setQuestionTimer] = useState<string>("30");
  const [maxParticipants, setMaxParticipants] = useState<number>(50);
  const [creating, setCreating] = useState(false);
  const [customPin, setCustomPin] = useState("");
  const [autoGeneratePin, setAutoGeneratePin] = useState(true);

  // Selected live session monitor
  const [activePin, setActivePin] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch quizzes and sessions on mount
  useEffect(() => {
    fetchQuizzes();
    fetchSessions();
  }, []);

  const fetchQuizzes = async () => {
    try {
      const res = await api.get("/quizzes", { params: { limit: 100 } });
      const published = (res.data.items || []).filter((q: Quiz) => q.status === "published");
      setQuizzes(published);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load quizzes dropdown.");
    }
  };

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await api.get("/sessions");
      setSessions(res.data);
      
      // Auto-select the first waiting or active session if none is selected
      if (!activePin) {
        if (res.data.waiting.length > 0) {
          handleSelectSession(res.data.waiting[0]);
        } else if (res.data.active.length > 0) {
          handleSelectSession(res.data.active[0]);
        }
      } else {
        // Update selected session details if it's still in the list
        const updated = 
          res.data.waiting.find((s: GameSession) => s.game_pin === activePin) ||
          res.data.active.find((s: GameSession) => s.game_pin === activePin);
        if (updated) {
          setActiveSession(updated);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch game sessions.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSession = (s: GameSession) => {
    setActivePin(s.game_pin);
    setActiveSession(s);
    setTimeline([
      { time: new Date().toLocaleTimeString(), text: `Session PIN ${s.game_pin} selected for monitoring.` }
    ]);
  };

  const handleGenerateRandomPin = () => {
    const randomPinVal = Math.floor(100000 + Math.random() * 900000).toString();
    setCustomPin(randomPinVal);
    setAutoGeneratePin(false);
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuizId) {
      toast.error("Please select a published quiz first.");
      return;
    }

    setCreating(true);
    try {
      const settings = {
        quiz_id: selectedQuizId,
        game_pin: autoGeneratePin ? null : customPin.trim() || null,
        max_players: maxParticipants,
        require_host_to_start: true,
        leaderboard_mode: showLeaderboard ? "final_results_only" : "no_leaderboard",
        quiz_end_mode: "auto_end",
        correct_answer_visibility: "immediately",
        question_navigation_mode: "host_controlled",
        question_order: shuffleQuestions ? "shuffled" : "same_for_everyone",
        option_order: shuffleOptions ? "shuffled" : "same_for_everyone",
        late_join_policy: allowLateJoin ? "allow_late_join" : "disable_after_start",
        question_timer_override: questionTimer ? parseInt(questionTimer, 10) : null
      };

      const res = await api.post("/sessions/create", settings);
      toast.success(`Live Session ${res.data.game_pin} created successfully!`);
      
      // Clear custom PIN input upon successful creation
      setCustomPin("");
      setAutoGeneratePin(true);

      // Select the created session and trigger fetch refresh
      await fetchSessions();
      handleSelectSession(res.data);
      setActiveTab("waiting");
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Failed to create live session.");
    } finally {
      setCreating(false);
    }
  };

  // Host again logic
  const handleHostAgain = (histSession: GameSession) => {
    setSelectedQuizId(histSession.quiz_id);
    setAllowLateJoin(histSession.late_join_policy === "allow_late_join");
    setShuffleQuestions(histSession.question_order === "shuffled");
    setShuffleOptions(histSession.option_order === "shuffled");
    setShowLeaderboard(histSession.leaderboard_mode !== "no_leaderboard");
    setQuestionTimer(histSession.question_timer_override ? String(histSession.question_timer_override) : "");
    setMaxParticipants(histSession.max_players);
    toast.success("Loaded previous settings. Adjust and click 'Create Live Session'.");
  };

  // WebSocket Live Updates
  useEffect(() => {
    if (!activePin || !token) return;

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = apiBaseUrl.replace(/^http/, wsScheme) + `/sessions/ws/session/${activePin}?role=host&token=${token}`;
    
    console.log("[WS] Connecting to session channel:", wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected successfully.");
      setTimeline(prev => [
        { time: new Date().toLocaleTimeString(), text: "Connected to real-time session monitor." },
        ...prev
      ]);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[WS] Message received:", data);
        
        if (data.type === "pong") return;

        const payload = data.payload;
        const timeStr = new Date().toLocaleTimeString();

        if (data.type === "session_update" && payload) {
          if (payload.participants !== undefined) {
            setParticipants(payload.participants);
          }
        } else if (data.type === "player_joined" && payload) {
          toast.success(`${payload.nickname} joined!`);
          setTimeline(prev => [
            { time: timeStr, text: `Student "${payload.nickname}" joined the lobby.` },
            ...prev
          ]);
        } else if (data.type === "player_left" && payload) {
          toast.info(`${payload.nickname} disconnected.`);
          setTimeline(prev => [
            { time: timeStr, text: `Student "${payload.nickname}" disconnected.` },
            ...prev
          ]);
        } else if (data.type === "start_countdown" && payload) {
          setTimeline(prev => [
            { time: timeStr, text: "Countdown started!" },
            ...prev
          ]);
        } else if (data.type === "session_finished" || data.type === "end_game") {
          setTimeline(prev => [
            { time: timeStr, text: "Quiz session finished." },
            ...prev
          ]);
          fetchSessions();
        }
      } catch (err) {
        console.error("Error processing WS message:", err);
      }
    };

    ws.onclose = () => {
      console.log("[WS] Connection closed.");
      setTimeline(prev => [
        { time: new Date().toLocaleTimeString(), text: "Session monitor connection closed." },
        ...prev
      ]);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [activePin, token]);

  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/join?pin=${activePin || ""}` : "";

  const copyJoinLink = () => {
    navigator.clipboard.writeText(joinUrl);
    toast.success("Join link copied to clipboard!");
  };

  const handleStartQuiz = () => {
    if (!activePin) return;
    router.push(`/lobby/${activePin}`);
  };

  const connectedCount = participants.filter(p => p.connected).length;
  const offlineCount = participants.filter(p => !p.connected).length;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 text-white min-h-screen">
      <PageHeader
        title="Live Hosting Dashboard"
        description="Monitor, launch, and host interactive live quizzes for your students in real time."
      />

      {/* Quick Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Sessions", value: sessions.stats.active_sessions_count, icon: Activity, color: "text-emerald-400" },
          { label: "Waiting Sessions", value: sessions.stats.waiting_sessions_count, icon: Clock, color: "text-amber-400" },
          { label: "Completed Sessions", value: sessions.stats.recent_sessions_count, icon: CheckCircle, color: "text-indigo-400" },
          { label: "Total Participants", value: sessions.stats.total_participants_all_time, icon: Users, color: "text-cyan-400" }
        ].map((stat, i) => (
          <div key={i} className="glass-panel border-white/5 p-5 rounded-2xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{stat.label}</span>
              <h2 className="text-3xl font-extrabold">{stat.value}</h2>
            </div>
            <div className={`p-3 rounded-xl bg-white/5 border border-white/10 ${stat.color}`}>
              <stat.icon className="h-6 w-6" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Quick Start Form */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-panel border-white/5 p-6 rounded-2xl space-y-5">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-400" />
              <span>Quick Start Live Session</span>
            </h3>

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Select Published Quiz</label>
                <select
                  value={selectedQuizId}
                  onChange={(e) => setSelectedQuizId(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl h-11 px-3 text-slate-300 font-medium text-sm focus:border-indigo-500/50 outline-none select-custom"
                >
                  <option value="">-- Choose Quiz --</option>
                  {quizzes.map((q) => (
                    <option key={q.id} value={q.id} className="bg-[#060d1c]">
                      {q.title} ({q.subject})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-400">Game Session PIN</label>
                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoGeneratePin}
                      onChange={(e) => {
                        setAutoGeneratePin(e.target.checked);
                        if (e.target.checked) setCustomPin("");
                      }}
                      className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-indigo-500/30 h-3.5 w-3.5"
                    />
                    <span>Auto-Generate PIN</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={customPin}
                    onChange={(e) => {
                      setCustomPin(e.target.value);
                      if (e.target.value.trim()) {
                        setAutoGeneratePin(false);
                      } else {
                        setAutoGeneratePin(true);
                      }
                    }}
                    placeholder={autoGeneratePin ? "Auto-generated PIN" : "Enter custom PIN (e.g. 1234)"}
                    disabled={autoGeneratePin}
                    className="bg-slate-900 border-white/10 h-10 text-sm grow disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateRandomPin}
                    className="h-10 bg-white/5 border border-white/10 text-xs px-3 hover:bg-white/10 text-slate-350 hover:text-white cursor-pointer rounded-xl flex items-center justify-center shrink-0 transition"
                  >
                    Generate Random
                  </button>
                </div>
              </div>

              {/* Settings Card */}
              <div className="bg-white/2 border border-white/5 rounded-xl p-4 space-y-3.5">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                    <Settings2 className="h-3.5 w-3.5" /> Lobby Settings
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Allow Late Join</span>
                    <input
                      type="checkbox"
                      checked={allowLateJoin}
                      onChange={(e) => setAllowLateJoin(e.target.checked)}
                      className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-indigo-500/30"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Shuffle Questions</span>
                    <input
                      type="checkbox"
                      checked={shuffleQuestions}
                      onChange={(e) => setShuffleQuestions(e.target.checked)}
                      className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-indigo-500/30"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Shuffle Options</span>
                    <input
                      type="checkbox"
                      checked={shuffleOptions}
                      onChange={(e) => setShuffleOptions(e.target.checked)}
                      className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-indigo-500/30"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Show Leaderboard</span>
                    <input
                      type="checkbox"
                      checked={showLeaderboard}
                      onChange={(e) => setShowLeaderboard(e.target.checked)}
                      className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-indigo-500/30"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Timer (s)</label>
                    <select
                      value={questionTimer}
                      onChange={(e) => setQuestionTimer(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg h-9 px-2 text-xs text-slate-300 outline-none select-custom"
                    >
                      <option value="">Default</option>
                      <option value="15">15s</option>
                      <option value="30">30s</option>
                      <option value="45">45s</option>
                      <option value="60">60s</option>
                      <option value="90">90s</option>
                      <option value="120">120s</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Max players</label>
                    <Input
                      type="number"
                      min={5}
                      max={500}
                      value={maxParticipants}
                      onChange={(e) => setMaxParticipants(Number(e.target.value))}
                      className="bg-slate-900 border-white/10 h-9 text-xs"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-2 text-sm shadow-lg shadow-indigo-600/10"
              >
                {creating ? "Creating session..." : "Host Live Session"}
              </button>
            </form>
          </div>
        </div>

        {/* Center/Right Column: Live Session Setup & Connected Students */}
        <div className="lg:col-span-8 space-y-6">
          {activeSession ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Active Session info card & Local QR */}
              <div className="md:col-span-5 space-y-6">
                <div className="glass-panel border-white/5 p-6 rounded-2xl space-y-5">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded uppercase tracking-wider font-bold">
                      {activeSession.status}
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold uppercase">PIN Code</span>
                  </div>

                  <div className="text-center space-y-1">
                    <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400 tracking-wider">
                      {activeSession.game_pin}
                    </h1>
                    <p className="text-xs text-slate-400 font-semibold line-clamp-1">{activeSession.quiz_title}</p>
                  </div>

                  {/* QR Code Container */}
                  <div className="bg-white/3 border border-white/5 p-4 rounded-xl flex flex-col items-center gap-3">
                    <QRCodeSVG 
                      value={joinUrl} 
                      size={140} 
                      level="H" 
                      includeMargin={true} 
                      className="rounded-lg bg-white p-1 border border-white/10" 
                    />
                    <span className="text-[10px] text-slate-400 text-center leading-relaxed">
                      Students scan the QR or enter the PIN to join.
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={copyJoinLink}
                      className="flex-1 h-10 border border-white/10 hover:bg-white/5 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy Link
                    </button>

                    <button
                      onClick={handleStartQuiz}
                      className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/10"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Start Quiz
                    </button>
                  </div>
                </div>

                {/* Session Health Card */}
                <div className="glass-panel border-white/5 p-5 rounded-2xl space-y-4">
                  <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-emerald-400" />
                    Session health
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white/2 border border-white/5 p-3 rounded-xl">
                      <span className="text-[10px] text-slate-500 block">Connected</span>
                      <span className="text-lg font-bold text-emerald-400">{connectedCount}</span>
                    </div>
                    <div className="bg-white/2 border border-white/5 p-3 rounded-xl">
                      <span className="text-[10px] text-slate-500 block">Offline</span>
                      <span className="text-lg font-bold text-rose-400">{offlineCount}</span>
                    </div>
                    <div className="bg-white/2 border border-white/5 p-3 rounded-xl">
                      <span className="text-[10px] text-slate-500 block">Total</span>
                      <span className="text-lg font-bold text-white">{participants.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Connected Participant Table */}
              <div className="md:col-span-7 space-y-6">
                <div className="glass-panel border-white/5 p-6 rounded-2xl space-y-4 min-h-[350px] flex flex-col">
                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Users className="h-4.5 w-4.5 text-indigo-400" />
                      <span>Live Participant Grid ({participants.length})</span>
                    </h3>
                  </div>

                  <div className="flex-1 overflow-y-auto max-h-[320px] pr-1">
                    {participants.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center py-20 space-y-3">
                        <div className="h-10 w-10 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400 animate-pulse">
                          <Users className="h-5 w-5" />
                        </div>
                        <p className="text-xs text-slate-500 font-semibold">No participants connected yet.</p>
                      </div>
                    ) : (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 text-slate-500 uppercase font-bold tracking-wider">
                            <th className="py-2.5">Avatar</th>
                            <th className="py-2.5">Nickname</th>
                            <th className="py-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {participants.map((p, idx) => {
                            const initials = p.nickname.slice(0, 2).toUpperCase();
                            return (
                              <tr key={p.id || idx} className="border-b border-white/2 hover:bg-white/1 transition-colors">
                                <td className="py-2.5">
                                  <div className="h-7 w-7 rounded-full bg-indigo-500/20 border border-indigo-500/35 flex items-center justify-center text-[10px] font-bold text-indigo-300">
                                    {initials}
                                  </div>
                                </td>
                                <td className="py-2.5 text-white font-medium">{p.nickname}</td>
                                <td className="py-2.5">
                                  {p.connected ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                      Connected
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                      Offline
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Session Timeline Card */}
                <div className="glass-panel border-white/5 p-6 rounded-2xl space-y-4">
                  <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-indigo-400" />
                    Live Session Events
                  </h4>
                  <div className="space-y-3 max-h-[150px] overflow-y-auto pr-1">
                    {timeline.length === 0 ? (
                      <p className="text-[10px] text-slate-600 italic">No events logged yet.</p>
                    ) : (
                      timeline.map((ev, i) => (
                        <div key={i} className="flex gap-3 text-xs leading-relaxed">
                          <span className="text-[10px] text-slate-500 font-mono shrink-0">{ev.time}</span>
                          <span className="text-slate-300">{ev.text}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="glass-panel border-white/5 p-12 rounded-2xl text-center space-y-4 flex flex-col items-center justify-center min-h-[300px]">
              <div className="h-12 w-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-slate-400">
                <QrCode className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">No Active Session Selected</h4>
                <p className="text-xs text-slate-500 max-w-sm font-medium">Select an existing waiting/active session below or create a new session to get started.</p>
              </div>
            </div>
          )}

          {/* Waiting / Active / History Tabs */}
          <div className="space-y-4">
            <div className="flex border-b border-white/5 gap-4">
              {[
                { id: "waiting", label: `Waiting (${sessions.waiting.length})` },
                { id: "active", label: `Active (${sessions.active.length})` },
                { id: "history", label: `History (${sessions.recent.length})` }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-2.5 text-xs font-bold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? "border-indigo-500 text-indigo-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-3"
              >
                {activeTab === "waiting" && (
                  sessions.waiting.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center italic font-medium">No waiting sessions found.</p>
                  ) : (
                    sessions.waiting.map((s) => (
                      <div key={s.id} className="bg-white/2 border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-white/4 transition-colors">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-white">{s.quiz_title}</h4>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400 font-semibold uppercase">
                            <span>PIN: <span className="text-indigo-400 font-bold">{s.game_pin}</span></span>
                            <span>•</span>
                            <span>{s.total_participant_count} Players</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSelectSession(s)}
                          className="h-8 px-4 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 hover:border-indigo-500/35 rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          Monitor Lobby
                        </button>
                      </div>
                    ))
                  )
                )}

                {activeTab === "active" && (
                  sessions.active.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center italic font-medium">No active sessions found.</p>
                  ) : (
                    sessions.active.map((s) => (
                      <div key={s.id} className="bg-white/2 border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-white/4 transition-colors">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-white">{s.quiz_title}</h4>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400 font-semibold uppercase">
                            <span>PIN: <span className="text-indigo-400 font-bold">{s.game_pin}</span></span>
                            <span>•</span>
                            <span>{s.total_participant_count} Players</span>
                          </div>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => handleSelectSession(s)}
                            className="flex-1 sm:flex-none h-8 px-4 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 hover:border-indigo-500/35 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            Monitor Stats
                          </button>
                          <button
                            onClick={() => router.push(`/lobby/${s.game_pin}`)}
                            className="flex-1 sm:flex-none h-8 px-4 bg-indigo-600 hover:bg-indigo-550 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            View Live Panel
                          </button>
                        </div>
                      </div>
                    ))
                  )
                )}

                {activeTab === "history" && (
                  sessions.recent.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center italic font-medium">No finished sessions found.</p>
                  ) : (
                    sessions.recent.map((s) => (
                      <div key={s.id} className="bg-white/2 border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-white/4 transition-colors">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-white">{s.quiz_title}</h4>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400 font-semibold uppercase">
                            <span>PIN: <span className="text-slate-500 font-bold">{s.game_pin}</span></span>
                            <span>•</span>
                            <span>{s.total_participant_count} Players</span>
                            {s.ended_at && (
                              <>
                                <span>•</span>
                                <span>{new Date(s.ended_at).toLocaleDateString()}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => router.push(`/lobby/${s.game_pin}`)}
                            className="flex-1 sm:flex-none h-8 px-4 border border-white/10 hover:bg-white/5 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            View Report
                          </button>
                          <button
                            onClick={() => handleHostAgain(s)}
                            className="flex-1 sm:flex-none h-8 px-4 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 hover:border-indigo-500/35 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            Host Again
                          </button>
                        </div>
                      </div>
                    ))
                  )
                )}
              </motion.div>
            </AnimatePresence>
          </div>

        </div>

      </div>

    </div>
  );
}
