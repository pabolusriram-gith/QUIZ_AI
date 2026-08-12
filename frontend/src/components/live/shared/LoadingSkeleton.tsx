import React from "react";

export function SkeletonCircle({ className = "h-12 w-12" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-white/5 ${className}`} />;
}

export function SkeletonText({ className = "h-4 w-32" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/5 ${className}`} />;
}

export function SkeletonCard({ className = "h-40 w-full" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/5 border border-white/5 ${className}`} />;
}

export default function LoadingSkeleton() {
  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <SkeletonText className="h-6 w-48" />
        <SkeletonText className="h-6 w-24" />
      </div>
      <SkeletonCard className="h-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkeletonCard className="h-20" />
        <SkeletonCard className="h-20" />
        <SkeletonCard className="h-20" />
        <SkeletonCard className="h-20" />
      </div>
    </div>
  );
}
