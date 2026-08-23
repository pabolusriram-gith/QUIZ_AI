"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import TopNavbar from "./TopNavbar";

interface DashboardShellProps {
  children: React.ReactNode;
}

export default function DashboardShell({ children }: DashboardShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Sync collapsible state preference from LocalStorage safely (prevent hydration mismatch)
  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem("quizverse-sidebar-collapsed");
    if (saved) {
      setIsCollapsed(saved === "true");
    }
  }, []);

  const handleSetCollapsed = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    localStorage.setItem("quizverse-sidebar-collapsed", String(collapsed));
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground flex overflow-hidden">
      
      {/* ----------------- Premium Theme Background Visuals ----------------- */}
      
      {/* Subtle grid line overlay */}
      <div 
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(99,102,241,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.035)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1.2px,transparent_1.2px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1.2px,transparent_1.2px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,#000_80%,transparent_100%)] pointer-events-none -z-10" 
        aria-hidden="true"
      />

      {/* Radiant ambient glow blobs - rich luminous light theme & sleek dark theme */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-20" aria-hidden="true">
        <div className="absolute -top-20 -left-20 h-[650px] w-[650px] rounded-full bg-gradient-to-br from-indigo-500/14 via-purple-500/10 to-cyan-400/8 dark:bg-indigo-900/15 blur-[130px]" />
        <div className="absolute top-1/3 -right-20 h-[600px] w-[600px] rounded-full bg-gradient-to-bl from-cyan-500/14 via-sky-400/10 to-indigo-500/8 dark:bg-cyan-900/15 blur-[140px]" />
        <div className="absolute -bottom-32 left-1/3 h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-violet-500/10 via-indigo-500/8 to-teal-400/8 dark:bg-transparent blur-[130px]" />
      </div>

      {/* ----------------- Sidebar ----------------- */}
      <Sidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={handleSetCollapsed}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      {/* ----------------- Main Viewport ----------------- */}
      <div
        className={`flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300 ease-in-out ${
          isMounted ? (isCollapsed ? "lg:pl-20" : "lg:pl-64") : "lg:pl-64"
        }`}
      >
        {/* Top Navbar */}
        <TopNavbar setIsMobileOpen={setIsMobileOpen} />

        {/* Scrollable page body */}
        <main className="flex-1 overflow-y-auto px-5 py-7 md:px-8 md:py-8 z-10">
          <div className="max-w-[1400px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
