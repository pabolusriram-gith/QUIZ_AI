"use client";

import { useState, useEffect } from "react";
import { isAxiosError } from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { BrainCircuit, Eye, EyeOff, Lock, Mail, Gamepad2, ArrowRight } from "lucide-react";

// Zod Validation Schema
const loginSchema = z.object({
  email: z.string().min(1, "Email address is required").email("Please enter a valid email."),
  password: z.string().min(1, "Password is required").min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean().default(false),
});

type LoginSchemaType = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  
  const { login, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  const showToast = (message: string, type: "error" | "success" = "error") => {
    setToast({ message, type });
  };

  // Auto-clear toast alert
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Intercept error parameters from OAuth callback redirects
  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const errorMsg = searchParams.get("error");
      if (errorMsg) {
        showToast(decodeURIComponent(errorMsg), "error");
        // Remove error from URL without triggering page reload
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    }
  }, []);

  // Timeout protection to reset loading state if redirection hangs
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (oauthLoading) {
      timeoutId = setTimeout(() => {
        setOauthLoading(null);
        showToast("Sign-In request timed out. Please check your connection and try again.", "error");
      }, 10000);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [oauthLoading]);

  // Redirect already authenticated users away from the login page
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, loading, router]);

  // React Hook Form initialization with custom zero-dependency Zod resolver
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginSchemaType>({
    mode: "onChange",
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
    resolver: async (values) => {
      try {
        const data = loginSchema.parse(values);
        return {
          values: data,
          errors: {},
        };
      } catch (err) {
        if (err instanceof z.ZodError) {
          const formattedErrors = err.issues.reduce((acc, current) => {
            const field = current.path[0] as string;
            acc[field] = {
              type: current.code,
              message: current.message,
            };
            return acc;
          }, {} as Record<string, { type: string; message: string }>);
          
          return {
            values: {},
            errors: formattedErrors,
          };
        }
        return { values: {}, errors: {} };
      }
    },
  });


  const onSubmit = async (data: LoginSchemaType) => {
    setApiError(null);
    try {
      await login(data.email, data.password, data.rememberMe);
      router.push("/dashboard");
    } catch (error: unknown) {
      // Log only the message to prevent logging raw axios error objects containing sensitive information
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("Login failure:", errorMsg);
      
      // Axios error checking
      if (isAxiosError(error)) {
        if (error.response) {
          if (error.response.status === 401) {
            setApiError("Invalid email or password");
          } else if (error.response.status === 422) {
            setApiError("Invalid inputs sent to server. Please review details.");
          } else {
            const responseData = error.response.data as { detail?: string };
            setApiError(responseData?.detail || "An unexpected error occurred. Please try again.");
          }
        } else if (error.request) {
          setApiError("Server is currently unavailable. Please verify the backend API is running.");
        } else {
          setApiError(error.message || "A network error occurred. Please check your connection.");
        }
      } else {
        setApiError(errorMsg);
      }
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-[#f8fafc] via-[#eef2ff] to-[#e0e7ff] dark:bg-gradient-to-b dark:from-[#0d1e57] dark:via-[#091745] dark:to-[#061033] text-foreground flex flex-col justify-between items-center py-10 px-4">
      
      {/* ----------------- Background Design ----------------- */}
      
      {/* Subtle Tech Dot Matrix Grid */}
      <div 
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.03)_1px,transparent_1px)] dark:bg-[radial-gradient(#818cf840_1.2px,transparent_1.2px)] dark:bg-[size:30px_30px] [mask-image:radial-gradient(ellipse_80%_70%_at_50%_45%,#000_70%,transparent_100%)] pointer-events-none" 
        aria-hidden="true"
      />

      {/* Overhead Aurora Glow Beam */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[380px] bg-gradient-to-b from-indigo-400/40 via-cyan-400/20 to-transparent blur-[90px] -z-15 pointer-events-none" />
 
      {/* Animated soft ambient gradient mesh */}
      <div className="absolute inset-0 -z-20 overflow-hidden pointer-events-none" aria-hidden="true">
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            x: [0, 35, 0],
            y: [0, -25, 0],
          }}
          transition={{
            duration: 13,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -top-24 -left-16 h-[580px] w-[580px] rounded-full bg-gradient-to-tr from-indigo-500/45 via-blue-600/35 to-violet-500/30 blur-[120px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.18, 1],
            x: [0, -30, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 16,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -bottom-24 -right-16 h-[580px] w-[580px] rounded-full bg-gradient-to-bl from-cyan-400/40 via-sky-500/35 to-blue-600/30 blur-[130px]"
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[520px] w-[520px] rounded-full bg-indigo-500/25 blur-[100px] pointer-events-none" />
      </div>
 
      <div className="flex-1 flex items-center justify-center w-full z-10">
        
        {/* ----------------- Animated Login Card ----------------- */}
        
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[440px]"
        >
          <Card className="bg-slate-50/85 dark:bg-[#101e4a]/90 backdrop-blur-2xl border border-slate-200/80 dark:border-indigo-400/30 shadow-[0_10px_35px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(6,16,51,0.8)] rounded-2xl overflow-hidden p-1">
            <CardContent className="pt-8 pb-7 px-8 space-y-6">
              
              {/* --- Header Section (Branding & Welcome) --- */}
              <div className="flex flex-col items-center text-center space-y-4">
                
                {/* Gradient Logo */}
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-600 shadow-md shadow-indigo-500/25 ring-1 ring-white/20"
                >
                  <BrainCircuit className="h-6 w-6 text-white animate-pulse" />
                  <span className="absolute -inset-0.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 opacity-30 blur-sm -z-10" />
                </motion.div>
 
                {/* Title & Subtitle */}
                <div className="space-y-1">
                  <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-display">
                    QuizVerse AI
                  </h1>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
                    AI-Powered Assessment Workspace
                  </p>
                </div>
 
                {/* Greeting */}
                <div className="space-y-1 pt-1">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 font-display">
                    Welcome Back 👋
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[320px]">
                    Sign in to continue creating and managing AI-powered quizzes.
                  </p>
                </div>
              </div>

              {/* Live Quiz Quick Callout */}
              <Link
                href="/join"
                className="group flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-cyan-500/10 hover:from-blue-500/15 hover:via-indigo-500/15 hover:to-cyan-500/15 border border-indigo-500/20 hover:border-indigo-500/40 transition-all duration-200"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 group-hover:scale-105 transition-transform duration-200">
                    <Gamepad2 className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      Joining a Live Quiz?
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400">No Account Needed</span>
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Enter your PIN & nickname directly
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all duration-200" />
              </Link>

              {/* --- API Response Error --- */}
              {apiError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 font-medium leading-relaxed flex items-start gap-2.5"
                >
                  <svg className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{apiError}</span>
                </motion.div>
              )}

              {/* --- Form Section --- */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                
                {/* Email Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-slate-600 dark:text-slate-400 font-medium text-xs">
                    Email address
                  </Label>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400 dark:text-slate-500 group-focus-within:text-cyan-500 dark:group-focus-within:text-cyan-400 transition-colors duration-200" />
                    <Input
                      id="email"
                      type="email"
                      disabled={isSubmitting || oauthLoading !== null}
                      placeholder="name@example.com"
                      {...register("email")}
                      className={`pl-11 pr-4 h-11 w-full bg-slate-100/70 dark:bg-[#132356]/85 border border-slate-200 dark:border-indigo-400/30 rounded-xl hover:border-slate-300 dark:hover:border-indigo-400/50 focus:border-indigo-500 dark:focus:border-cyan-400 focus:bg-white dark:focus:bg-[#182b68] focus:ring-4 focus:ring-indigo-500/10 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-200 ${errors.email ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' : ''}`}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-xs text-rose-400 font-medium pl-1">
                      {errors.email.message}
                    </p>
                  )}
                </div>
 
                {/* Password Input */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="password" className="text-slate-600 dark:text-slate-400 font-medium text-xs">
                      Password
                    </Label>
                    <button
                      type="button"
                      onClick={() => router.push("/forgot-password")}
                      tabIndex={-1}
                      className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 hover:underline focus:outline-none cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400 dark:text-slate-500 group-focus-within:text-cyan-500 dark:group-focus-within:text-cyan-400 transition-colors duration-200" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      disabled={isSubmitting || oauthLoading !== null}
                      placeholder="••••••••"
                      {...register("password")}
                      className={`pl-11 pr-11 h-11 w-full bg-slate-100/70 dark:bg-[#132356]/85 border border-slate-200 dark:border-indigo-400/30 rounded-xl hover:border-slate-300 dark:hover:border-indigo-400/50 focus:border-indigo-500 dark:focus:border-cyan-400 focus:bg-white dark:focus:bg-[#182b68] focus:ring-4 focus:ring-indigo-500/10 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-200 ${errors.password ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400 hover:text-slate-200 focus:outline-none transition-colors cursor-pointer"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-rose-400 font-medium pl-1">
                      {errors.password.message}
                    </p>
                  )}
                </div>
 
                {/* Remember Me */}
                <div className="flex items-center pt-0.5">
                  <label className="group flex items-center gap-2.5 cursor-pointer text-xs text-slate-600 dark:text-slate-400 select-none">
                    <div className="relative flex items-center justify-center h-4.5 w-4.5 rounded-md border border-slate-300 dark:border-indigo-400/30 bg-slate-100 dark:bg-[#132356] transition-all group-hover:border-indigo-500 group-hover:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-600">
                      <input 
                        type="checkbox" 
                        disabled={isSubmitting || oauthLoading !== null}
                        className="peer sr-only" 
                        {...register("rememberMe")}
                      />
                      <svg className="h-3 w-3 text-white scale-0 transition-transform duration-150 peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                    <span className="group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors font-medium">Remember for 30 days</span>
                  </label>
                </div>
 
                {/* Submit Button */}
                <motion.div
                  whileHover={!(isSubmitting || oauthLoading !== null) ? { scale: 1.01 } : {}}
                  whileTap={!(isSubmitting || oauthLoading !== null) ? { scale: 0.99 } : {}}
                  className="pt-2"
                >
                  <Button
                    type="submit"
                    disabled={isSubmitting || oauthLoading !== null}
                    className="w-full h-11 font-semibold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600 hover:from-indigo-500 hover:via-indigo-400 hover:to-cyan-500 rounded-xl shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 cursor-pointer border-0 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Signing In...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </motion.div>
              </form>
 
              {/* --- Divider --- */}
              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-200 dark:border-indigo-400/25 w-full" />
                <span className="bg-slate-50 dark:bg-[#101e4a] px-3 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-400 uppercase">
                  Or continue with
                </span>
                <div className="border-t border-slate-200 dark:border-indigo-400/25 w-full" />
              </div>
 
              {/* --- Google OAuth Button --- */}
              <motion.div
                whileHover={!(isSubmitting || oauthLoading !== null) ? { scale: 1.01 } : {}}
                whileTap={!(isSubmitting || oauthLoading !== null) ? { scale: 0.99 } : {}}
              >
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setOauthLoading("google");
                    window.location.href = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1") + "/auth/google/login";
                  }}
                  disabled={isSubmitting || oauthLoading !== null}
                  className="w-full h-11 rounded-xl border border-slate-200 dark:border-indigo-400/30 bg-slate-100/80 dark:bg-[#132356]/85 hover:bg-slate-200/70 dark:hover:bg-[#182b68] text-slate-800 dark:text-slate-200 font-medium transition-all duration-200 shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {oauthLoading === "google" ? (
                    <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 shrink-0" aria-hidden="true" viewBox="0 0 488 512">
                      <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                    </svg>
                  )}
                  <span>{oauthLoading === "google" ? "Connecting to Google..." : "Continue with Google"}</span>
                </Button>
              </motion.div>
 
              {/* --- Sign Up Redirect --- */}
              <div className="pt-2 text-center text-sm text-slate-500 dark:text-slate-400">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/register")}
                  className="font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 hover:underline focus:outline-none cursor-pointer"
                >
                  Create one free
                </button>
              </div>
 
            </CardContent>
          </Card>
        </motion.div>
      </div>
 
      {/* --- Footer Section --- */}
      <footer className="text-center text-xs text-slate-400 dark:text-slate-500 pt-6">
        &copy; 2026 QuizVerse AI. All rights reserved.
      </footer>
 
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95, x: "-50%" }}
            animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
            exit={{ opacity: 0, y: -20, scale: 0.95, x: "-50%" }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed top-6 left-1/2 z-50 px-4 py-3 rounded-xl border border-rose-500/25 bg-slate-900/90 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.3)] flex items-center gap-2.5 text-xs font-semibold text-rose-300 max-w-sm w-full mx-4"
          >
            <svg className="h-4.5 w-4.5 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

