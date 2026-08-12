import React from "react";
import { HelpCircle, Award, Compass, Layers } from "lucide-react";
import Timer from "./Timer";

interface QuestionPanelProps {
  question: any;
  currentIdx: number;
  totalQs: number;
  timeLeft: number | null;
  isPaused: boolean;
  answeredCount: number;
  totalPlayers: number;
}

export default function QuestionPanel({
  question,
  currentIdx,
  totalQs,
  timeLeft,
  isPaused,
  answeredCount,
  totalPlayers
}: QuestionPanelProps) {
  if (!question) return null;

  return (
    <div className="glass-panel border-white/5 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden w-full">
      {/* Question metadata indicators */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-extrabold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
          Question {currentIdx + 1} of {totalQs}
        </span>
        <span className="text-[10px] font-extrabold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
          <Layers className="h-3 w-3" />
          <span>{question.question_type?.replace(/_/g, " ")}</span>
        </span>
        <span className="text-[10px] font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
          <Compass className="h-3 w-3" />
          <span>Bloom: {question.bloom_level || "Understand"}</span>
        </span>
        <span className="text-[10px] font-extrabold text-slate-400 bg-white/3 border border-white/5 px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
          <Award className="h-3 w-3" />
          <span>{question.points || 10} Points</span>
        </span>
      </div>

      {/* Main question context */}
      <div className="space-y-4">
        <h2 className="text-xl md:text-2xl font-extrabold text-white leading-relaxed tracking-tight flex items-start gap-3">
          <HelpCircle className="h-6 w-6 text-indigo-400 mt-1 shrink-0" />
          <span>{question.text}</span>
        </h2>
        {question.explanation && (
          <p className="text-slate-450 text-[11px] leading-relaxed border-l-2 border-indigo-500/30 pl-3">
            {question.explanation}
          </p>
        )}
      </div>

      {/* Synchronized timers or locked states */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/5 mt-6">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Responses submitted:</span>
          <div className="text-xs font-bold text-white bg-white/3 border border-white/5 px-3.5 py-1.5 rounded-2xl">
            {answeredCount} / {totalPlayers} Students
          </div>
        </div>

        {timeLeft !== null && (
          <Timer timeLeft={timeLeft} isPaused={isPaused} />
        )}
      </div>
    </div>
  );
}
export const MemoizedQuestionPanel = React.memo(QuestionPanel);
