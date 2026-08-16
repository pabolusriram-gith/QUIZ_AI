"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, CheckCircle2, Loader2, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

interface AILoaderProps {
  steps?: string[];
  className?: string;
}

export function AILoader({
  steps = [
    "Synthesizing questions from your prompt...",
    "Structuring options and correct answers...",
    "Injecting educational feedback and hints...",
    "Finalizing quiz draft..."
  ],
  className
}: AILoaderProps) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStepIdx((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 2200);
    return () => clearInterval(timer);
  }, [steps]);

  // Derive 3 high-level stages: 1. Generating, 2. Processing, 3. Ready
  const progressPercent = Math.min(100, Math.round(((currentStepIdx + 1) / steps.length) * 100));
  const activeStage = currentStepIdx === 0 ? "generating" : currentStepIdx < steps.length - 1 ? "processing" : "ready";

  return (
    <div className={cn("flex flex-col items-center justify-center p-8 space-y-7 text-center max-w-md mx-auto", className)}>
      {/* Central Clean AI Node */}
      <div className="relative">
        <div className="relative h-18 w-18 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center shadow-lg shadow-indigo-500/10">
          <motion.div
            animate={{
              scale: [1, 1.06, 1],
            }}
            transition={{
              duration: 2.4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="text-indigo-400"
          >
            <Cpu className="h-8 w-8" />
          </motion.div>
          
          <div className="absolute -bottom-1 -right-1 p-1 bg-slate-900 border border-slate-700 rounded-lg shadow-md">
            <Loader2 className="h-3 w-3 text-cyan-400 animate-spin" />
          </div>
        </div>
      </div>

      {/* 3-Step Flow: Generating → Processing → Ready */}
      <div className="w-full space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold px-2">
          <div className={`flex items-center gap-1.5 transition-colors ${
            activeStage === "generating" ? "text-cyan-400 font-bold" : "text-slate-400"
          }`}>
            {activeStage === "generating" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            )}
            <span>Generating</span>
          </div>

          <span className="text-slate-600 text-[10px]">→</span>

          <div className={`flex items-center gap-1.5 transition-colors ${
            activeStage === "processing" ? "text-indigo-400 font-bold" : activeStage === "ready" ? "text-slate-400" : "text-slate-500"
          }`}>
            {activeStage === "processing" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
            ) : activeStage === "ready" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <div className="h-2 w-2 rounded-full bg-slate-600" />
            )}
            <span>Processing</span>
          </div>

          <span className="text-slate-600 text-[10px]">→</span>

          <div className={`flex items-center gap-1.5 transition-colors ${
            activeStage === "ready" ? "text-emerald-400 font-bold" : "text-slate-500"
          }`}>
            {activeStage === "ready" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <div className="h-2 w-2 rounded-full bg-slate-600" />
            )}
            <span>Ready</span>
          </div>
        </div>

        {/* Progress bar line */}
        <div className="h-1.5 w-full bg-slate-800 dark:bg-slate-800 light:bg-slate-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-400 rounded-full"
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Dynamic Subtext Step Description */}
      <div className="h-6 flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={currentStepIdx}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="text-xs text-slate-300 dark:text-slate-300 light:text-slate-700 font-medium"
          >
            {steps[currentStepIdx]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
