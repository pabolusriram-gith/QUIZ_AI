import React from "react"
import { motion } from "framer-motion"
import { ArrowUpRight, ArrowDownRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon: React.ReactNode
  trend?: {
    value: number | string
    label: string
    isPositive?: boolean
  }
  sparklineData?: number[]
  glowColor?: "cyan" | "indigo" | "rose" | "emerald"
  className?: string
}

export function StatCard({
  title,
  value,
  description,
  icon,
  trend,
  sparklineData = [10, 20, 15, 25, 22, 30, 45],
  glowColor = "indigo",
  className,
}: StatCardProps) {
  const isPositiveTrend = trend ? trend.isPositive !== false : true
  
  // Calculate SVG sparkline points
  const width = 120
  const height = 40
  const max = Math.max(...sparklineData)
  const min = Math.min(...sparklineData)
  const range = max - min === 0 ? 1 : max - min
  
  const points = sparklineData
    .map((val, idx) => {
      const x = (idx / (sparklineData.length - 1)) * width
      const y = height - ((val - min) / range) * height
      return `${x},${y}`
    })
    .join(" ")

  const glowStyles = {
    indigo: "border-indigo-500/10 hover:border-indigo-500/35 hover:shadow-[0_0_30px_rgba(99,102,241,0.06)]",
    cyan: "border-cyan-500/10 hover:border-cyan-500/35 hover:shadow-[0_0_30px_rgba(6,182,212,0.06)]",
    emerald: "border-emerald-500/10 hover:border-emerald-500/35 hover:shadow-[0_0_30px_rgba(16,185,129,0.06)]",
    rose: "border-rose-500/10 hover:border-rose-500/35 hover:shadow-[0_0_30px_rgba(244,63,94,0.06)]",
  }

  const strokeColor = {
    indigo: "#6366f1",
    cyan: "#06b6d4",
    emerald: "#10b981",
    rose: "#f43f5e",
  }[glowColor]

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "glass-panel rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between transition-all duration-300",
        glowStyles[glowColor],
        className
      )}
    >
      {/* Background radial glow */}
      <div 
        className={cn(
          "absolute -right-16 -top-16 h-36 w-36 rounded-full blur-[80px] pointer-events-none opacity-20",
          glowColor === "indigo" && "bg-indigo-500",
          glowColor === "cyan" && "bg-cyan-500",
          glowColor === "emerald" && "bg-emerald-500",
          glowColor === "rose" && "bg-rose-500"
        )}
      />

      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{title}</span>
          <h4 className="text-3xl font-extrabold font-display text-white tracking-tight">{value}</h4>
        </div>
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-slate-300 shrink-0 shadow-inner">
          {icon}
        </div>
      </div>

      <div className="flex items-end justify-between mt-6">
        <div className="space-y-1">
          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-xs font-bold",
              isPositiveTrend ? "text-emerald-400" : "text-rose-400"
            )}>
              {isPositiveTrend ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              <span>{trend.value}%</span>
              <span className="text-slate-500 font-medium">{trend.label}</span>
            </div>
          )}
          {description && (
            <p className="text-xs text-slate-400 font-medium">{description}</p>
          )}
        </div>

        {/* Sparkline chart */}
        <div className="h-10 w-28 opacity-80 hover:opacity-100 transition-opacity">
          <svg className="overflow-visible" width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke={strokeColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
            {/* Area fill */}
            <path
              d={`M0,${height} L${points} L${width},${height} Z`}
              fill={`url(#gradient-${glowColor})`}
              className="opacity-15"
            />
            <defs>
              <linearGradient id={`gradient-${glowColor}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </motion.div>
  )
}
