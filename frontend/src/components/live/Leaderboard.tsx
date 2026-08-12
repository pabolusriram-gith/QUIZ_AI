import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Award } from "lucide-react";

interface LeaderboardItem {
  id?: string;
  nickname: string;
  score: number;
  rank?: number;
  change?: number; // positive = moved up, negative = moved down, 0 = no change
}

interface LeaderboardProps {
  leaderboard: LeaderboardItem[];
}

export default function Leaderboard({ leaderboard }: LeaderboardProps) {
  const getRankIndicator = (rank: number) => {
    if (rank === 1) return <span className="text-amber-400 font-extrabold flex items-center gap-1 select-none">🥇 1st</span>;
    if (rank === 2) return <span className="text-slate-300 font-extrabold flex items-center gap-1 select-none">🥈 2nd</span>;
    if (rank === 3) return <span className="text-amber-600 font-extrabold flex items-center gap-1 select-none">🥉 3rd</span>;
    return <span className="text-slate-400 font-mono text-xs select-none">#{rank}</span>;
  };

  const getRankDeltaIndicator = (change?: number) => {
    if (!change) return null;
    if (change > 0) {
      return (
        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/5 px-2 py-0.5 rounded-full border border-emerald-500/10 flex items-center gap-0.5">
          ▲ {change}
        </span>
      );
    }
    return (
      <span className="text-[10px] text-rose-400 font-bold bg-rose-500/5 px-2 py-0.5 rounded-full border border-rose-500/10 flex items-center gap-0.5">
        ▼ {Math.abs(change)}
      </span>
    );
  };

  return (
    <div className="glass-panel border-white/5 p-6 rounded-3xl space-y-6 shadow-2xl w-full animate-fade-in">
      <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2.5">
        <Trophy className="h-4.5 w-4.5 text-amber-400" />
        <span>Live Leaderboard</span>
      </h3>

      {leaderboard.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <div className="h-10 w-10 rounded-full bg-white/2 border border-white/5 flex items-center justify-center text-slate-500">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-300">Scoreboard Locked</h4>
            <p className="text-[10px] text-slate-500">Rankings will compile when participants earn points.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {leaderboard.map((player, idx) => {
              const rank = player.rank || (idx + 1);
              const initials = player.nickname.slice(0, 2).toUpperCase();
              
              return (
                <motion.div
                  key={player.nickname}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  className={`p-3.5 rounded-2xl flex items-center justify-between border transition-all ${
                    rank === 1
                      ? "bg-amber-500/5 border-amber-500/15"
                      : rank === 2
                        ? "bg-slate-300/5 border-slate-300/15"
                        : rank === 3
                          ? "bg-amber-600/5 border-amber-600/15"
                          : "bg-white/2 border-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Rank Badge */}
                    <div className="w-12 text-left shrink-0">
                      {getRankIndicator(rank)}
                    </div>
                    {/* Avatar Initials */}
                    <div className={`h-7.5 w-7.5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      rank === 1 ? "bg-amber-500/10 text-amber-300 border border-amber-500/25" :
                      rank === 2 ? "bg-slate-300/10 text-slate-200 border border-slate-300/25" :
                      rank === 3 ? "bg-amber-600/10 text-amber-400 border border-amber-600/25" :
                      "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                    }`}>
                      {initials}
                    </div>
                    {/* Nickname */}
                    <span className="text-xs font-bold text-white truncate block max-w-[120px] md:max-w-none">
                      {player.nickname}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Rank change indicator */}
                    {getRankDeltaIndicator(player.change)}
                    {/* Score */}
                    <span className="text-xs font-bold text-white font-mono bg-white/3 border border-white/5 px-3 py-1 rounded-xl">
                      {player.score} pts
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
