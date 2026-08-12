import React from "react";
import { Users, BarChart3, Trophy, PieChart } from "lucide-react";

type EmptyType = "no_students" | "no_responses" | "no_leaderboard" | "no_stats";

interface EmptyStateProps {
  type: EmptyType;
  title?: string;
  description?: string;
}

export default function EmptyState({ type, title, description }: EmptyStateProps) {
  const getDetails = () => {
    switch (type) {
      case "no_students":
        return {
          icon: <Users className="h-8 w-8 text-slate-500" />,
          title: title || "No Students Joined",
          description: description || "Share the PIN or join URL to get players into the lobby."
        };
      case "no_responses":
        return {
          icon: <BarChart3 className="h-8 w-8 text-slate-500" />,
          title: title || "Waiting for Answers",
          description: description || "No responses have been submitted for this question yet."
        };
      case "no_leaderboard":
        return {
          icon: <Trophy className="h-8 w-8 text-slate-500" />,
          title: title || "Leaderboard Unavailable",
          description: description || "Participants must answer questions to generate rankings."
        };
      default:
        return {
          icon: <PieChart className="h-8 w-8 text-slate-500" />,
          title: title || "No Statistics Yet",
          description: description || "Analytics will compile once participants begin submitting options."
        };
    }
  };

  const details = getDetails();

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center min-h-[220px] space-y-4 border border-dashed border-white/10 rounded-2xl bg-white/1">
      <div className="p-3 rounded-full bg-white/3 border border-white/5 flex items-center justify-center">
        {details.icon}
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-white tracking-tight">{details.title}</h3>
        <p className="text-slate-400 text-[11px] font-semibold leading-normal max-w-xs">{details.description}</p>
      </div>
    </div>
  );
}
