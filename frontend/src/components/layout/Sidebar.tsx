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
  FileDown
} from "lucide-react";

// Safe, type-safe icon mapper to avoid importing all lucide icons
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  BookOpen,
  FileSpreadsheet,
  PlayCircle,
  Users,
  BarChart3,
  Settings,
  FileDown,
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

  const renderNavItems = () => {
    const filteredConfig = sidebarConfig.filter((item: SidebarItem) => {
      if (currentUser?.role === "student") {
        return item.name === "Dashboard" || item.name === "Settings";
      }
      return true;
    });

    return filteredConfig.map((item: SidebarItem) => {
      const Icon = iconMap[item.iconName] || Settings;
      
      // Strict path matching (Dashboard / Settings / Profile)
      const isActive = pathname === item.path || (item.path !== "/" && pathname.startsWith(item.path));

      if (item.isComingSoon) {
        return (
          <div
            key={item.name}
            className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 cursor-not-allowed select-none bg-transparent transition-all duration-200`}
            title={`${item.name} - Coming Soon`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!isCollapsed && (
              <div className="flex items-center justify-between w-full min-w-0">
                <span className="text-sm font-medium truncate">{item.name}</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-slate-500 uppercase tracking-wide shrink-0 border border-white/5">
                  Soon
                </span>
              </div>
            )}
            {isCollapsed && (
              <div className="absolute left-16 hidden group-hover:block bg-[#090f1e] border border-white/10 text-white text-[10px] font-semibold px-2 py-1 rounded shadow-md whitespace-nowrap z-50">
                {item.name} (Coming Soon)
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
          className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border ${
            isActive
              ? "bg-indigo-500/10 text-white font-semibold border-indigo-500/15"
              : "text-slate-400 hover:text-white hover:bg-white/3 border-transparent"
          }`}
        >
          <Icon className={`h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-105 ${isActive ? "text-cyan-400" : "text-slate-400 group-hover:text-cyan-400"}`} />
          {!isCollapsed && <span className="truncate">{item.name}</span>}
          {isCollapsed && (
            <div className="absolute left-16 scale-95 opacity-0 pointer-events-none group-hover:scale-100 group-hover:opacity-100 transition-all duration-150 bg-[#090f1e] border border-white/10 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-md whitespace-nowrap z-50">
              {item.name}
            </div>
          )}
        </Link>
      );
    });
  };

  return (
    <>
      {/* ----------------- Mobile Drawer Backdrop ----------------- */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-40 lg:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* ----------------- Sidebar Container ----------------- */}
      <aside
        className={`fixed top-0 bottom-0 left-0 bg-[#040811]/45 backdrop-blur-xl border-r border-white/5 flex flex-col z-40 transition-all duration-300 ease-in-out ${
          isMobileOpen
            ? "translate-x-0 w-64"
            : "-translate-x-full lg:translate-x-0"
        } ${isCollapsed ? "lg:w-20" : "lg:w-64"}`}
      >
        {/* Header Branding */}
        <div className={`flex h-16 items-center justify-between px-4 border-b border-white/5 ${isCollapsed ? "lg:justify-center lg:px-2" : ""}`}>
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-md shadow-indigo-500/20 shrink-0">
              <BrainCircuit className="h-5.5 w-5.5 text-white" />
            </div>
            {!isCollapsed && (
              <span className="text-lg font-bold font-display tracking-tight leading-none bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent animate-pulse">
                QuizVerse <span className="text-cyan-400 font-extrabold">AI</span>
              </span>
            )}
          </Link>
          
          {/* Mobile close button */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white lg:hidden cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 space-y-1.5 p-4 overflow-y-auto">
          {renderNavItems()}
        </nav>

        {/* Desktop Collapse Toggle Footer */}
        <div className="p-4 border-t border-white/5 hidden lg:block">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/3 transition-colors cursor-pointer"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5 mx-auto text-slate-400" />
            ) : (
              <>
                <ChevronLeft className="h-5 w-5 text-slate-400" />
                <span className="text-sm font-medium">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
