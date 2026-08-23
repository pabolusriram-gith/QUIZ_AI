"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { isAxiosError } from "axios";
import { authService } from "@/services/auth";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BrainCircuit, Mail, CheckCircle2, RotateCcw, ArrowRight, ShieldCheck, KeyRound, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const devOtpParam = searchParams.get("dev_otp") || "";

  const [email, setEmail] = useState(emailParam);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiSuccess, setApiSuccess] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(devOtpParam || null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { loginWithToken } = useAuth();

  // Keep email in sync with URL param
  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam);
    }
    if (devOtpParam) {
      setDevOtp(devOtpParam);
    }
  }, [emailParam, devOtpParam]);

  // Resend countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendCountdown > 0 && !canResend) {
      interval = setInterval(() => {
        setResendCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCountdown, canResend]);

  // Auto-focus first input on load
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleOtpChange = (index: number, value: string) => {
    // Only accept numeric characters
    const sanitized = value.replace(/[^0-9]/g, "");
    if (!sanitized) {
      const newOtp = [...otp];
      newOtp[index] = "";
      setOtp(newOtp);
      return;
    }

    // Handle single character
    const char = sanitized.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = char;
    setOtp(newOtp);

    // Auto-focus next input
    if (index < 5 && char) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      // Focus previous input on backspace
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6);
    if (!pastedData) return;

    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtp(newOtp);

    // Focus next empty or the last input
    const nextIndex = Math.min(pastedData.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleAutoFillDevOtp = (code: string) => {
    const chars = code.split("").slice(0, 6);
    const newOtp = [...otp];
    chars.forEach((c, i) => {
      newOtp[i] = c;
    });
    setOtp(newOtp);
    toast.success("Code auto-filled!");
    if (inputRefs.current[5]) {
      inputRefs.current[5].focus();
    }
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setApiError(null);
    setApiSuccess(null);

    const otpCode = otp.join("");
    if (!email) {
      setApiError("Email address is required. Please sign up or return to login.");
      return;
    }
    if (otpCode.length !== 6) {
      setApiError("Please enter all 6 digits of the verification code.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authService.verifyEmail(email, otpCode);
      setApiSuccess("Email verified successfully! Logging you in...");
      toast.success("Email verified! Welcome to QuizVerse AI.");

      // Login user session
      await loginWithToken(response.access_token, response.refresh_token, true);

      setTimeout(() => {
        router.replace("/dashboard");
      }, 1500);
    } catch (err: unknown) {
      console.error("Verification error:", err);
      if (isAxiosError(err) && err.response) {
        const errorData = err.response.data as { detail?: string };
        setApiError(errorData?.detail || "Invalid verification code. Please check and try again.");
      } else {
        setApiError("Network error. Please check your connection.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (!email) {
      setApiError("Email address is required.");
      return;
    }
    setIsResending(true);
    setApiError(null);
    try {
      const res = await authService.resendVerificationOtp(email);
      toast.success("A new verification code has been dispatched to your email!");
      if (res.dev_otp) {
        setDevOtp(res.dev_otp);
      }
      setResendCountdown(60);
      setCanResend(false);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err: unknown) {
      console.error("Resend error:", err);
      if (isAxiosError(err) && err.response) {
        const errorData = err.response.data as { detail?: string };
        setApiError(errorData?.detail || "Failed to resend verification code.");
      } else {
        setApiError("Failed to resend verification code. Please try again.");
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-[#f8fafc] via-[#eef2ff] to-[#e0e7ff] dark:bg-gradient-to-b dark:from-[#1e143c] dark:via-[#170f2e] dark:to-[#120b24] text-foreground flex flex-col justify-between items-center py-10 px-4">
      
      {/* Background Subtle Grid Pattern */}
      <div
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.03)_1px,transparent_1px)] dark:bg-[radial-gradient(#818cf840_1.2px,transparent_1.2px)] dark:bg-[size:30px_30px] [mask-image:radial-gradient(ellipse_80%_70%_at_50%_45%,#000_70%,transparent_100%)] pointer-events-none"
        aria-hidden="true"
      />

      {/* Overhead Aurora Glow Beam */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[380px] bg-gradient-to-b from-indigo-400/40 via-cyan-400/20 to-transparent dark:from-violet-600/35 dark:via-cyan-500/18 dark:to-transparent blur-[90px] -z-15 pointer-events-none" />

      {/* Glowing backdrop elements */}
      <div className="absolute inset-0 -z-20 overflow-hidden pointer-events-none" aria-hidden="true">
        <motion.div 
          animate={{ x: [0, 25, 0], y: [0, -25, 0], scale: [1, 1.05, 1] }} 
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-24 -left-16 h-[580px] w-[580px] rounded-full bg-gradient-to-tr from-indigo-600/40 via-blue-600/30 to-violet-500/25 dark:from-violet-700/35 dark:via-purple-700/22 dark:to-transparent blur-[130px]"
        />
        <motion.div 
          animate={{ x: [0, -25, 0], y: [0, 25, 0], scale: [1, 1.05, 1] }} 
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute -bottom-24 -right-16 h-[580px] w-[580px] rounded-full bg-gradient-to-bl from-cyan-400/40 via-sky-500/35 to-blue-600/30 dark:from-cyan-500/28 dark:via-sky-600/18 dark:to-transparent blur-[130px]"
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[520px] w-[520px] rounded-full bg-indigo-500/25 blur-[100px] pointer-events-none" />
      </div>

      <div className="flex-1 flex items-center justify-center w-full z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[460px]"
        >
          <Card className="bg-slate-50/85 dark:bg-[#101e4a]/90 backdrop-blur-2xl border border-slate-200/80 dark:border-indigo-400/30 shadow-[0_10px_35px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(6,16,51,0.8)] rounded-2xl overflow-hidden p-1">
            <CardContent className="pt-8 pb-7 px-6 sm:px-8 space-y-6">

              {/* Header Icon */}
              <div className="flex flex-col items-center text-center space-y-4">
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 shadow-md shadow-indigo-500/25 ring-1 ring-white/20"
                >
                  <KeyRound className="h-7 w-7 text-white" />
                  <span className="absolute -inset-0.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 opacity-30 blur-sm -z-10" />
                </motion.div>

                <div className="space-y-1">
                  <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-display">
                    Verify Your Email
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                    We sent a 6-digit verification code to{" "}
                    <span className="font-bold text-slate-800 dark:text-slate-200 break-all">{email || "your email address"}</span>.
                  </p>
                </div>
              </div>

              {/* Dev Mode OTP Banner (for instant testing when SMTP is not configured) */}
              {devOtp && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Dev Mode Code
                    </span>
                    <div className="font-mono font-bold text-sm tracking-widest text-slate-900 dark:text-white">
                      {devOtp}
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleAutoFillDevOtp(devOtp)}
                    className="h-8 px-3 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white border-none cursor-pointer shrink-0"
                  >
                    Auto-Fill
                  </Button>
                </motion.div>
              )}

              {/* Error Message */}
              <AnimatePresence>
                {apiError && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-semibold leading-relaxed"
                  >
                    {apiError}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Success Message */}
              <AnimatePresence>
                {apiSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{apiSuccess}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 6-Digit OTP Inputs */}
              <form onSubmit={handleVerify} className="space-y-6">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block text-center mb-3">
                    Enter 6-Digit Code
                  </label>
                  <div className="flex justify-center items-center gap-2 sm:gap-3">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => {
                          inputRefs.current[index] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onPaste={handlePaste}
                        className={`w-11 h-13 sm:w-13 sm:h-14 text-center font-mono text-xl sm:text-2xl font-extrabold rounded-xl border transition-all outline-none ${
                          digit
                            ? "bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500 text-indigo-600 dark:text-indigo-300 shadow-sm shadow-indigo-500/20 scale-105"
                            : "bg-slate-100/80 dark:bg-[#121c33]/85 border-slate-200 dark:border-slate-700/70 text-slate-900 dark:text-white focus:border-indigo-500/60 focus:bg-slate-100 dark:focus:bg-[#172442]"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Submit Verification Button */}
                <Button
                  type="submit"
                  disabled={isSubmitting || otp.join("").length !== 6}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 border-none cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="h-4.5 w-4.5" />
                      <span>Verify & Continue</span>
                      <ArrowRight className="h-4.5 w-4.5" />
                    </>
                  )}
                </Button>
              </form>

              {/* Resend Code Action */}
              <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1">
                  <span>Didn&apos;t receive the code?</span>
                  {canResend ? (
                    <button
                      type="button"
                      disabled={isResending}
                      onClick={handleResendOtp}
                      className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer border-none bg-transparent"
                    >
                      {isResending ? "Sending..." : "Resend Code"}
                    </button>
                  ) : (
                    <span className="font-semibold text-slate-400 dark:text-slate-500">
                      Resend in {resendCountdown}s
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 mt-2">
                  <Link
                    href="/register"
                    className="text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium hover:underline text-xs"
                  >
                    Change Email
                  </Link>
                  <span>•</span>
                  <Link
                    href="/login"
                    className="text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium hover:underline text-xs"
                  >
                    Back to Sign In
                  </Link>
                </div>
              </div>

            </CardContent>
          </Card>
        </motion.div>
      </div>

      <footer className="text-xs text-slate-500 dark:text-slate-400 font-medium py-2 select-none z-10">
        &copy; 2026 QuizVerse AI. All rights reserved.
      </footer>
    </div>
  );
}
