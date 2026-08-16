"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { sidebarConfig, SidebarItem } from "./sidebar.config";
import {
  LayoutDashboard,
  BookOpen,
  FileSpreadsheet,
  PlayCircle,
  Users,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  BrainCircuit,
  X,
  FileDown,
} from "lucide-react";

// Safe, type-safe icon mapper
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  BookOpen,
  FileSpreadsheet,
  PlayCircle,
  Users,
  BarChart3,
  Settings,
  FileDown,
  BrainCircuit,
};

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

export default function Sidebar({
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen,
}: SidebarProps) {
  const pathname = usePathname();
  const { currentUser } = useAuth();

  // Paths where we want EXACT match only (no startsWith for children)
  const exactMatchPaths = ["/dashboard/analytics"];

  const renderNavItems = () => {
    const filteredConfig = sidebarConfig.filter((item: SidebarItem) => {
      if (currentUser?.role?.toLowerCase() === "student") {
        return item.name === "Dashboard" || item.name === "Settings";
      }
      return true;
    });

    return filteredConfig.map((item: SidebarItem) => {
      const Icon = iconMap[item.iconName] || Settings;

      const isActive =
        pathname === item.path ||
        (!exactMatchPaths.includes(item.path) &&
          item.path !== "/" &&
          pathname?.startsWith(item.path));

      if (item.isComingSoon) {
        return (
          <div
            key={item.name}
            className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 dark:text-slate-500 cursor-not-allowed select-none"
            title={`${item.name} — Coming Soon`}
          >
            <Icon className="h-[18px] w-[18px] shrink-0 opacity-50" />
            {!isCollapsed && (
              <div className="flex items-center justify-between w-full min-w-0">
                <span className="text-sm font-medium truncate opacity-60">{item.name}</span>
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200/70 dark:bg-white/5 text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0 border border-slate-200 dark:border-white/5 ml-1">
                  Soon
                </span>
              </div>
            )}
            {isCollapsed && (
              <div className="absolute left-[4.5rem] hidden group-hover:block bg-popover border border-border text-foreground text-[10px] font-semibold px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap z-50">
                {item.name} <span className="text-muted-foreground">(Soon)</span>
              </div>
            )}
          </div>
        );
      }

      return (
        <Link
          key={item.name}
          href={item.path}
          onClick={() => setIsMobileOpen(false)}
          className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
            isActive
              ? "bg-indigo-500/10 dark:bg-indigo-500/12 text-indigo-600 dark:text-indigo-300 font-semibold border border-indigo-500/15 dark:border-indigo-500/20 shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-black/5 dark:hover:bg-white/5 border border-transparent"
          }`}
        >
          {/* Active indicator bar */}
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-indigo-500 dark:bg-indigo-400" />
          )}
          <Icon
            className={`h-[18px] w-[18px] shrink-0 transition-colors ${
              isActive
                ? "text-indigo-500 dark:text-indigo-400"
                : "text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 dark:group-hover:text-cyan-400"
            }`}
          />
          {!isCollapsed && <span className="truncate">{item.name}</span>}
          {isCollapsed && (
            <div className="absolute left-[4.5rem] scale-95 opacity-0 pointer-events-none group-hover:scale-100 group-hover:opacity-100 transition-all duration-150 bg-popover border border-border text-foreground text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap z-50">
              {item.name}
            </div>
          )}
        </Link>
      );
    });
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 bg-sidebar/60 backdrop-blur-xl border-r border-sidebar-border flex flex-col z-40 transition-all duration-300 ease-in-out ${
          isMobileOpen
            ? "translate-x-0 w-64"
            : "-translate-x-full lg:translate-x-0"
        } ${isCollapsed ? "lg:w-[4.5rem]" : "lg:w-64"}`}
      >
        {/* Header / Branding */}
        <div
          className={`flex h-16 items-center justify-between border-b border-sidebar-border px-4 ${
            isCollapsed ? "lg:justify-center lg:px-2" : ""
          }`}
        >
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-md shadow-indigo-500/25">
              <BrainCircuit className="h-5 w-5 text-white" />
            </div>
            {!isCollapsed && (
              <span className="text-[15px] font-bold font-display tracking-tight leading-none text-foreground truncate">
                QuizVerse{" "}
                <span className="text-cyan-600 dark:text-cyan-400 font-extrabold">AI</span>
              </span>
            )}
          </Link>

          {/* Mobile close */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-white lg:hidden cursor-pointer transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Nav list */}
        <nav className="flex-1 space-y-0.5 p-3 overflow-y-auto" aria-label="Main navigation">
          {renderNavItems()}
        </nav>

        {/* Collapse toggle — desktop only */}
        <div className="p-3 border-t border-sidebar-border hidden lg:block">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-sm font-medium"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-[18px] w-[18px] mx-auto" />
            ) : (
              <>
                <ChevronLeft className="h-[18px] w-[18px] shrink-0" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
