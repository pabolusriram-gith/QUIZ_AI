import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { BrainCircuit, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface AILoaderProps {
  steps?: string[]
  className?: string
}

export function AILoader({
  steps = [
    "Initializing QuizVerse AI model...",
    "Scanning content source details...",
    "Synthesizing customized questions...",
    "Structuring options and correct answers...",
    "Injecting educational explanations...",
    "Finalizing assessment draft..."
  ],
  className
}: AILoaderProps) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStepIdx((prev) => (prev < steps.length - 1 ? prev + 1 : prev))
    }, 2800)
    return () => clearInterval(timer)
  }, [steps])

  return (
    <div className={cn("flex flex-col items-center justify-center p-8 space-y-6 text-center", className)}>
      <div className="relative">
        {/* Outer glowing neon circles */}
        <div className="absolute inset-0 rounded-full bg-indigo-500/10 blur-xl scale-125 animate-pulse" />
        <div className="absolute inset-0 rounded-full bg-cyan-500/10 blur-xl scale-150 animate-pulse" />
        
        {/* Pulsing Brain Circuit sphere */}
        <div className="relative h-20 w-20 rounded-2xl bg-[#090f1e] border border-white/10 flex items-center justify-center shadow-2xl">
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="text-cyan-400"
          >
            <BrainCircuit className="h-10 w-10" />
          </motion.div>
          
          <div className="absolute -bottom-1 -right-1 p-1 bg-[#090f1e] border border-white/10 rounded-lg shadow-md">
            <Loader2 className="h-3.5 w-3.5 text-indigo-400 animate-spin" />
          </div>
        </div>
      </div>

      <div className="space-y-2 max-w-sm">
        <h5 className="text-sm font-semibold text-white tracking-tight">AI Engine Processing</h5>
        
        <div className="h-5 flex items-center justify-center overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.p
              key={currentStepIdx}
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -15, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="text-xs text-slate-400 font-semibold"
            >
              {steps[currentStepIdx]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
