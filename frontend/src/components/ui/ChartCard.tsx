import React from "react"
import { motion } from "framer-motion"
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { cn } from "@/lib/utils"

interface ChartCardProps {
  title: string
  description?: string
  data: Record<string, string | number>[]
  xDataKey: string
  yDataKey: string
  yDataKey2?: string
  glowColor?: "indigo" | "cyan"
  className?: string
}

export function ChartCard({
  title,
  description,
  data,
  xDataKey,
  yDataKey,
  yDataKey2,
  glowColor = "indigo",
  className,
}: ChartCardProps) {
  const strokeColor1 = glowColor === "indigo" ? "#6366f1" : "#06b6d4"
  const strokeColor2 = glowColor === "indigo" ? "#06b6d4" : "#6366f1"
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={cn(
        "glass-panel rounded-2xl p-6 border-white/5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)] flex flex-col justify-between",
        className
      )}
    >
      <div className="mb-6">
        <h3 className="text-lg font-bold text-white font-display tracking-tight">{title}</h3>
        {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
      </div>

      <div className="h-72 w-full text-xs font-semibold text-slate-400">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id={`colorUv-${glowColor}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor1} stopOpacity={0.25}/>
                <stop offset="95%" stopColor={strokeColor1} stopOpacity={0}/>
              </linearGradient>
              {yDataKey2 && (
                <linearGradient id={`colorPv-${glowColor}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={strokeColor2} stopOpacity={0.2}/>
                  <stop offset="95%" stopColor={strokeColor2} stopOpacity={0}/>
                </linearGradient>
              )}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.04)" />
            <XAxis
              dataKey={xDataKey}
              stroke="rgba(255, 255, 255, 0.2)"
              tickLine={false}
              axisLine={false}
              dy={10}
              style={{ fontSize: 10 }}
            />
            <YAxis
              stroke="rgba(255, 255, 255, 0.2)"
              tickLine={false}
              axisLine={false}
              dx={-10}
              style={{ fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(9, 15, 30, 0.9)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "12px",
                color: "#f8fafc",
                fontSize: "11px",
              }}
              cursor={{ stroke: "rgba(255, 255, 255, 0.06)", strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey={yDataKey}
              stroke={strokeColor1}
              strokeWidth={2.5}
              fillOpacity={1}
              fill={`url(#colorUv-${glowColor})`}
            />
            {yDataKey2 && (
              <Area
                type="monotone"
                dataKey={yDataKey2}
                stroke={strokeColor2}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#colorPv-${glowColor})`}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
