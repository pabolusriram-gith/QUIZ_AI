import React from "react";
import { AlertCircle, WifiOff, RefreshCw, XCircle, Clock, ShieldAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ErrorType =
  | "network_lost"
  | "server_restarted"
  | "host_ended"
  | "expired"
  | "unauthorized"
  | "cancelled"
  | "timeout"
  | "max_capacity"
  | "generic";

interface ErrorStateProps {
  type: ErrorType;
  message?: string;
  onAction?: () => void;
  actionText?: string;
}

export default function ErrorState({ type, message, onAction, actionText }: ErrorStateProps) {
  const getErrorDetails = () => {
    switch (type) {
      case "network_lost":
        return {
          icon: <WifiOff className="h-10 w-10 text-rose-400" />,
          title: "Connection Lost",
          description: message || "We've lost connection to the server. Please check your internet connection.",
          actionLabel: actionText || "Retry Connection"
        };
      case "server_restarted":
        return {
          icon: <RefreshCw className="h-10 w-10 text-amber-400 animate-spin" />,
          title: "Server Reconnecting",
          description: message || "The server is restarting or undergoing maintenance. Attempting to restore connection...",
          actionLabel: actionText || "Reconnect Now"
        };
      case "host_ended":
        return {
          icon: <XCircle className="h-10 w-10 text-cyan-400" />,
          title: "Session Finished",
          description: message || "The host has concluded this live quiz session.",
          actionLabel: actionText || "Go to Dashboard"
        };
      case "expired":
        return {
          icon: <Clock className="h-10 w-10 text-slate-400" />,
          title: "Session Expired",
          description: message || "This session is no longer active or your access has expired.",
          actionLabel: actionText || "Return Home"
        };
      case "unauthorized":
        return {
          icon: <ShieldAlert className="h-10 w-10 text-rose-500" />,
          title: "Access Denied",
          description: message || "You do not have permission to join or view this session.",
          actionLabel: actionText || "Login"
        };
      case "cancelled":
        return {
          icon: <XCircle className="h-10 w-10 text-rose-400" />,
          title: "Quiz Cancelled",
          description: message || "The host has aborted this quiz session.",
          actionLabel: actionText || "Return Home"
        };
      case "timeout":
        return {
          icon: <Clock className="h-10 w-10 text-amber-500" />,
          title: "Question Timeout",
          description: message || "Time is up! You didn't submit an answer in time.",
          actionLabel: actionText || "Continue"
        };
      case "max_capacity":
        return {
          icon: <Users className="h-10 w-10 text-rose-400" />,
          title: "Lobby Full",
          description: message || "This session has reached its maximum participant limit.",
          actionLabel: actionText || "Return Home"
        };
      default:
        return {
          icon: <AlertCircle className="h-10 w-10 text-amber-400" />,
          title: "Something Went Wrong",
          description: message || "An unexpected error occurred. Please try again.",
          actionLabel: actionText || "Go Back"
        };
    }
  };

  const details = getErrorDetails();

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto min-h-[300px] space-y-6 bg-slate-950/40 border border-white/5 rounded-3xl backdrop-blur-md">
      <div className="p-4 rounded-full bg-white/3 border border-white/5 flex items-center justify-center">
        {details.icon}
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-white tracking-tight">{details.title}</h2>
        <p className="text-slate-400 text-xs font-semibold leading-relaxed px-4">{details.description}</p>
      </div>
      {onAction && (
        <Button
          onClick={onAction}
          className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 h-10 border-none cursor-pointer brand-button-glow transition-all"
        >
          {details.actionLabel}
        </Button>
      )}
    </div>
  );
}
