import React from "react";
import { Play, Pause, RotateCw, SkipForward, Power, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HostControlsProps {
  pin: string;
  isStarted: boolean; // whether question timer has started
  isPaused: boolean;
  isLocked: boolean; // whether answers are locked
  isLastQuestion: boolean;
  actionPending: Record<string, boolean>;
  autoAdvance: boolean;
  onToggleAutoAdvance: () => void;
  onRelease: () => void;
  onPause: () => void;
  onResume: () => void;
  onExtend: () => void;
  onNext: () => void;
  onEnd: () => void;
}

export default function HostControls({
  pin,
  isStarted,
  isPaused,
  isLocked,
  isLastQuestion,
  actionPending,
  autoAdvance,
  onToggleAutoAdvance,
  onRelease,
  onPause,
  onResume,
  onExtend,
  onNext,
  onEnd
}: HostControlsProps) {
  const isAnyPending = Object.values(actionPending).some(Boolean);

  return (
    <div className="glass-panel border-white/5 p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl w-full">
      <div className="flex items-center gap-3">
        {/* Release Question / Start Timer */}
        {!isStarted ? (
          <Button
            onClick={onRelease}
            disabled={isAnyPending}
            className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold h-10 px-5 flex items-center gap-2 border-none cursor-pointer brand-button-glow"
          >
            {actionPending.release ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 fill-current" />
            )}
            <span>Release Question</span>
          </Button>
        ) : (
          <>
            {/* Pause / Resume */}
            {isPaused ? (
              <Button
                onClick={onResume}
                disabled={isAnyPending}
                className="rounded-xl bg-cyan-600 hover:bg-cyan-550 text-white font-bold h-10 px-4.5 flex items-center gap-2 border-none cursor-pointer"
              >
                {actionPending.resume ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 fill-current" />
                )}
                <span>Resume Clocks</span>
              </Button>
            ) : (
              <Button
                onClick={onPause}
                disabled={isAnyPending}
                className="rounded-xl bg-amber-600 hover:bg-amber-550 text-white font-bold h-10 px-4.5 flex items-center gap-2 border-none cursor-pointer"
              >
                {actionPending.pause ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
                <span>Pause Clocks</span>
              </Button>
            )}

            {/* Extend Timer (+15s) */}
            <Button
              onClick={onExtend}
              disabled={isAnyPending || isLocked}
              className="rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white font-bold h-10 px-4.5 flex items-center gap-2 cursor-pointer"
            >
              {actionPending.extend ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span>Extend +15s</span>
            </Button>
          </>
        )}
      </div>

      {/* Auto Advance Toggle */}
      <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
        <label className="relative inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoAdvance}
            onChange={onToggleAutoAdvance}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
          <span className="ml-2.5 text-xs font-bold text-slate-300 peer-checked:text-white">Auto Advance</span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        {/* Next Question / Skip */}
        {isStarted && (
          <Button
            onClick={onNext}
            disabled={isAnyPending}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 px-5 flex items-center gap-2 border-none cursor-pointer shadow-lg shadow-indigo-500/10"
          >
            {actionPending.next ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SkipForward className="h-4 w-4" />
            )}
            <span>{isLastQuestion ? "Show Final Podium" : "Next Question"}</span>
          </Button>
        )}

        {/* End Session early */}
        <Button
          onClick={onEnd}
          disabled={isAnyPending}
          className="rounded-xl bg-rose-600/10 border border-rose-500/20 hover:bg-rose-600 hover:text-white text-rose-400 font-bold h-10 px-4 flex items-center gap-1.5 cursor-pointer transition-all"
        >
          {actionPending.end ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Power className="h-4 w-4" />
          )}
          <span>End Quiz</span>
        </Button>
      </div>
    </div>
  );
}
export const MemoizedHostControls = React.memo(HostControls);
