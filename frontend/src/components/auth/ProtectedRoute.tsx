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
        router.push("/login");
      } else if (allowedRoles && currentUser && !allowedRoles.includes(currentUser.role as any)) {
        toast.error("Unauthorized access. Redirecting...");
        router.push("/dashboard");
      }
    }
  }, [isAuthenticated, loading, currentUser, allowedRoles, router]);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#fafbfc] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600" />
          <p className="text-xs font-medium text-gray-500">Checking authorization...</p>
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
