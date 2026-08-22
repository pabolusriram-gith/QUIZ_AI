"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { tokenStorage } from "@/utils/storage";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithToken } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const hasExecutedRef = useRef(false);

  useEffect(() => {
    if (hasExecutedRef.current) return;

    const token = searchParams.get("token");
    if (!token) {
      setError("No authentication token was found in the redirection parameters.");
      return;
    }

    hasExecutedRef.current = true;

    const handleAuth = async () => {
      try {
        await loginWithToken(token, "from_cookie", true);
        window.location.href = "/dashboard";
      } catch (err) {
        console.error("OAuth callback login failed:", err);
        // Fallback: If profile fetch fails, still persist the token and forward to dashboard
        tokenStorage.setAccessToken(token, true);
        window.location.href = "/dashboard";
      }
    };

    handleAuth();

    // Safety timeout: Ensure the user is never stuck for more than 3 seconds
    const timer = setTimeout(() => {
      tokenStorage.setAccessToken(token, true);
      window.location.href = "/dashboard";
    }, 3000);

    return () => clearTimeout(timer);
  }, [searchParams, loginWithToken, router]);

  if (error) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-[#f8fafc] via-[#eef2ff] to-[#e0e7ff] dark:bg-gradient-to-b dark:from-[#081028] dark:via-[#070e22] dark:to-[#040816] text-slate-900 dark:text-slate-100 flex items-center justify-center p-4">
        <div className="p-6 max-w-sm rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-4">
          <p className="text-sm font-semibold text-rose-500">{error}</p>
          <p className="text-xs text-slate-400">Redirecting you back to login page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#f8fafc] via-[#eef2ff] to-[#e0e7ff] dark:bg-gradient-to-b dark:from-[#081028] dark:via-[#070e22] dark:to-[#040816] text-slate-900 dark:text-slate-100 flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-9 w-9 border-3 border-indigo-500 border-t-transparent shadow-lg shadow-indigo-500/20" />
        <p className="text-xs font-bold text-slate-300 tracking-wide font-sans">Completing sign in...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full bg-gradient-to-b from-[#f8fafc] via-[#eef2ff] to-[#e0e7ff] dark:bg-gradient-to-b dark:from-[#081028] dark:via-[#070e22] dark:to-[#040816] text-slate-900 dark:text-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-9 w-9 border-3 border-indigo-500 border-t-transparent shadow-lg shadow-indigo-500/20" />
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
