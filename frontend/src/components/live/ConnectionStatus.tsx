import React from "react";
import { Wifi, WifiOff } from "lucide-react";

interface ConnectionStatusProps {
  status: "connected" | "reconnecting" | "offline";
  latency: number | null;
}

export default function ConnectionStatus({ status, latency }: ConnectionStatusProps) {
  const getQualityColor = () => {
    if (status === "connected") {
      if (latency !== null && latency > 250) return "text-amber-400 border-amber-500/15 bg-amber-500/5";
      return "text-emerald-400 border-emerald-500/15 bg-emerald-500/5";
    }
    if (status === "reconnecting") return "text-amber-400 border-amber-500/15 bg-amber-500/5 animate-pulse";
    return "text-rose-400 border-rose-500/15 bg-rose-500/5 animate-pulse";
  };

  const getDotColor = () => {
    if (status === "connected") {
      if (latency !== null && latency > 250) return "bg-amber-400";
      return "bg-emerald-400";
    }
    if (status === "reconnecting") return "bg-amber-400";
    return "bg-rose-400";
  };

  return (
    <span className={`text-[10px] font-bold inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${getQualityColor()}`}>
      <div className={`h-1.5 w-1.5 rounded-full ${getDotColor()}`} />
      <span>
        {status === "connected"
          ? `🟢 Live${latency !== null ? ` (${latency}ms)` : ""}`
          : status === "reconnecting"
            ? "🟡 Reconnecting"
            : "🔴 Offline"}
      </span>
    </span>
  );
}
export const MemoizedConnectionStatus = React.memo(ConnectionStatus);
