import React from "react";
import { Award, Trophy } from "lucide-react";

interface ScoreCardProps {
  score: number;
  rank: number | null;
}

export default function ScoreCard({ score, rank }: ScoreCardProps) {
  return (
    <div className="flex items-center gap-4 bg-slate-900/60 border border-white/5 rounded-2xl p-3 px-4 shadow-md text-xs font-semibold select-none">
      <div className="flex items-center gap-1.5 text-amber-400">
        <Trophy className="h-4 w-4" />
        <span>Rank: <span className="font-bold font-mono text-white">{rank !== null ? `#${rank}` : "--"}</span></span>
      </div>
      <div className="h-4.5 w-[1px] bg-white/10" />
      <div className="flex items-center gap-1.5 text-indigo-400">
        <Award className="h-4 w-4" />
        <span>Score: <span className="font-bold font-mono text-white">{score} pts</span></span>
      </div>
    </div>
  );
}
export const MemoizedScoreCard = React.memo(ScoreCard);
