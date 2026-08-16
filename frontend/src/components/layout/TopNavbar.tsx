"use client";

import React, { useState, useEffect } from "react";
import { Menu, Search, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import UserMenu from "./UserMenu";
import { CommandMenu } from "@/components/ui/CommandMenu";
import { useAuth } from "@/context/AuthContext";

interface TopNavbarProps {
  setIsMobileOpen: (open: boolean) => void;
}

// Derive a human-readable page title from the current path
function getPageLabel(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] || "dashboard";
  const map: Record<string, string> = {
    dashboard: "Dashboard",
    quizzes: "Quizzes",
    analytics: "Analytics",
    ai: "AI Analytics",
    "create-quiz": "Create Quiz",
    "question-bank": "Question Bank",
    "live-quiz": "Live Quiz",
    reports: "Reports",
    settings: "Settings",
    profile: "Profile",
    students: "Students",
  };
  return map[last] ?? last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, " ");
}

export default function TopNavbar({ setIsMobileOpen }: TopNavbarProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { currentUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  const workspaceLabel =
    currentUser?.role === "student"
      ? "Student"
      : currentUser?.role === "teacher" || currentUser?.role === "admin"
      ? "Teacher"
      : "Workspace";

  const pageLabel = getPageLabel(pathname ?? "");

  return (
    <header className="sticky top-0 right-0 left-0 h-16 bg-background/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 lg:px-8 z-30 shadow-sm shadow-black/[0.03] dark:shadow-black/20">

      {/* Left: Mobile hamburger & breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white lg:hidden cursor-pointer transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumb — desktop only */}
        <nav className="hidden lg:flex items-center gap-1.5 text-xs font-semibold" aria-label="Breadcrumb">
          <span className="text-muted-foreground">QuizVerse</span>
          <span className="text-border mx-0.5">/</span>
          <span className="text-muted-foreground">{workspaceLabel}</span>
          <span className="text-border mx-0.5">/</span>
          <span className="text-foreground font-bold">{pageLabel}</span>
        </nav>
      </div>

      {/* Middle: Search bar trigger */}
      <div className="flex-1 max-w-sm mx-6 hidden md:block">
        <button
          onClick={() => setIsSearchOpen(true)}
          className="relative w-full text-left cursor-pointer group block"
          aria-label="Open search"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-hover:text-indigo-500 dark:group-hover:text-cyan-400 transition-colors pointer-events-none" />
          <div className="w-full pl-9 pr-4 py-2 rounded-xl bg-black/5 dark:bg-white/4 hover:bg-black/8 dark:hover:bg-white/6 border border-border text-sm text-muted-foreground group-hover:text-foreground group-hover:border-indigo-300 dark:group-hover:border-cyan-500/40 transition-all select-none outline-none flex items-center justify-between">
            <span className="text-xs">Search workspace…</span>
            <kbd className="text-[10px] font-mono text-muted-foreground border border-border px-1.5 py-0.5 rounded-md bg-background dark:bg-muted/50">
              Ctrl K
            </kbd>
          </div>
        </button>
        <CommandMenu isOpen={isSearchOpen} setIsOpen={setIsSearchOpen} />
      </div>

      {/* Right: Theme toggle + user menu */}
      <div className="flex items-center gap-2">

        {/* Theme Toggle */}
        {mounted && (
          <button
            type="button"
            id="theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/8 dark:hover:bg-white/6 transition-colors cursor-pointer"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? (
              <Sun className="h-[18px] w-[18px]" />
            ) : (
              <Moon className="h-[18px] w-[18px]" />
            )}
          </button>
        )}

        {/* Divider */}
        <div className="h-5 w-px bg-border mx-1" />

        {/* User menu */}
        <UserMenu />
      </div>
    </header>
  );
}
