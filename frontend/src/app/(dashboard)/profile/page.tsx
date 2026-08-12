"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/layout/PageHeader";
import { motion } from "framer-motion";
import { User, Mail, ShieldAlert, Calendar } from "lucide-react";

export default function ProfilePage() {
  const { currentUser } = useAuth();

  // Derive initials
  const initials = currentUser?.full_name
    ? currentUser.full_name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
    : currentUser?.email[0].toUpperCase();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Reusable page header */}
      <PageHeader
        title="Profile"
        description="View and verify your teacher identity details."
      />

      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="glass-panel border-white/5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)] rounded-3xl p-6 md:p-8 space-y-8"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-8 border-b border-white/5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-600 font-extrabold text-white text-xl shadow-lg shadow-indigo-500/20">
            {initials}
          </div>
          <div>
            <h3 className="text-xl font-bold text-white font-display">
              {currentUser?.full_name || "QuizVerse Teacher"}
            </h3>
            <p className="text-sm text-slate-400 font-medium mt-0.5">{currentUser?.email}</p>
          </div>
        </div>

        {currentUser && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 rounded-xl bg-white/3 border border-white/5 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-indigo-400" />
                <span>Full Name</span>
              </span>
              <span className="text-sm text-slate-200 font-semibold block pt-1">{currentUser.full_name || "Not set"}</span>
            </div>

            <div className="p-4 rounded-xl bg-white/3 border border-white/5 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-cyan-400" />
                <span>Account Email</span>
              </span>
              <span className="text-sm text-slate-200 font-semibold block pt-1">{currentUser.email}</span>
            </div>

            <div className="p-4 rounded-xl bg-white/3 border border-white/5 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                <span>Role Type</span>
              </span>
              <span className="text-sm text-slate-200 font-semibold block pt-1 capitalize">{currentUser.role}</span>
            </div>

            <div className="p-4 rounded-xl bg-white/3 border border-white/5 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-emerald-400" />
                <span>Account Created At</span>
              </span>
              <span className="text-sm text-slate-200 font-semibold block pt-1">
                {new Date(currentUser.created_at).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
