"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import TeacherDashboard from "@/components/dashboard/TeacherDashboard";
import StudentDashboard from "@/components/dashboard/StudentDashboard";

export default function DashboardContent() {
  const { currentUser, loading } = useAuth();

  // If session is still resolving, display graceful skeleton
  if (loading) {
    return (
      <div className="space-y-8 animate-pulse p-2">
        <div className="h-40 rounded-3xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {[...Array(4)].map((_, idx) => (
            <div key={idx} className="h-28 rounded-3xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  // Case-insensitive role comparison
  const role = currentUser?.role?.toLowerCase();

  if (role === "student") {
    return <StudentDashboard />;
  }

  // Default to Teacher dashboard for teachers and admins
  return <TeacherDashboard />;
}
