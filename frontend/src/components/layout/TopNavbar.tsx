"use client";

import React, { useState } from "react";
import { Menu, Search, Bell } from "lucide-react";
import UserMenu from "./UserMenu";
import { CommandMenu } from "@/components/ui/CommandMenu";
import { useAuth } from "@/context/AuthContext";

interface TopNavbarProps {
  setIsMobileOpen: (open: boolean) => void;
}

export default function TopNavbar({ setIsMobileOpen }: TopNavbarProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { currentUser } = useAuth();

  const workspaceLabel =
    currentUser?.role === "student"
      ? "Student Workspace"
      : currentUser?.role === "teacher" || currentUser?.role === "admin"
      ? "Teacher Workspace"
      : "Workspace";

  return (
    <header className="sticky top-0 right-0 left-0 h-16 bg-[#030712]/45 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 lg:px-8 z-30">
      
      {/* Left: Mobile hamburger & breadcrumb placeholder */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="p-2 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white lg:hidden cursor-pointer"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        
        {/* Simple path identifier */}
        <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <span>QuizVerse Platform</span>
          <span className="text-white/20">/</span>
          <span className="text-cyan-400">{workspaceLabel}</span>
        </div>
      </div>

      {/* Middle: Search bar trigger */}
      <div className="flex-1 max-w-md mx-8 hidden md:block">
        <button
          onClick={() => setIsSearchOpen(true)}
          className="relative w-full text-left cursor-pointer group block"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-hover:text-cyan-400 transition-colors pointer-events-none" />
          <div
            className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-white/3 hover:bg-white/5 border border-white/5 text-sm text-slate-400 group-hover:text-white transition-all select-none outline-none flex items-center justify-between shadow-inner"
          >
            <span>Search workspace...</span>
            <kbd className="text-[10px] font-mono text-slate-500 border border-white/10 px-1.5 py-0.5 rounded bg-[#090f1e]">
              Ctrl+K
            </kbd>
          </div>
        </button>
        <CommandMenu isOpen={isSearchOpen} setIsOpen={setIsSearchOpen} />
      </div>

      {/* Right: Notification & User Profile Menu */}
      <div className="flex items-center gap-3.5">
        
        {/* Notification Icon Placeholder */}
        <button
          type="button"
          disabled
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-not-allowed"
          aria-label="Notifications"
          title="Notifications (Coming Soon)"
        >
          <Bell className="h-5 w-5" />
        </button>

        {/* Divider line */}
        <div className="h-5 w-px bg-white/5" />

        {/* Reusable UserMenu */}
        <UserMenu />
      </div>
    </header>
  );
}
