import React from "react";
import { Loader2, WifiOff } from "lucide-react";

interface ReconnectOverlayProps {
  attempts: number;
  maxAttempts: number;
  secondsLeft?: number;
}

export default function ReconnectOverlay({ attempts, maxAttempts, secondsLeft }: ReconnectOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
      <div className="bg-slate-50 dark:bg-[#0a1124] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-sm w-full text-center space-y-6 shadow-2xl">
        <div className="relative h-16 w-16 mx-auto flex items-center justify-center">
          <Loader2 className="h-16 w-16 text-cyan-500 dark:text-cyan-400 animate-spin absolute" />
          <WifiOff className="h-6 w-6 text-indigo-500 dark:text-indigo-400 animate-pulse" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Connection Interrupted</h2>
          <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold leading-relaxed">
            Reconnecting to the quiz session...
          </p>
          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full inline-block mt-2">
            Attempt {attempts} of {maxAttempts}
          </div>
          {secondsLeft !== undefined && secondsLeft > 0 && (
            <p className="text-slate-500 dark:text-slate-400 text-[10px] pt-1">
              Saving progress locally. Auto-sync timeout in {secondsLeft}s.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
