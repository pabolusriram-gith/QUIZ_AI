import React from "react"
import { cn } from "@/lib/utils"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass"
}

export function Skeleton({
  className,
  variant = "default",
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg",
        variant === "glass" ? "bg-white/5 border border-white/5" : "bg-white/8",
        className
      )}
      {...props}
    />
  )
}
