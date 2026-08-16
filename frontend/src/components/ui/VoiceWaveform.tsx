"use client";

import React, { useEffect, useState } from "react";
import { Mic, Activity, AlertCircle, Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

export type VoiceState = "ready" | "listening" | "processing" | "error";

interface VoiceWaveformProps {
  state: VoiceState;
  durationSeconds?: number;
  errorMessage?: string;
  onStop: () => void;
  onRetry?: () => void;
  className?: string;
}

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  state,
  durationSeconds = 0,
  errorMessage,
  onStop,
  onRetry,
  className = "",
}) => {
  // Generate pseudo-random bar heights for smooth continuous horizontal wave
  const [waveSeed, setWaveSeed] = useState(0);

  useEffect(() => {
    if (state !== "listening") return;
    const interval = setInterval(() => {
      setWaveSeed((prev) => (prev + 1) % 100);
    }, 120);
    return () => clearInterval(interval);
  }, [state]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}:${remainder < 10 ? "0" : ""}${remainder}`;
  };

  if (state === "ready") {
    return null;
  }

  // 16 horizontal waveform bars simulating ChatGPT horizontal voice flow
  const barCount = 18;
  const getBarHeight = (index: number) => {
    if (state !== "listening") return 4;
    // Harmonious sine-wave oscillation with index offset
    const val = Math.sin((index * 0.5) + (waveSeed * 0.4)) * 0.5 + 0.5;
    return Math.max(4, Math.round(val * 24 + 4));
  };

  return (
    <div
      className={`relative w-full rounded-2xl border transition-all duration-300 p-4 shadow-sm backdrop-blur-md ${
        state === "error"
          ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
          : "bg-slate-900/90 dark:bg-slate-900/95 light:bg-slate-100 border-slate-700/60 dark:border-slate-800 light:border-slate-300 text-slate-200 light:text-slate-800"
      } ${className}`}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Status indicator badge */}
        <div className="flex items-center gap-2.5">
          {state === "listening" && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-semibold animate-pulse">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
              <span>Listening</span>
              <span className="font-mono text-[11px] text-rose-300 ml-1">
                {formatTime(durationSeconds)}
              </span>
            </div>
          )}

          {state === "processing" && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
              <span>Transcribing Speech...</span>
            </div>
          )}

          {state === "error" && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-semibold">
              <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
              <span>{errorMessage || "Speech recognition error"}</span>
            </div>
          )}
        </div>

        {/* Horizontal Waveform (ChatGPT Style) */}
        {state === "listening" && (
          <div className="flex items-center justify-center gap-1 h-8 px-4 flex-1 max-w-xs">
            {Array.from({ length: barCount }).map((_, i) => {
              const height = getBarHeight(i);
              return (
                <div
                  key={i}
                  style={{
                    height: `${height}px`,
                    transition: "height 0.12s ease-in-out",
                  }}
                  className="w-1 rounded-full bg-gradient-to-t from-indigo-500 via-cyan-400 to-indigo-300 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                />
              );
            })}
          </div>
        )}

        {state === "processing" && (
          <div className="flex items-center justify-center gap-1.5 h-8 px-4 flex-1 max-w-xs">
            <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full w-1/3 bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full animate-[shimmer_1.5s_infinite_linear]" />
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {state === "listening" && (
            <Button
              type="button"
              size="sm"
              onClick={onStop}
              className="h-8 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Square className="h-3 w-3 fill-current" />
              <span>Done</span>
            </Button>
          )}

          {state === "error" && onRetry && (
            <Button
              type="button"
              size="sm"
              onClick={onRetry}
              className="h-8 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-all"
            >
              <Mic className="h-3 w-3" />
              <span>Try Again</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
