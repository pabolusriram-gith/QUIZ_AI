"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/layout/PageHeader";
import { motion } from "framer-motion";
import { Shield, Key, Sliders, CheckCircle } from "lucide-react";

export default function SettingsPage() {
  const { currentUser } = useAuth();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Reusable page header */}
      <PageHeader
        title="Settings"
        description="Manage your account preferences and classroom configurations."
      />

      {/* Settings Options Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="glass-panel border-white/5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)] rounded-3xl p-6 md:p-8 space-y-6"
      >
        <div>
          <h3 className="text-lg font-bold text-white font-display">Account Information</h3>
          <p className="text-xs text-slate-400 mt-1">Verify your profile credentials below.</p>
        </div>

        {currentUser && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 p-4 rounded-xl bg-white/3 border border-white/5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-indigo-400" />
                <span>User ID</span>
              </span>
              <span className="font-mono text-xs text-slate-300 font-semibold break-all block pt-1">{currentUser.id}</span>
            </div>
            
            <div className="space-y-1.5 p-4 rounded-xl bg-white/3 border border-white/5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-cyan-400" />
                <span>Email Address</span>
              </span>
              <span className="text-sm text-slate-200 font-semibold block pt-1">{currentUser.email}</span>
            </div>

            <div className="space-y-1.5 p-4 rounded-xl bg-white/3 border border-white/5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-rose-400" />
                <span>Assigned Role</span>
              </span>
              <span className="text-sm text-slate-200 font-semibold capitalize block pt-1">{currentUser.role}</span>
            </div>

            <div className="space-y-1.5 p-4 rounded-xl bg-white/3 border border-white/5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                <span>Status</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold text-sm pt-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Active
              </span>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
