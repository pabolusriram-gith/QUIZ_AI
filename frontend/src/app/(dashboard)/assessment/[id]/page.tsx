"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Play, Clock, ArrowLeft, ArrowRight, Flag, Check, 
  AlertTriangle, HelpCircle, Save, LogOut, ShieldAlert, 
  FileText, Award, CheckCircle, XCircle, Eye, Info, Lock, Volume2, Loader2 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/services/api";
import { toast } from "sonner";
import { tokenStorage } from "@/utils/storage";

// Import modular components
import StudentLobby from "@/components/live/StudentLobby";
import StudentQuestion from "@/components/live/StudentQuestion";
import StudentResults from "@/components/live/StudentResults";
import Timer from "@/components/live/Timer";
import ScoreCard from "@/components/live/ScoreCard";
import LoadingSkeleton from "@/components/live/shared/LoadingSkeleton";
import ErrorState from "@/components/live/shared/ErrorState";
import ReconnectOverlay from "@/components/live/shared/ReconnectOverlay";

interface OfflineSavePayload {
  answers: Record<string, string[]>;
  question_analytics: Record<string, any>;
  time_spent_seconds: number;
  tab_switch_count: number;
  fullscreen_exit_count: number;
  copy_paste_count: number;
}

function AssessmentContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const initialView = searchParams.get("view") as "results" | null;
  const initialAttemptId = searchParams.get("attemptId") as string | null;

  // View States: "instructions" | "playing" | "confirmation" | "results"
  const [view, setView] = useState<"instructions" | "playing" | "confirmation" | "results">(
    initialView === "results" ? "results" : "instructions"
  );

  // Core Data States
  const [loading, setLoading] = useState(true);
  const [instructions, setInstructions] = useState<any>(null);
  const [attempt, setAttempt] = useState<any>(null);
  const [results, setResults] = useState<any>(null);
  const [questionsMap, setQuestionsMap] = useState<Record<string, any>>({});
  
  // Validation Passcode
  const [accessCode, setAccessCode] = useState("");
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);

  // Playback Navigation & State
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [analytics, setAnalytics] = useState<Record<string, any>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});

  // Timers State
  const [overallTimeLeft, setOverallTimeLeft] = useState<number | null>(null);
  const [questionTimeLeft, setQuestionTimeLeft] = useState<number | null>(null);
  const [timeSpentSeconds, setTimeSpentSeconds] = useState(0);
  
  // Telemetry Counts
  const [tabSwitches, setTabSwitches] = useState(0);
  const [fullscreenExits, setFullscreenExits] = useState(0);
  const [copyPastes, setCopyPastes] = useState(0);

  // Offline / Auto-save State
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const pendingSavePayloadRef = useRef<OfflineSavePayload | null>(null);
  const saveRequestIdRef = useRef(0);

  // Live Mode State
  const pin = searchParams ? searchParams.get("pin") : null;
  const nickname = searchParams ? (searchParams.get("nickname") || "") : "";
  const isLiveMode = !!pin;

  const [wsConnected, setWsConnected] = useState(false);
  const [wsQuality, setWsQuality] = useState<"connected" | "reconnecting" | "offline">("connected");
  const [latency, setLatency] = useState<number | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [liveRank, setLiveRank] = useState<number | null>(null);
  const [session, setSession] = useState<any>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const saveStatusTimerRef = useRef<NodeJS.Timeout | null>(null);
  const endTimeRef = useRef<number | null>(null);
  const clockOffsetRef = useRef<number>(0);
  const durationRef = useRef<number>(30);
  const isTimerPausedRef = useRef<boolean>(false);
  
  // WS Reconnection and Heartbeat refs
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPongAtRef = useRef<number>(Date.now());
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pingSentAtRef = useRef<number | null>(null);

  // Refs for tracking timer loops
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const analyticsTimeRef = useRef<Record<string, number>>({});

  // Refs to avoid stale closures
  const answersRef = useRef(answers);
  const flaggedRef = useRef(flagged);
  const currentIdxRef = useRef(currentIdx);
  const attemptRef = useRef(attempt);
  const timeSpentSecondsRef = useRef(timeSpentSeconds);

  // TTS State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const speakQuestion = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      toast.error("Speech synthesis is not supported in this browser.");
      return;
    }
    
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[`#_*\[\]()]/g, "").trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utteranceRef.current = utterance;
    
    utterance.onend = () => {
      utteranceRef.current = null;
      setIsSpeaking(false);
    };
    
    utterance.onerror = () => {
      utteranceRef.current = null;
      setIsSpeaking(false);
    };

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      utteranceRef.current = null;
      setIsSpeaking(false);
    };
  }, [currentIdx, view]);

  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { flaggedRef.current = flagged; }, [flagged]);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);
  useEffect(() => { attemptRef.current = attempt; }, [attempt]);
  useEffect(() => { timeSpentSecondsRef.current = timeSpentSeconds; }, [timeSpentSeconds]);

  // Establish WebSocket connection & State Recovery
  useEffect(() => {
    if (!isLiveMode || !attempt) return;

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    const wsBaseUrl = apiBaseUrl.replace(/^https:\/\//i, "wss://").replace(/^http:\/\//i, "ws://");
    const token = tokenStorage.getAccessToken();
    const connToken = sessionStorage.getItem(`connection_token:${pin}:${nickname}`);
    let wsUrl = `${wsBaseUrl}/sessions/ws/session/${pin}?role=student&nickname=${encodeURIComponent(nickname)}`;
    if (connToken) {
      wsUrl += `&connection_token=${encodeURIComponent(connToken)}`;
    }
    if (token) {
      wsUrl += `&token=${token}`;
    }

    console.log("[WS-Live] Connecting student:", wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      setWsQuality("connected");
      reconnectAttemptsRef.current = 0;
      lastPongAtRef.current = Date.now();

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "request_timer_sync", payload: {} }));
      }

      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      // Start heartbeat: send ping every 10 seconds
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

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "question_loaded",
          payload: { nickname }
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[WS-Live] Message received:", data);
        
        if (data.type === "pong") {
          lastPongAtRef.current = Date.now();
          setWsQuality("connected");
          if (pingSentAtRef.current) {
            setLatency(Date.now() - pingSentAtRef.current);
          }
          return;
        }

        const payload = data.payload;
        if (data.type === "session_state" && payload) {
          if (payload.current_question_index !== undefined) {
            setCurrentIdx(payload.current_question_index);
            currentIdxRef.current = payload.current_question_index;
          }
          if (payload.current_question_end_time) {
            setTimerStarted(true);
            const serverTime = payload.server_time ? new Date(payload.server_time).getTime() : Date.now();
            const clientNow = Date.now();
            clockOffsetRef.current = serverTime - clientNow;
            
            const endTime = new Date(payload.current_question_end_time).getTime();
            endTimeRef.current = endTime;
            isTimerPausedRef.current = payload.is_paused || false;
            
            const synchronizedNow = clientNow + clockOffsetRef.current;
            const remaining = Math.max(0, Math.round((endTime - synchronizedNow) / 1000));
            setQuestionTimeLeft(remaining);
          } else if (payload.remaining_time !== undefined && payload.remaining_time > 0) {
            setTimerStarted(true);
            setQuestionTimeLeft(payload.remaining_time);
          } else {
            setTimerStarted(false);
            setQuestionTimeLeft(null);
          }
          if (payload.answers_locked !== undefined) setIsSubmitted(payload.answers_locked);
          if (payload.answered_count !== undefined) setAnsweredCount(payload.answered_count);
        } else if (data.type === "timer_sync" && payload) {
          setTimerStarted(true);
          
          const serverTime = new Date(payload.server_time).getTime();
          const clientNow = Date.now();
          clockOffsetRef.current = serverTime - clientNow;
          
          const endTime = new Date(payload.question_end_time).getTime();
          endTimeRef.current = endTime;
          durationRef.current = payload.duration;
          isTimerPausedRef.current = payload.is_paused || false;
          
          const synchronizedNow = clientNow + clockOffsetRef.current;
          const remaining = Math.max(0, Math.round((endTime - synchronizedNow) / 1000));
          
          setQuestionTimeLeft(remaining);
          
          if (payload.question_index !== undefined && payload.question_index !== currentIdxRef.current) {
            setCurrentIdx(payload.question_index);
            currentIdxRef.current = payload.question_index;
          }
        } else if (data.type === "pause_game") {
          isTimerPausedRef.current = true;
          toast.info("Host paused the quiz timer.");
        } else if (data.type === "resume_game") {
          isTimerPausedRef.current = false;
          toast.info("Quiz resumed.");
        } else if (data.type === "session_update" && payload) {
          if (payload.answered_count !== undefined) setAnsweredCount(payload.answered_count);
          if (payload.total_players !== undefined) setTotalPlayers(payload.total_players);
        } else if (data.type === "start_timer" && payload) {
          setTimerStarted(true);
          setIsSubmitted(false);
          if (payload.current_question_end_time) {
            const serverTime = payload.server_time ? new Date(payload.server_time).getTime() : Date.now();
            const clientNow = Date.now();
            clockOffsetRef.current = serverTime - clientNow;
            
            const endTime = new Date(payload.current_question_end_time).getTime();
            endTimeRef.current = endTime;
            isTimerPausedRef.current = false;
            
            const synchronizedNow = clientNow + clockOffsetRef.current;
            const remaining = Math.max(0, Math.round((endTime - synchronizedNow) / 1000));
            setQuestionTimeLeft(remaining);
          }
        } else if (data.type === "next_question" && payload) {
          const nextIdx = payload.current_question_index;
          setCurrentIdx(nextIdx);
          currentIdxRef.current = nextIdx;
          setIsSubmitted(payload.answers_locked || false);
          setShowLeaderboard(false);
          isTimerPausedRef.current = payload.is_paused || false;

          if (payload.question_end_time) {
            setTimerStarted(true);
            const serverTime = payload.server_time ? new Date(payload.server_time).getTime() : Date.now();
            const clientNow = Date.now();
            clockOffsetRef.current = serverTime - clientNow;
            
            const endTime = new Date(payload.question_end_time).getTime();
            endTimeRef.current = endTime;
            durationRef.current = payload.duration;
            
            const synchronizedNow = clientNow + clockOffsetRef.current;
            const remaining = Math.max(0, Math.round((endTime - synchronizedNow) / 1000));
            setQuestionTimeLeft(remaining);
          } else {
            const nextQId = attemptRef.current?.randomized_question_ids?.[nextIdx];
            const qMeta = nextQId ? questionsMap[nextQId] : null;
            const duration = qMeta?.time_limit_seconds || 30;
            durationRef.current = duration;
            endTimeRef.current = null;
            setTimerStarted(true);
            setQuestionTimeLeft(duration);
          }

          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: "question_loaded",
              payload: { nickname }
            }));
          }
        } else if (data.type === "show_leaderboard") {
          api.get(`/sessions/${pin}/leaderboard`).then(res => {
            setLeaderboard(res.data);
            setShowLeaderboard(true);
          }).catch(err => console.error(err));
        } else if (data.type === "hide_leaderboard") {
          setShowLeaderboard(false);
        } else if (data.type === "restart_game") {
          router.push(`/waiting/${pin}?nickname=${nickname}`);
        } else if (data.type === "restart_question" && payload) {
          setTimerStarted(false);
          setIsSubmitted(false);
          setQuestionTimeLeft(null);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: "question_loaded",
              payload: { nickname }
            }));
          }
        } else if (data.type === "player_kicked" && payload?.nickname === nickname) {
          toast.error("You were removed from the session by the host.");
          router.push("/dashboard");
        } else if (data.type === "question_finished" || data.type === "answer_locked") {
          setIsSubmitted(true);
        } else if (data.type === "end_game" || data.type === "session_finished") {
          submitAssessment();
        }
      } catch (err) {
        console.error("[WS-Live] Error parsing websocket message:", err);
      }
    };

    ws.onclose = (event) => {
      setWsConnected(false);
      setWsQuality("offline");
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      // Auto-reconnect with exponential backoff if not clean close
      if (event.code !== 1000 && event.code !== 4005 && event.code !== 4006) {
        const attempts = reconnectAttemptsRef.current;
        const delay = Math.min(3000 * Math.pow(2, attempts), 30000);
        console.log(`[WS-Live] Disconnected. Reconnecting in ${delay / 1000}s (attempt ${attempts + 1})...`);
        reconnectAttemptsRef.current += 1;
        
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectTrigger(prev => prev + 1);
        }, delay);
      }
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
      ws.close(1000, "Unmounted");
    };
  }, [isLiveMode, pin, nickname, attempt, reconnectTrigger]);

  useEffect(() => {
    if (!isLiveMode) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("[Visibility] Tab active again. Requesting timer sync...");
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "request_timer_sync", payload: {} }));
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isLiveMode]);

  const [reconnectSecondsLeft, setReconnectSecondsLeft] = useState(30);

  useEffect(() => {
    if (!isLiveMode || wsConnected) {
      setReconnectSecondsLeft(30);
      return;
    }

    const interval = setInterval(() => {
      setReconnectSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          saveProgressPayload();
          toast.error("Connection timeout. Autosaved current choices.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [wsConnected, isLiveMode]);

  useEffect(() => {
    if (isLiveMode && pin && view === "results") {
      api.get(`/sessions/${pin}/leaderboard`)
        .then((res: any) => {
          const leader = res.data || [];
          const idx = leader.findIndex((p: any) => p.nickname === nickname);
          if (idx !== -1) {
            setLiveRank(idx + 1);
          }
        })
        .catch((err: any) => console.error(err));
    }
  }, [view, isLiveMode, pin, nickname]);

  useEffect(() => {
    if (isLiveMode && pin) {
      api.get(`/sessions/${pin}`)
        .then((res: any) => {
          setSession(res.data);
        })
        .catch((err: any) => {
          console.error("Failed to fetch session details:", err);
        });
    }
  }, [isLiveMode, pin]);

  // Keyboard shortcut listener for option selections
  useEffect(() => {
    if (view !== "playing" || isSubmitted) return;

    const handleKeys = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }

      const currentQId = attempt?.randomized_question_ids?.[currentIdx];
      const qMeta = questionsMap[currentQId];
      if (!qMeta) return;

      if (["1", "2", "3", "4"].includes(e.key)) {
        const optionIdx = parseInt(e.key) - 1;
        const opt = qMeta.options?.[optionIdx];
        if (opt) {
          selectAnswer(qMeta.id, opt.id, qMeta.question_type === "multiple_select");
        }
      }
    };

    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [view, currentIdx, attempt, questionsMap, isSubmitted]);

  // 1. Fetch initial quiz info on mount
  useEffect(() => {
    if (initialView === "results" && initialAttemptId) {
      fetchResults(initialAttemptId);
    } else {
      fetchInstructions();
    }

    const handleOnline = () => {
      setIsOffline(false);
      toast.success("Connection restored! Syncing offline saves...");
      flushOfflineQueue();
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.error("Connection lost. Answers will be saved locally.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      stopTimers();
      if (saveStatusTimerRef.current) {
        clearTimeout(saveStatusTimerRef.current);
      }
    };
  }, [id]);

  const fetchInstructions = async () => {
    try {
      setLoading(true);
      if (isLiveMode && nickname && !tokenStorage.getAccessToken()) {
        try {
          const guestRes = await api.post("/auth/guest-login", { nickname });
          tokenStorage.setAccessToken(guestRes.data.access_token, false);
          tokenStorage.setRefreshToken(guestRes.data.refresh_token, false);
        } catch (authErr) {
          console.warn("Guest auth initialization in live assessment:", authErr);
        }
      }
      const res = await api.get(`/quizzes/${id}/instructions`);
      setInstructions(res.data);
      if (res.data.has_active_attempt && res.data.active_attempt_id) {
        toast.success("Restoring your previous in-progress session...");
        startAttempt(res.data.active_attempt_id);
      } else if (isLiveMode) {
        handleStartQuiz();
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to load quiz instructions.");
      if (isLiveMode && pin) {
        router.push(`/waiting/${pin}?nickname=${encodeURIComponent(nickname)}`);
      } else {
        router.push("/dashboard");
      }
    }
  };

  const fetchResults = async (attemptId: string) => {
    try {
      setLoading(true);
      const res = await api.get(`/quizzes/attempts/${attemptId}/results`);
      setResults(res.data);
      setView("results");
      setLoading(false);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to load results feedback.");
      setView("instructions");
      fetchInstructions();
    }
  };

  const handleStartQuiz = async () => {
    if (instructions?.requires_access_code && !accessCode.trim()) {
      toast.error("Please enter the quiz access passcode.");
      return;
    }

    try {
      setIsSubmittingCode(true);
      const res = await api.post(`/quizzes/${id}/attempts`, {
        access_code: accessCode || undefined
      });
      startAttempt(res.data.id);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Passcode verification failed.");
      setIsSubmittingCode(false);
    }
  };

  const startAttempt = async (attemptId: string) => {
    try {
      setLoading(true);
      const quizRes = await api.get(`/quizzes/${id}`);
      const quizData = quizRes.data;
      
      const qMap: Record<string, any> = {};
      quizData.questions.forEach((q: any) => {
        qMap[q.id] = q;
      });
      setQuestionsMap(qMap);

      const attemptRes = await api.put(`/quizzes/${id}/attempts/${attemptId}/save-progress`, {
        answers: {},
        question_analytics: {},
        time_spent_seconds: 0,
        tab_switch_count: 0,
        fullscreen_exit_count: 0,
        copy_paste_count: 0
      });
      
      const session = attemptRes.data;
      setAttempt(session);
      setAnswers(session.answers || {});
      setAnalytics(session.question_analytics || {});
      
      const initialFlagged: Record<string, boolean> = {};
      Object.keys(session.question_analytics || {}).forEach(k => {
        initialFlagged[k] = session.question_analytics[k].flagged || false;
      });
      setFlagged(initialFlagged);
      setTimeSpentSeconds(session.time_spent_seconds || 0);

      if (quizData.timer_mode === "overall" || quizData.timer_mode === "both") {
        const timeLimit = quizData.overall_time_limit_seconds || (quizData.duration * 60);
        const elapsed = session.time_spent_seconds || 0;
        setOverallTimeLeft(Math.max(0, timeLimit - elapsed));
      }

      setTimerStarted(true);
      setView("playing");
      setLoading(false);
      setIsSubmittingCode(false);

      if (quizData.fullscreen_required) {
        requestFullscreenMode();
      }

      startTimers(quizData, session);
      registerTelemetryListeners();
    } catch (err: any) {
      toast.error("Failed to sync attempt session parameters.");
      setLoading(false);
      setIsSubmittingCode(false);
    }
  };

  const startTimers = (quiz: any, activeSession = attemptRef.current) => {
    stopTimers();
    
    const currentQId = activeSession?.randomized_question_ids?.[currentIdxRef.current];
    if (currentQId && (quiz.timer_mode === "per_question" || quiz.timer_mode === "both")) {
      const qMeta = questionsMap[currentQId];
      if (qMeta) {
        setQuestionTimeLeft(qMeta.time_limit_seconds || 30);
      }
    }

    timerIntervalRef.current = setInterval(() => {
      setTimeSpentSeconds(prev => {
        const nextTime = prev + 1;
        if (nextTime % 15 === 0) {
          triggerAutoSave(nextTime);
        }
        return nextTime;
      });

      const currentQId = attemptRef.current?.randomized_question_ids?.[currentIdxRef.current];
      if (currentQId) {
        analyticsTimeRef.current[currentQId] = (analyticsTimeRef.current[currentQId] || 0) + 1;
      }

      if (quiz.timer_mode === "overall" || quiz.timer_mode === "both") {
        setOverallTimeLeft(prev => {
          if (prev === null) return null;
          if (prev <= 1) {
            handleOverallTimerExpiry();
            return 0;
          }
          return prev - 1;
        });
      }

      if (quiz.timer_mode === "per_question" || quiz.timer_mode === "both" || isLiveMode) {
        if (isLiveMode) {
          if (!isTimerPausedRef.current) {
            if (endTimeRef.current !== null) {
              const clientNow = Date.now();
              const synchronizedNow = clientNow + clockOffsetRef.current;
              const remaining = Math.max(0, Math.round((endTimeRef.current - synchronizedNow) / 1000));
              setQuestionTimeLeft(remaining);
              if (remaining <= 0) {
                setIsSubmitted(true);
              }
            } else {
              setQuestionTimeLeft(prev => {
                if (prev === null) return null;
                if (prev <= 1) {
                  setIsSubmitted(true);
                  return 0;
                }
                return prev - 1;
              });
            }
          }
        } else {
          setQuestionTimeLeft(prev => {
            if (prev === null) return null;
            if (prev <= 1) {
              handleQuestionTimerExpiry();
              return 0;
            }
            return prev - 1;
          });
        }
      }
    }, 1000);
  };

  const stopTimers = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
  };

  const handleOverallTimerExpiry = () => {
    stopTimers();
    toast.error("Assessment duration has expired! Auto-submitting responses...");
    submitAssessment(true);
  };

  const handleQuestionTimerExpiry = () => {
    toast.warning("Time limit expired for this question! Advancing...");
    if (currentIdxRef.current < (attemptRef.current?.randomized_question_ids?.length || 0) - 1) {
      const nextIdx = currentIdxRef.current + 1;
      setCurrentIdx(nextIdx);
      const nextQId = attemptRef.current?.randomized_question_ids?.[nextIdx];
      const qMeta = questionsMap[nextQId];
      setQuestionTimeLeft(qMeta?.time_limit_seconds || 30);
    } else {
      setView("confirmation");
    }
  };

  useEffect(() => {
    if (view !== "playing" || !instructions) return;
    const currentQId = attempt?.randomized_question_ids?.[currentIdx];
    if (currentQId && (instructions.timer_mode === "per_question" || instructions.timer_mode === "both")) {
      const qMeta = questionsMap[currentQId];
      setQuestionTimeLeft(qMeta?.time_limit_seconds || 30);
    }
  }, [currentIdx, view]);

  const registerTelemetryListeners = () => {
    const handleVisibility = () => {
      if (document.hidden) {
        setTabSwitches(prev => {
          const count = prev + 1;
          toast.error(`Anti-Cheat Warning: Tab Switch Detected (${count})`);
          return count;
        });
      }
    };

    const handleFullscreenExit = () => {
      if (!document.fullscreenElement) {
        setFullscreenExits(prev => {
          const count = prev + 1;
          toast.warning(`Anti-Cheat Warning: Fullscreen Mode Exited (${count})`);
          return count;
        });
      }
    };

    const handleCopyPaste = (e: Event) => {
      e.preventDefault();
      setCopyPastes(prev => {
        const count = prev + 1;
        toast.warning("Copying or pasting content is disabled during assessments.");
        return count;
      });
    };

    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("fullscreenchange", handleFullscreenExit);
    document.addEventListener("copy", handleCopyPaste);
    document.addEventListener("paste", handleCopyPaste);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("fullscreenchange", handleFullscreenExit);
      document.removeEventListener("copy", handleCopyPaste);
      document.removeEventListener("paste", handleCopyPaste);
    };
  };

  const requestFullscreenMode = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {
        toast.error("Could not activate security fullscreen mode.");
      });
    }
  };

  const selectAnswer = (qId: string, value: string, isMulti: boolean) => {
    const current = answersRef.current[qId] || [];
    let updated;
    if (isMulti) {
      updated = current.includes(value)
        ? current.filter(x => x !== value)
        : [...current, value];
    } else {
      updated = [value];
    }
    const newAnswers = { ...answersRef.current, [qId]: updated };
    answersRef.current = newAnswers;
    setAnswers(newAnswers);
    saveProgressPayload(newAnswers, flaggedRef.current);
  };

  const handleTextInput = (qId: string, text: string) => {
    const newAnswers = { ...answersRef.current, [qId]: [text] };
    answersRef.current = newAnswers;
    setAnswers(newAnswers);
    saveProgressPayload(newAnswers, flaggedRef.current);
  };

  const toggleFlagged = (qId: string) => {
    const nextFlags = { ...flaggedRef.current, [qId]: !flaggedRef.current[qId] };
    flaggedRef.current = nextFlags;
    setFlagged(nextFlags);
    saveProgressPayload(answersRef.current, nextFlags);
  };

  const saveProgressPayload = async (
    currentAnswers = answersRef.current, 
    currentFlags = flaggedRef.current,
    timeSpent = timeSpentSecondsRef.current
  ) => {
    const questionAnalytics: Record<string, any> = {};
    const activeSession = attemptRef.current;
    if (!activeSession) return;
    
    activeSession?.randomized_question_ids?.forEach((qId: string) => {
      questionAnalytics[qId] = {
        time_spent_seconds: analyticsTimeRef.current[qId] || 0,
        flagged: currentFlags[qId] || false,
        skipped: !currentAnswers[qId] || currentAnswers[qId].length === 0
      };
    });

    const payload: OfflineSavePayload = {
      answers: currentAnswers,
      question_analytics: questionAnalytics,
      time_spent_seconds: timeSpent,
      tab_switch_count: tabSwitches,
      fullscreen_exit_count: fullscreenExits,
      copy_paste_count: copyPastes
    };

    pendingSavePayloadRef.current = payload;
    saveRequestIdRef.current += 1;
    const currentRequestId = saveRequestIdRef.current;

    const attemptSave = async (retryCount = 0) => {
      if (currentRequestId !== saveRequestIdRef.current) return;

      setSaveStatus("saving");
      setIsSyncing(true);

      try {
        await api.put(`/quizzes/${id}/attempts/${activeSession.id}/save-progress`, payload);
        
        if (currentRequestId === saveRequestIdRef.current) {
          setIsSyncing(false);
          setSaveStatus("saved");
          pendingSavePayloadRef.current = null;

          if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
          saveStatusTimerRef.current = setTimeout(() => {
            if (saveRequestIdRef.current === currentRequestId) {
              setSaveStatus("idle");
            }
          }, 2000);
        }
      } catch (err) {
        console.error("Auto-save sync failed:", err);
        
        if (currentRequestId === saveRequestIdRef.current) {
          setIsSyncing(false);
          setSaveStatus("failed");
          
          const nextRetryCount = retryCount + 1;
          const delay = Math.min(1000 * Math.pow(2, retryCount), 16000);
          
          if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
          saveStatusTimerRef.current = setTimeout(() => {
            attemptSave(nextRetryCount);
          }, delay);
        }
      }
    };

    attemptSave(0);
  };

  const triggerAutoSave = (timeVal: number) => {
    saveProgressPayload(answersRef.current, flaggedRef.current, timeVal);
  };

  const flushOfflineQueue = async () => {
    if (!pendingSavePayloadRef.current) return;
    const latestPayload = pendingSavePayloadRef.current;
    saveProgressPayload(latestPayload.answers, flaggedRef.current, latestPayload.time_spent_seconds);
  };

  const handleSaveAndExit = async () => {
    stopTimers();
    await saveProgressPayload();
    const activeSession = attemptRef.current;
    if (activeSession && pendingSavePayloadRef.current) {
      try {
        await api.put(`/quizzes/${id}/attempts/${activeSession.id}/save-progress`, pendingSavePayloadRef.current);
        pendingSavePayloadRef.current = null;
      } catch (err) {
        console.error("Failed to sync save progress on exit:", err);
      }
    }
    toast.success("Progress saved! You can resume this attempt later.");
    
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    router.push("/dashboard");
  };

  const submitAssessment = async (forced = false) => {
    setLoading(true);
    stopTimers();
    
    const activeSession = attemptRef.current;
    if (!activeSession) return;

    if (pendingSavePayloadRef.current) {
      try {
        const savePromise = api.put(`/quizzes/${id}/attempts/${activeSession.id}/save-progress`, pendingSavePayloadRef.current);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1000));
        
        await Promise.race([savePromise, timeoutPromise]);
        pendingSavePayloadRef.current = null;
      } catch (err) {
        console.warn("Could not flush save progress, proceeding to submit:", err);
      }
    }
    
    const questionAnalytics: Record<string, any> = {};
    activeSession?.randomized_question_ids?.forEach((qId: string) => {
      questionAnalytics[qId] = {
        time_spent_seconds: analyticsTimeRef.current[qId] || 0,
        flagged: flaggedRef.current[qId] || false,
        skipped: !answersRef.current[qId] || answersRef.current[qId].length === 0
      };
    });

    const payload = {
      answers: answersRef.current,
      question_analytics: questionAnalytics,
      time_spent_seconds: timeSpentSecondsRef.current,
      tab_switch_count: tabSwitches,
      fullscreen_exit_count: fullscreenExits,
      copy_paste_count: copyPastes
    };

    try {
      const res = await api.post(`/quizzes/${id}/attempts/${activeSession.id}/submit`, payload);
      toast.success("Assessment submitted successfully!");
      
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      fetchResults(res.data.id);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Submission failed. Please check network connectivity.");
      setLoading(false);
      startTimers(instructions);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins}:${remaining < 10 ? "0" : ""}${remaining}`;
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  // --- RENDER ERROR OVERLAY IN CASE OF CONNECTION TIMEOUT ---
  if (isLiveMode && !wsConnected && reconnectSecondsLeft <= 0) {
    return (
      <div className="container mx-auto p-6 text-center">
        <ErrorState
          type="network_lost"
          message="WebSocket connection timed out after 30 seconds of disconnect. Progress saved locally."
          onAction={() => setReconnectTrigger(prev => prev + 1)}
          actionText="Try Reconnecting"
        />
      </div>
    );
  }

  // ==========================================
  // VIEW: INSTRUCTIONS PAGE
  // ==========================================
  if (view === "instructions") {
    return (
      <div className="max-w-3xl mx-auto space-y-8 pb-10">
        <PageHeader
          title="Quiz Instructions"
          description="Read instructions thoroughly before starting the exam session."
        />

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-50/80 dark:bg-[#0c1427]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 md:p-8 space-y-6 shadow-xl"
        >
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">{instructions?.title}</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm">{instructions?.description || "No description provided."}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4 border-y border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Duration</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">{instructions?.duration} Minutes</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Total Marks</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">{instructions?.total_marks} Marks</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Pass Mark</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">{instructions?.pass_percentage || 40}% Pass Rate</div>
              </div>
            </div>
          </div>

          {instructions?.fullscreen_required && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3 text-xs text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold">Security Mode Active</span>
                <p className="text-slate-600 dark:text-slate-400 text-[10px] font-semibold leading-relaxed">
                  This test requires Fullscreen Mode and has anti-cheat tab-switching guards. Exiting fullscreen or navigating away will log violations.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard")}
              className="rounded-xl border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 px-4.5 h-11 border cursor-pointer transition-colors"
            >
              Cancel
            </Button>

            <Button
              disabled={isSubmittingCode}
              onClick={handleStartQuiz}
              className="rounded-xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold px-6 h-11 flex items-center gap-2 border-none cursor-pointer shadow-md shadow-indigo-500/20 transition-all"
            >
              <span>{isSubmittingCode ? "Verifying..." : "Start Attempt"}</span>
              <Play className="h-4 w-4 fill-current" />
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ==========================================
  // VIEW: PLAYING QUIZ PANEL
  // ==========================================
  if (view === "playing") {
    // If in Live Lobby wait mode
    if (isLiveMode && session?.status === "waiting") {
      return (
        <div className="space-y-6 pb-10 w-full">
          <StudentLobby
            pin={pin}
            nickname={nickname}
            session={session}
            wsConnected={wsConnected}
            wsQuality={wsQuality}
            latency={latency}
            participants={participants}
          />
        </div>
      );
    }

    const currentQId = attempt?.randomized_question_ids?.[currentIdx];
    const qData = questionsMap[currentQId];
    const selectedAnswer = answers[currentQId] || [];

    return (
      <div
        style={{
          filter: highContrast ? "contrast(1.4) saturate(1.5)" : "none",
          fontSize: largeText ? "1.18rem" : "1rem"
        }}
        className="space-y-6 pb-10 w-full max-w-4xl mx-auto"
      >
        {/* Reconnect overlay if disconnected */}
        {isLiveMode && !wsConnected && (
          <ReconnectOverlay
            attempts={reconnectAttemptsRef.current}
            maxAttempts={5}
            secondsLeft={reconnectSecondsLeft}
          />
        )}

        {/* Accessibility Widgets */}
        <div className="fixed bottom-4 right-4 z-40 bg-slate-100/90 dark:bg-[#0a1124]/90 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md rounded-2xl p-2 flex items-center gap-1.5 shadow-2xl">
          <button
            onClick={() => setHighContrast(!highContrast)}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold cursor-pointer transition ${
              highContrast ? "bg-indigo-600 text-white" : "bg-slate-200/80 dark:bg-white/5 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
            title="Toggle High Contrast"
          >
            ◐ Contrast
          </button>
          <button
            onClick={() => setLargeText(!largeText)}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold cursor-pointer transition ${
              largeText ? "bg-indigo-600 text-white" : "bg-slate-200/80 dark:bg-white/5 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
            title="Toggle Large Fonts"
          >
            A+ Font
          </button>
        </div>

        {/* Playback Header bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50/80 dark:bg-[#0c1427]/85 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4.5 backdrop-blur-md shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-200/70 dark:bg-slate-800/70 border border-slate-300/70 dark:border-slate-700/70 px-3 py-1.5 rounded-xl">
              Question {currentIdx + 1} of {attempt?.randomized_question_ids?.length}
            </span>
            {saveStatus === "saving" && (
              <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold animate-pulse flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full">
                <span>↻ Saving...</span>
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                <CheckCircle className="h-3 w-3" />
                <span>✓ Saved</span>
              </span>
            )}
            {isOffline && (
              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Offline Mode (Saved Locally)</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {overallTimeLeft !== null && (
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-mono font-bold text-sm bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl">
                <Clock className="h-4 w-4 animate-spin" />
                <span>Overall: {formatTime(overallTimeLeft)}</span>
              </div>
            )}
            {!isLiveMode && (
              <Button
                variant="outline"
                onClick={handleSaveAndExit}
                className="rounded-xl border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 px-3.5 h-9 border flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save & Exit</span>
              </Button>
            )}
          </div>
        </div>

        <StudentQuestion
          question={qData}
          randomizedOptionIds={attempt?.randomized_option_ids?.[currentQId]}
          selectedAnswer={selectedAnswer}
          isSubmitted={isSubmitted}
          timerStarted={timerStarted}
          questionTimeLeft={questionTimeLeft}
          currentIdx={currentIdx}
          totalQs={attempt?.randomized_question_ids?.length || 0}
          answeredCount={answeredCount}
          totalPlayers={totalPlayers}
          isSpeaking={isSpeaking}
          isSoloMode={!isLiveMode}
          isFlagged={Boolean(flagged[currentQId])}
          onToggleFlag={() => toggleFlagged(currentQId)}
          onSelectAnswer={(optId, isMulti) => selectAnswer(qData.id, optId, isMulti)}
          onTextInput={(text) => handleTextInput(qData.id, text)}
          onNextQuestion={() => {
            const totalQuestions = attempt?.randomized_question_ids?.length || 0;
            if (currentIdx < totalQuestions - 1) {
              const nextIdx = currentIdx + 1;
              setCurrentIdx(nextIdx);
              const nextQId = attempt?.randomized_question_ids?.[nextIdx];
              const qMeta = questionsMap[nextQId];
              if (qMeta && (instructions?.timer_mode === "per_question" || instructions?.timer_mode === "both")) {
                setQuestionTimeLeft(qMeta.time_limit_seconds || 30);
              }
            }
          }}
          onPrevQuestion={() => {
            if (currentIdx > 0) {
              setCurrentIdx(prev => prev - 1);
            }
          }}
          onReviewSubmit={() => setView("confirmation")}
          onSubmit={async () => {
            await saveProgressPayload();
            setIsSubmitted(true);
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: "question_loaded",
                payload: { nickname }
              }));
            }
          }}
          onSpeak={() => speakQuestion(qData.text)}
        />
      </div>
    );
  }

  // ==========================================
  // VIEW: CONFIRMATION/REVIEW GATE
  // ==========================================
  if (view === "confirmation") {
    const totalQuestions = attempt?.randomized_question_ids?.length || 0;
    const answeredCount = Object.keys(answers).filter(
      k => answers[k] && answers[k].length > 0 && answers[k][0] !== ""
    ).length;
    const unansweredCount = totalQuestions - answeredCount;

    return (
      <div className="max-w-md mx-auto space-y-6 pb-10">
        <PageHeader
          title="Review Submissions"
          description="Verify choices before finalizing your submission."
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-50/80 dark:bg-[#0c1427]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 md:p-8 space-y-6 text-center shadow-xl"
        >
          <div className="h-14 w-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto">
            <Info className="h-6 w-6" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Ready to Submit?</h3>
            <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold px-4 leading-relaxed">
              Once submitted, you will not be able to change your choices or resume the attempt.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="p-4 bg-slate-100/70 dark:bg-[#121c33]/70 border border-slate-200 dark:border-slate-700/60 rounded-xl">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">Answered</span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 block mt-1">{answeredCount}</span>
            </div>
            <div className={`p-4 rounded-xl border ${
              unansweredCount > 0 
                ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400" 
                : "bg-slate-100/70 dark:bg-[#121c33]/70 border-slate-200 dark:border-slate-700/60 text-slate-500 dark:text-slate-400"
            }`}>
              <span className="text-[10px] font-bold uppercase tracking-wider block">Unanswered</span>
              <span className="text-xl font-black block mt-1">{unansweredCount}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            <Button
              onClick={() => submitAssessment(false)}
              className="w-full h-11 bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer border-none shadow-md shadow-indigo-500/20 transition-all"
            >
              <Check className="h-4.5 w-4.5" />
              <span>Finalize & Submit</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => setView("playing")}
              className="w-full h-11 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-bold rounded-xl cursor-pointer transition-colors"
            >
              Back to Assessment
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ==========================================
  // VIEW: RESULTS FEEDBACK PAGE
  // ==========================================
  if (view === "results") {
    return (
      <div className="space-y-6 pb-10 w-full">
        <StudentResults
          pin={pin || "000000"}
          nickname={nickname}
          results={results}
          onGoHome={() => router.push(isLiveMode ? "/" : "/dashboard")}
        />
      </div>
    );
  }

  return null;
}

function AssessmentPageWrapper() {
  const searchParams = useSearchParams();
  const pin = searchParams ? searchParams.get("pin") : null;

  if (pin) {
    // Live mode assessment: Allow anonymous guest students without requiring account login
    return <AssessmentContent />;
  }

  return (
    <ProtectedRoute allowedRoles={["student", "teacher", "admin"]}>
      <AssessmentContent />
    </ProtectedRoute>
  );
}

export default function AssessmentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-[#060b18] flex items-center justify-center text-slate-800 dark:text-white">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    }>
      <AssessmentPageWrapper />
    </Suspense>
  );
}
