import React from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-5 border-b border-border mb-6">
      <div className="flex items-start gap-3.5 min-w-0">
        {/* Left accent bar */}
        <div className="hidden sm:block h-9 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-cyan-500 mt-1 shrink-0" />
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl md:text-[1.65rem] font-extrabold text-foreground tracking-tight font-display leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground font-normal leading-relaxed max-w-2xl">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2.5 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
