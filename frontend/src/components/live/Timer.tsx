import React from "react";
import { Clock } from "lucide-react";

interface TimerProps {
  timeLeft: number;
  isPaused: boolean;
}

export default function Timer({ timeLeft, isPaused }: TimerProps) {
  const isUrgent = timeLeft <= 10 && timeLeft > 0;

  return (
    <div className={`flex items-center gap-2 font-mono font-bold text-sm px-4 py-2 rounded-2xl border transition-all duration-350 select-none ${
      isUrgent
        ? "text-rose-400 bg-rose-500/10 border-rose-500/30 animate-pulse scale-105"
        : isPaused
          ? "text-slate-450 bg-white/3 border-white/5"
          : "text-cyan-400 bg-cyan-500/10 border-cyan-500/20"
    }`}>
      <Clock className={`h-4.5 w-4.5 ${isUrgent ? "animate-bounce" : isPaused ? "" : "animate-spin"}`} />
      <span>
        {isPaused ? "PAUSED" : `${timeLeft}s`}
      </span>
    </div>
  );
}
export const MemoizedTimer = React.memo(Timer);
