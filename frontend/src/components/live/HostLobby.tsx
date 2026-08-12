import React, { useState } from "react";
import { Copy, Link as LinkIcon, Users, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

interface Participant {
  id: string;
  nickname: string;
  connected: boolean;
  score: number;
}

interface HostLobbyProps {
  pin: string;
  session: any;
  participants: Participant[];
  starting: boolean;
  onStartQuiz: () => void;
  onToggleLateJoin: () => void;
  lateJoinPending: boolean;
}

export default function HostLobby({
  pin,
  session,
  participants,
  starting,
  onStartQuiz,
  onToggleLateJoin,
  lateJoinPending
}: HostLobbyProps) {
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const joinUrl = typeof window !== "undefined"
    ? `${window.location.origin}/join?pin=${pin}`
    : `https://quizverse.ai/join?pin=${pin}`;

  const handleCopyPin = () => {
    navigator.clipboard.writeText(pin);
    setCopiedPin(true);
    toast.success("Game PIN copied to clipboard!");
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopiedLink(true);
    toast.success("Join Link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full animate-fade-in">
      {/* Left panel: PIN, settings, QR code */}
      <div className="lg:col-span-5 space-y-6">
        <div className="glass-panel border-white/5 p-6 rounded-3xl space-y-6 text-center shadow-2xl">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">Join at {typeof window !== "undefined" ? window.location.host + "/join" : "quizverse.ai/join"}</span>
            <div className="flex items-center justify-center gap-3">
              <h1 className="text-4xl md:text-5xl font-black tracking-wider text-white">
                {pin}
              </h1>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopyPin}
                  className="p-2 rounded-xl bg-white/3 border border-white/5 text-slate-400 hover:text-white hover:bg-white/6 cursor-pointer transition-all flex items-center justify-center"
                  title="Copy Game PIN"
                  aria-label="Copy Game PIN"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  onClick={handleCopyLink}
                  className="p-2 rounded-xl bg-white/3 border border-white/5 text-slate-400 hover:text-white hover:bg-white/6 cursor-pointer transition-all flex items-center justify-center"
                  title="Copy Direct Join Link"
                  aria-label="Copy Direct Join Link"
                >
                  <LinkIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* QR Code Presentation */}
          <div className="bg-white/2 border border-white/5 rounded-2xl p-4 inline-block shadow-inner mx-auto">
            <QRCodeSVG value={joinUrl} size={150} level="H" className="mx-auto rounded-lg p-2 bg-white" />
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mt-2.5">Scan to Join Immediately</span>
          </div>

          <div className="bg-white/2 border border-white/5 rounded-2xl p-4.5 text-left space-y-3">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block border-b border-white/5 pb-1.5">Session Settings</span>
            <div className="grid grid-cols-2 gap-4 text-[10px] font-bold text-slate-400">
              <div>
                <span className="text-slate-500 block text-[9px] uppercase tracking-wider">Late Joining</span>
                <button
                  onClick={onToggleLateJoin}
                  disabled={lateJoinPending}
                  className="text-white hover:text-cyan-400 underline decoration-dotted capitalize bg-transparent border-none p-0 cursor-pointer text-left font-bold"
                >
                  {lateJoinPending ? "Updating..." : session.late_join_policy?.replace(/_/g, " ")}
                </button>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase tracking-wider">Leaderboard Mode</span>
                <span className="text-white capitalize">{session.leaderboard_mode?.replace(/_/g, " ")}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase tracking-wider">Questions</span>
                <span className="text-white">Order: {session.question_order || "original"}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase tracking-wider">Question Clocks</span>
                <span className="text-white">{session.question_timer_override ? `${session.question_timer_override}s` : "Default limits"}</span>
              </div>
            </div>
          </div>

          <Button
            onClick={onStartQuiz}
            disabled={starting || participants.length === 0}
            className="w-full h-12 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-550 hover:to-cyan-550 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg border-none shadow-indigo-500/10 active:scale-98 transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            {starting ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Play className="h-4.5 w-4.5 fill-current" />}
            <span>Start Quiz ({participants.length} Joined)</span>
          </Button>
        </div>
      </div>

      {/* Right panel: connected participants grid */}
      <div className="lg:col-span-7 glass-panel border-white/5 p-6 rounded-3xl space-y-4 shadow-2xl flex flex-col justify-between min-h-[300px]">
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2.5">
            <Users className="h-4.5 w-4.5 text-indigo-400" />
            <span>Waiting Lobby Participants ({participants.length})</span>
          </h3>

          {participants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-white/2 border border-white/5 flex items-center justify-center text-slate-500 animate-pulse">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-300">Waiting for Students</h4>
                <p className="text-[10px] text-slate-500">Provide the Game PIN or QR code to allow students to join.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[340px] overflow-y-auto pr-1">
              {participants.map(p => {
                const initials = p.nickname.slice(0, 2).toUpperCase();
                return (
                  <div key={p.id} className="p-3 bg-white/2 border border-white/5 rounded-xl flex items-center gap-2.5 hover:bg-white/4 transition-colors">
                    <div className="h-8 w-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-300">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-white truncate block">{p.nickname}</span>
                      <span className={`text-[8px] font-bold uppercase tracking-wider block ${p.connected ? "text-emerald-400 animate-pulse" : "text-rose-400"}`}>
                        {p.connected ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export const MemoizedHostLobby = React.memo(HostLobby);
