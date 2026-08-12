import React from "react";
import { Loader2, Sparkles, User, BrainCircuit } from "lucide-react";
import ConnectionStatus from "./ConnectionStatus";

interface StudentLobbyProps {
  pin: string;
  nickname: string;
  session: any;
  wsConnected: boolean;
  wsQuality: "connected" | "reconnecting" | "offline";
  latency: number | null;
  participants: any[];
}

export default function StudentLobby({
  pin,
  nickname,
  session,
  wsConnected,
  wsQuality,
  latency,
  participants
}: StudentLobbyProps) {
  const hostName = session?.host_name || "Instructor";

  return (
    <div className="glass-panel border-white/5 rounded-3xl p-8 space-y-8 shadow-2xl text-center w-full max-w-md mx-auto animate-fade-in">
      <div className="space-y-4">
        {/* Floating pulse loader */}
        <div className="h-16 w-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto shadow-lg relative">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400 absolute" />
          <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-wider select-none">
            Joined Successfully
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Waiting for Host...</h2>
          <p className="text-slate-400 text-xs font-semibold leading-relaxed">
            The quiz will start as soon as the host begins the session.
          </p>
        </div>
      </div>

      {/* Lobby stats */}
      <div className="bg-white/2 border border-white/5 rounded-2xl p-4.5 space-y-3.5 text-left text-xs font-semibold text-slate-300">
        <div className="flex justify-between items-center border-b border-white/5 pb-2">
          <span className="text-slate-500 text-[10px] uppercase tracking-wider">Quiz Title</span>
          <span className="text-white text-right max-w-[180px] truncate">{session?.quiz_title || "Interactive Live Assessment"}</span>
        </div>
        <div className="flex justify-between items-center border-b border-white/5 pb-2">
          <span className="text-slate-500 text-[10px] uppercase tracking-wider">Teacher</span>
          <span className="text-white flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-indigo-400" />
            <span>{hostName}</span>
          </span>
        </div>
        <div className="flex justify-between items-center border-b border-white/5 pb-2">
          <span className="text-slate-500 text-[10px] uppercase tracking-wider">Your Nickname</span>
          <span className="text-white font-bold">{nickname}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-500 text-[10px] uppercase tracking-wider">Connection Status</span>
          <ConnectionStatus status={wsQuality} latency={latency} />
        </div>
      </div>

      {/* Other players count */}
      {participants.length > 0 && (
        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
          {participants.length} Players connected in lobby
        </div>
      )}
    </div>
  );
}
export const MemoizedStudentLobby = React.memo(StudentLobby);
