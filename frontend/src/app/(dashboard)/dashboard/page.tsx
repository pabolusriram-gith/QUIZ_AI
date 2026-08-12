"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import TeacherDashboard from "@/components/dashboard/TeacherDashboard";
import StudentDashboard from "@/components/dashboard/StudentDashboard";

export default function DashboardContent() {
  const { currentUser } = useAuth();

  if (currentUser?.role === "student") {
    return <StudentDashboard />;
  }

  return <TeacherDashboard />;
}
