"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ("student" | "teacher" | "admin")[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, loading, currentUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.replace("/login");
      } else if (allowedRoles && currentUser && !allowedRoles.includes(currentUser.role as any)) {
        toast.error("Unauthorized access. Redirecting...");
        router.replace("/dashboard");
      }
    }
  }, [isAuthenticated, loading, currentUser, allowedRoles, router]);

  // Safety fallback: if loading takes more than 3.5 seconds, redirect to login
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        if (!isAuthenticated) {
          router.replace("/login");
        }
      }, 3500);
      return () => clearTimeout(timeout);
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-[#09090f] via-[#0d0a14] to-[#07070d] text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-9 w-9 border-3 border-indigo-500 border-t-transparent shadow-lg shadow-indigo-500/20" />
          <p className="text-xs font-bold text-slate-300 tracking-wide font-sans">Checking authorization...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || (allowedRoles && currentUser && !allowedRoles.includes(currentUser.role as any))) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
