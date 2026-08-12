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
    <div className="relative min-h-screen bg-[#030712] text-slate-100 flex overflow-hidden">
      
      {/* ----------------- Premium Theme Background Visuals ----------------- */}
      
      {/* Suble grid line overlay matching Login branding */}
      <div 
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1.2px,transparent_1.2px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1.2px,transparent_1.2px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_80%,transparent_100%)] opacity-85 pointer-events-none -z-10" 
        aria-hidden="true"
      />

      {/* Subtle soft gradient blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-20" aria-hidden="true">
        <div className="absolute top-1/4 left-1/4 h-[500px] w-[500px] rounded-full bg-indigo-900/10 blur-[130px]" />
        <div className="absolute bottom-1/4 right-1/4 h-[500px] w-[500px] rounded-full bg-cyan-900/10 blur-[130px]" />
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
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8 z-10">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
