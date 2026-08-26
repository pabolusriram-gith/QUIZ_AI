"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { tokenStorage } from "@/utils/storage";
import { Loader2, ArrowLeft, BrainCircuit, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import api from "@/services/api";
import { toast } from "sonner";

function WaitingRoomContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = tokenStorage.getAccessToken();

  const pin = params?.pin as string;
  const nickname = searchParams.get("nickname") || "";

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [countdownVal, setCountdownVal] = useState<number | string | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  // Set to true the moment we trigger any router.push so the WS effect
  // does not open a connection while navigation is already in flight.
  const isRedirecting = useRef(false);

  // Fetch session details on load to verify it exists and is waiting
  useEffect(() => {
    if (!pin) return;

    const checkSession = async () => {
      try {
        const res = await api.get(`/sessions/${pin}`);
        setSession(res.data);
        if (res.data.status === "active") {
          // Host has already started — skip the waiting room entirely and
          // drop the student straight into the live assessment.
          toast.success("Quiz has already started! Redirecting...");
          isRedirecting.current = true;
          router.push(`/assessment/${res.data.quiz_id}?pin=${pin}&nickname=${encodeURIComponent(nickname)}`);
          return; // isRedirecting.current=true blocks the WS effect; finally will still run
        } else if (res.data.status === "finished") {
          setErrorMsg("This game session has already finished.");
        }
      } catch (err: any) {
        console.error(err);
        if (err?.response?.status === 410) {
          setErrorMsg("This game session has already ended.");
        } else {
          setErrorMsg(err.response?.data?.detail || "Game session not found.");
        }
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, [pin, router]);

  // Establish WebSocket connection with auto-reconnect on unexpected drops
  useEffect(() => {
    if (!pin || !nickname || loading || errorMsg || isRedirecting.current) return;

    let isMounted = true;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    const BASE_RECONNECT_DELAY_MS = 2000;

    const connect = async () => {
      if (!isMounted) return;

      // Before (re)opening the WebSocket, call the HTTP join endpoint so that
      // the backend's zombie-detection and duplicate-guard logic runs first.
      // On the first join this was already done by join/page.tsx; here we call
      // it again on reconnect so the server can reclaim a zombie participant.
      try {
        const joinRes = await api.post(
          `/sessions/${pin}/join`,
          { nickname },
          token ? { params: { token } } : undefined
        );
        if (joinRes.data && joinRes.data.connection_token) {
          sessionStorage.setItem(`connection_token:${pin}:${nickname}`, joinRes.data.connection_token);
        }
        if (joinRes.data && joinRes.data.access_token && joinRes.data.refresh_token) {
          tokenStorage.setAccessToken(joinRes.data.access_token, false);
          tokenStorage.setRefreshToken(joinRes.data.refresh_token, false);
        }
      } catch (joinErr: any) {
        const status = joinErr?.response?.status;
        const detail = joinErr?.response?.data?.detail;
        if (status === 410) {
          setErrorMsg(detail || "This game session has already ended.");
          return;
        }
        if (status === 409 && reconnectAttempts === 0) {
          // Already joined (409 on initial mount before any reconnects)
          // This is expected when navigating directly back — continue.
        } else if (status !== 409) {
          // Non-conflict errors on a reconnect attempt are terminal
          setErrorMsg(detail || "Unable to rejoin the session.");
          return;
        }
      }

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const wsBaseUrl = apiBaseUrl.replace(/^https:\/\//i, "wss://").replace(/^http:\/\//i, "ws://");

      const connToken = sessionStorage.getItem(`connection_token:${pin}:${nickname}`);
      let wsUrl = `${wsBaseUrl}/sessions/ws/session/${pin}?role=student&nickname=${encodeURIComponent(nickname)}`;
      if (connToken) {
        wsUrl += `&connection_token=${encodeURIComponent(connToken)}`;
      }
      if (token) {
        wsUrl += `&token=${token}`;
      }

      console.log(`[WS] Connecting student to: ${wsUrl} (attempt ${reconnectAttempts + 1})`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) { ws.close(1000, "Component unmounted"); return; }
        console.log("[WS] Student connected to waiting room channel.");
        setWsConnected(true);
        reconnectAttempts = 0; // reset on successful connection
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          console.log("[WS] Student received message:", data);

          const payload = data.payload;
          if (data.type === "session_update" && payload) {
            if (payload.participants !== undefined) {
              setParticipants(payload.participants);
            }
            if (payload.status === "active" && !isRedirecting.current) {
              isRedirecting.current = true;
              toast.success("The host has started the quiz!");
              router.push(`/assessment/${session?.quiz_id || payload.quiz_id || ''}?pin=${pin}&nickname=${encodeURIComponent(nickname)}`);
            }
          } else if (data.type === "start_game" && payload) {
            if (!isRedirecting.current) {
              isRedirecting.current = true;
              toast.success("The host has started the quiz!");
              router.push(`/assessment/${payload.quiz_id}?pin=${pin}&nickname=${encodeURIComponent(nickname)}`);
            }
          } else if (data.type === "timer_sync" && payload) {
            if (!isRedirecting.current) {
              isRedirecting.current = true;
              router.push(`/assessment/${session?.quiz_id || payload.quiz_id || ''}?pin=${pin}&nickname=${encodeURIComponent(nickname)}`);
            }
          } else if (data.type === "session_state" && payload) {
            if (payload.status === "active") {
              isRedirecting.current = true;
              router.push(`/assessment/${session?.quiz_id || payload.quiz_id || ''}?pin=${pin}&nickname=${encodeURIComponent(nickname)}`);
            }
          } else if (data.type === "start_countdown" && payload) {
            let count = 3;
            setCountdownVal(3);
            const interval = setInterval(() => {
              count -= 1;
              if (count > 0) {
                setCountdownVal(count);
              } else if (count === 0) {
                setCountdownVal("GO");
              } else {
                clearInterval(interval);
                router.push(`/assessment/${payload.quiz_id}?pin=${pin}&nickname=${encodeURIComponent(nickname)}`);
              }
            }, 1000);
          } else if (data.type === "session_finished") {
            toast.info("The host has ended this live session.");
            router.push("/dashboard");
          } else if (data.type === "player_kicked" && payload?.nickname === nickname) {
            toast.error("You were removed from the session by the host.");
            router.push("/dashboard");
          }
        } catch (err) {
          console.error("[WS] Error parsing message:", err);
        }
      };

      ws.onclose = (event) => {
        if (!isMounted) return;
        console.log("[WS] Connection closed:", event.code, event.reason);
        setWsConnected(false);

        if (event.code === 4005) {
          setErrorMsg("Nickname already taken in this session. Please join with a different name.");
        } else if (event.code === 4007) {
          setErrorMsg("Lobby is full. Cannot join this session.");
        } else if (event.code === 4006) {
          setErrorMsg("The quiz has already started and late joining is disabled.");
        } else if (event.code === 4001 || event.code === 4002) {
          setErrorMsg(event.reason || "Game session not found or has ended.");
        } else if (event.code !== 1000 && event.code !== 1001) {
          // Unexpected disconnect — try to reconnect with exponential backoff
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = Math.min(
              BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts),
              30000
            );
            reconnectAttempts += 1;
            console.log(`[WS] Unexpected disconnect. Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
            toast.info(`Connection lost. Reconnecting... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`, { duration: delay });
            reconnectTimeout = setTimeout(connect, delay);
          } else {
            setErrorMsg("Connection lost and could not be restored. Please rejoin the session.");
          }
        }
      };

      ws.onerror = (error) => {
        console.error("[WS] Socket error:", error);
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounted");
      }
    };
  }, [pin, nickname, loading, errorMsg, token, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#02050c] text-white flex flex-col justify-center items-center gap-4">
        <Loader2 className="h-10 w-10 text-indigo-400 animate-spin" />
        <p className="text-slate-400 text-xs font-semibold">Entering waiting room...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="relative min-h-screen bg-[#02050c] text-slate-100 flex flex-col justify-center items-center px-6 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden="true">
          <div className="absolute top-[30%] left-[20%] h-[400px] w-[400px] rounded-full bg-rose-500/5 blur-[120px]" />
        </div>
        <div className="bg-slate-50/80 dark:bg-[#0c1427]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-xl">
          <div className="h-12 w-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Cannot Join Lobby</h2>
            <p className="text-slate-600 dark:text-slate-400 text-xs font-medium leading-relaxed">{errorMsg}</p>
          </div>
          <Link href="/join" className="block w-full">
            <button className="w-full h-11 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors text-xs">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Join Page</span>
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-[#060b18] text-slate-900 dark:text-slate-100 flex flex-col justify-between items-center px-6 overflow-hidden">
      
      {/* Decorative Blur Background Panels */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden="true">
        <div className="absolute top-[20%] left-[20%] h-[500px] w-[500px] rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-[150px]" />
        <div className="absolute bottom-[20%] right-[20%] h-[500px] w-[500px] rounded-full bg-cyan-500/5 dark:bg-cyan-500/10 blur-[150px]" />
      </div>

      {/* Header */}
      <header className="w-full max-w-6xl py-6 flex items-center justify-between z-10">
        <Link href="/join" className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          <span>Leave Lobby</span>
        </Link>
        <Link href="/" className="flex items-center gap-2 group">
          <BrainCircuit className="h-5 w-5 text-indigo-600 dark:text-indigo-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors" />
          <span className="text-sm font-extrabold font-display text-slate-900 dark:text-white tracking-tight">QuizVerse</span>
        </Link>
      </header>

      {/* Main waiting room display */}
      <main className="flex-1 w-full max-w-md flex flex-col justify-center py-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="bg-slate-50/80 dark:bg-[#0c1427]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-8 space-y-8 shadow-xl text-center"
        >
          <div className="space-y-4">
            <div className="h-16 w-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto shadow-lg shadow-indigo-500/5 relative">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-500 dark:text-cyan-400 absolute" />
              <Sparkles className="h-5 w-5 text-indigo-500 dark:text-indigo-400 animate-pulse" />
            </div>
            
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-[10px] font-bold uppercase tracking-wider select-none">
                Joined Successfully
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Waiting for Host...</h2>
              <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold">The quiz will start as soon as the host begins the session.</p>
            </div>
          </div>

          {/* Student Info and PIN Card */}
          <div className="p-5 bg-slate-100/80 dark:bg-[#121c33]/85 border border-slate-200 dark:border-slate-700/60 rounded-2xl space-y-4 text-left shadow-inner">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Player Name</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[150px]">{nickname}</span>
            </div>
            {session?.host_name && (
              <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Teacher</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[150px]">{session.host_name}</span>
              </div>
            )}
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Game PIN</span>
              <span className="text-sm font-black text-cyan-600 dark:text-cyan-400 font-mono tracking-widest">{pin}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Players In Lobby</span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 font-mono">{participants.length}</span>
            </div>
            <div className="flex justify-between items-center pt-3">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Connection</span>
              {wsConnected ? (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <span>🟢 Connected</span>
                </span>
              ) : (
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 animate-pulse">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span>🟡 Reconnecting...</span>
                </span>
              )}
            </div>
          </div>

          {/* Tips Carousel/Card */}
          <div className="p-4 bg-slate-100/60 dark:bg-[#121c33]/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-slate-600 dark:text-slate-400 text-[10px] font-medium leading-normal flex items-start gap-3">
            <Trophy className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-left space-y-0.5">
              <span className="font-bold text-slate-800 dark:text-slate-300 block">Pro Tip</span>
              <span>Keep this tab active. The game will automatically transition to the first question once launched!</span>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 text-center text-[10px] text-slate-500 dark:text-slate-600 font-semibold z-10">
        QuizVerse AI • Live Student Session Interface
      </footer>

      {/* Synchronized Start Countdown Overlay */}
      {countdownVal !== null && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md">
          <motion.div
            key={countdownVal}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-9xl font-black bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent font-display select-none tracking-tight"
          >
            {countdownVal}
          </motion.div>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-6">Prepare to play!</p>
        </div>
      )}

    </div>
  );
}

// Fallback component for ShieldAlert icon (used in error boundary)
function ShieldAlert(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 9.7a1 1 0 0 1-.68 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 .76-.97l8-2a1 1 0 0 1 .48 0l8 2A1 1 0 0 1 20 6z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}

export default function StudentWaitingRoomPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-[#060b18] text-slate-800 dark:text-white flex flex-col justify-center items-center gap-4">
        <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
        <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">Loading Live Lobby...</p>
      </div>
    }>
      <WaitingRoomContent />
    </Suspense>
  );
}
