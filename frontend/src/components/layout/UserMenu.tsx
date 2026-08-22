"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { User, Settings, LogOut, ChevronDown } from "lucide-react";

export default function UserMenu() {
  const { currentUser, logout, switchRole } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
    router.push("/login");
  };

  if (!currentUser) return null;

  // Derive initials
  const name = currentUser.full_name || currentUser.email;
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 p-1.5 pr-3 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors focus:outline-none cursor-pointer"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 font-semibold text-white text-sm shadow-sm">
          {initials}
        </div>
        <div className="hidden md:flex flex-col text-left">
          <span className="text-xs font-semibold text-foreground leading-tight">
            {currentUser.full_name || "User"}
          </span>
          <span className="text-[10px] text-muted-foreground font-medium leading-none mt-0.5 max-w-[120px] truncate">
            {currentUser.email}
          </span>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>
 
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-56 origin-top-right rounded-2xl bg-popover/90 backdrop-blur-xl border border-border shadow-[0_10px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
          >
            {/* Header info */}
            <div className="px-3 py-2.5 border-b border-border mb-1">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium">Signed in as</p>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 dark:text-cyan-400 border border-indigo-500/20">
                  {currentUser.role || "User"}
                </span>
              </div>
              <p className="text-sm font-semibold text-foreground truncate mt-1">
                {currentUser.full_name || "User"}
              </p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {currentUser.email}
              </p>
            </div>
 
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={async () => {
                  setIsOpen(false);
                  const targetRole = currentUser.role === "teacher" ? "student" : "teacher";
                  try {
                    await switchRole(targetRole);
                    window.location.reload();
                  } catch (e) {
                    console.error("Failed to switch role:", e);
                  }
                }}
                className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold text-indigo-600 dark:text-cyan-400 bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors cursor-pointer text-left"
              >
                <span>Switch to {currentUser.role === "teacher" ? "Student" : "Teacher"}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20">Mode</span>
              </button>
 
              <Link
                href="/profile"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                <User className="h-4 w-4 text-muted-foreground" />
                Profile
              </Link>
 
              <Link
                href="/settings"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                Settings
              </Link>
 
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:text-rose-500 dark:hover:text-rose-300 transition-colors cursor-pointer text-left"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
