import React, { useState } from "react";
import { Award, Trophy, CheckCircle, XCircle, Clock, FileText, Home, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/services/api";
import { toast } from "sonner";

interface StudentResultsProps {
  pin: string;
  nickname: string;
  results: any;
  onGoHome: () => void;
}

export default function StudentResults({ pin, nickname, results, onGoHome }: StudentResultsProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownloadCertificate = async () => {
    if (!results?.certificate_id) {
      toast.error("Certificate not generated for this session.");
      return;
    }
    setDownloading(true);
    try {
      // Trigger download for certificate PDF
      const response = await api.get(`/certificates/${results.certificate_id}/download`, {
        responseType: "blob"
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `QuizVerse_Certificate_${nickname}_${pin}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Certificate downloaded successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to download certificate. Please contact instructor.");
    } finally {
      setDownloading(false);
    }
  };

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return "🏆";
  };

  return (
    <div className="glass-panel border-white/5 rounded-3xl p-6 md:p-8 space-y-8 shadow-2xl text-center w-full max-w-lg mx-auto animate-fade-in">
      <div className="space-y-3">
        <div className="h-16 w-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto animate-pulse">
          <Trophy className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-white tracking-tight">Quiz Completed!</h2>
          <p className="text-slate-400 text-xs font-semibold">Great effort, {nickname}!</p>
        </div>
      </div>

      {/* Main score metrics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/2 border border-white/5 rounded-2xl p-4.5 text-center">
          <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block">Final Rank</span>
          <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-indigo-400 mt-1 block">
            {getRankEmoji(results?.rank || 1)} {results?.rank || "#--"}
          </span>
        </div>
        <div className="bg-white/2 border border-white/5 rounded-2xl p-4.5 text-center">
          <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block">Score Earned</span>
          <span className="text-2xl font-black text-white mt-1 block">
            {results?.score || 0} <span className="text-xs text-slate-450 font-bold">pts</span>
          </span>
        </div>
      </div>

      {/* Accuracy and answer metrics list */}
      <div className="bg-white/2 border border-white/5 rounded-2xl p-5 text-left text-xs font-semibold text-slate-350 space-y-4">
        <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
          <span className="text-slate-500 text-[10px] uppercase tracking-wider">Accuracy</span>
          <span className="text-emerald-400 font-bold">{Math.round(results?.accuracy || 0)}%</span>
        </div>
        <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
          <span className="text-slate-500 text-[10px] uppercase tracking-wider">Correct Options</span>
          <span className="text-white flex items-center gap-1.5 font-bold">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <span>{results?.correct_count || 0} Answers</span>
          </span>
        </div>
        <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
          <span className="text-slate-500 text-[10px] uppercase tracking-wider">Incorrect Options</span>
          <span className="text-white flex items-center gap-1.5 font-bold">
            <XCircle className="h-4 w-4 text-rose-400" />
            <span>{results?.wrong_count || 0} Answers</span>
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-500 text-[10px] uppercase tracking-wider">Total Time Spent</span>
          <span className="text-white flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-cyan-400" />
            <span>{results?.time_taken ? `${Math.round(results.time_taken)} seconds` : "--"}</span>
          </span>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row gap-3.5 pt-2">
        {results?.certificate_id && (
          <Button
            onClick={handleDownloadCertificate}
            disabled={downloading}
            className="flex-1 h-11 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-550 hover:to-cyan-550 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer border-none shadow-lg shadow-indigo-500/10"
          >
            {downloading ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
            ) : (
              <FileText className="h-4.5 w-4.5" />
            )}
            <span>Download Certificate</span>
          </Button>
        )}
        <Button
          onClick={onGoHome}
          className="flex-1 h-11 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
        >
          <Home className="h-4.5 w-4.5" />
          <span>Return Home</span>
        </Button>
      </div>
    </div>
  );
}
export const MemoizedStudentResults = React.memo(StudentResults);
