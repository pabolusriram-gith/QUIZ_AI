"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithToken } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuth = async () => {
      const token = searchParams.get("token");
      if (!token) {
        setError("No authentication token was found in the redirection parameters.");
        return;
      }
      try {
        await loginWithToken(token, "from_cookie", true); // default rememberMe to true
        // Instantly clean search parameters and load dashboard
        router.replace("/dashboard");
      } catch (err) {
        console.error("OAuth callback login failed:", err);
        const errMsg = encodeURIComponent("Failed to sign in. The token may be invalid or expired.");
        router.replace(`/login?error=${errMsg}`);
      }
    };

    handleAuth();
  }, [searchParams, loginWithToken, router]);

  if (error) {
    return (
      <div className="min-h-screen w-full bg-[#fafbfc] flex items-center justify-center p-4">
        <div className="p-6 max-w-sm rounded-2xl bg-red-50 border border-red-200 text-center space-y-4">
          <p className="text-sm font-semibold text-red-600">{error}</p>
          <p className="text-xs text-gray-500">Redirecting you back to login page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#fafbfc] flex items-center justify-center">
      <div className="flex flex-col items-center space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600" />
        <p className="text-xs font-semibold text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full bg-[#fafbfc] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600" />
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
