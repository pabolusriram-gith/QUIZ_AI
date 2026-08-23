"use client";

import { useState } from "react";
import { isAxiosError } from "axios";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authService } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { BrainCircuit, Eye, EyeOff, Lock, Mail, User, Gamepad2, ArrowRight } from "lucide-react";

// Password validation regex
const passwordRegex = {
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  number: /[0-9]/,
  special: /[^A-Za-z0-9]/,
};

// Zod Validation Schema
const registerSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(100, "Full name is too long"),
  email: z.string().min(1, "Email address is required").email("Please enter a valid email."),
  role: z.enum(["student", "teacher"]),
  password: z.string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters")
    .regex(passwordRegex.uppercase, "Password must contain at least one uppercase letter")
    .regex(passwordRegex.lowercase, "Password must contain at least one lowercase letter")
    .regex(passwordRegex.number, "Password must contain at least one number")
    .regex(passwordRegex.special, "Password must contain at least one special character"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RegisterSchemaType = z.infer<typeof registerSchema>;

export default function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiSuccess, setApiSuccess] = useState<string | null>(null);

  const router = useRouter();

  // React Hook Form initialization with custom zero-dependency Zod resolver
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterSchemaType>({
    mode: "onChange",
    defaultValues: {
      fullName: "",
      email: "",
      role: "student",
      password: "",
      confirmPassword: "",
    },
    resolver: async (values) => {
      try {
        const data = registerSchema.parse(values);
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

  const passwordVal = watch("password") || "";
  const roleVal = watch("role") || "student";

  // Password strength meter calculation
  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (!pass) return { score, label: "None", color: "bg-gray-200" };
    if (pass.length >= 8) score += 1;
    if (passwordRegex.uppercase.test(pass)) score += 1;
    if (passwordRegex.lowercase.test(pass)) score += 1;
    if (passwordRegex.number.test(pass)) score += 1;
    if (passwordRegex.special.test(pass)) score += 1;

    if (score <= 2) return { score, label: "Weak 🔴", color: "bg-red-500 w-1/3" };
    if (score <= 4) return { score, label: "Medium 🟡", color: "bg-amber-500 w-2/3" };
    return { score, label: "Strong 🟢", color: "bg-emerald-500 w-full" };
  };

  const strength = getPasswordStrength(passwordVal);

  const onSubmit = async (data: RegisterSchemaType) => {
    setApiError(null);
    setApiSuccess(null);
    try {
      await authService.register(data.fullName, data.email, data.password, data.role);
      setApiSuccess("Account created! Redirecting to email verification...");

      setTimeout(() => {
        router.replace(`/verify-email?email=${encodeURIComponent(data.email)}`);
      }, 1200);

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("Registration failure:", errorMsg);

      if (isAxiosError(error) && error.response) {
        const responseData = error.response.data as { detail?: string };
        setApiError(responseData?.detail || "Registration failed. Please try again.");
      } else {
        setApiError("Registration failed. Please check your internet connection.");
      }
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-[#f8fafc] via-[#eef2ff] to-[#e0e7ff] dark:bg-gradient-to-b dark:from-[#1e143c] dark:via-[#170f2e] dark:to-[#120b24] text-foreground flex flex-col justify-between items-center py-10 px-4">
 
      {/* Background Design */}
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
          className="w-full max-w-[440px]"
        >
          <Card className="bg-slate-50/85 dark:bg-[#101e4a]/90 backdrop-blur-2xl border border-slate-200/80 dark:border-indigo-400/30 shadow-[0_10px_35px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(6,16,51,0.8)] rounded-2xl overflow-hidden p-1">
            <CardContent className="pt-8 pb-7 px-8 space-y-6">
 
              {/* Header */}
              <div className="flex flex-col items-center text-center space-y-4">
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-600 shadow-md shadow-indigo-500/25 ring-1 ring-white/20"
                >
                  <BrainCircuit className="h-6 w-6 text-white animate-pulse" />
                  <span className="absolute -inset-0.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 opacity-30 blur-sm -z-10" />
                </motion.div>
 
                <div className="space-y-1">
                  <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-display">
                    Create Account
                  </h1>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
                    QuizVerse AI Assessments
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

              {/* API Feedback */}
              {apiError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 font-medium flex items-start gap-2.5"
                >
                  <svg className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="flex-1">
                    <span>{apiError}</span>
                    {apiError.toLowerCase().includes("already") && (
                      <div className="mt-1">
                        <Link href="/login" className="underline font-semibold text-cyan-400 hover:text-cyan-300">
                          Click here to Sign In &rarr;
                        </Link>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {apiSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-medium flex items-start gap-2.5"
                >
                  <svg className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{apiSuccess}</span>
                </motion.div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

                {/* Full Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-slate-600 dark:text-slate-400 font-medium text-xs">
                    Full Name
                  </Label>
                  <div className="relative group">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400 dark:text-slate-500 group-focus-within:text-cyan-500 dark:group-focus-within:text-cyan-400 transition-colors duration-200" />
                    <Input
                      id="fullName"
                      type="text"
                      disabled={isSubmitting || !!apiSuccess}
                      placeholder="John Doe"
                      {...register("fullName")}
                      className={`pl-11 pr-4 h-11 w-full bg-slate-100/70 dark:bg-[#132356]/85 border border-slate-200 dark:border-indigo-400/30 rounded-xl hover:border-slate-300 dark:hover:border-indigo-400/50 focus:border-indigo-500 dark:focus:border-cyan-400 focus:bg-white dark:focus:bg-[#182b68] focus:ring-4 focus:ring-indigo-500/10 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-200 ${errors.fullName ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' : ''}`}
                    />
                  </div>
                  {errors.fullName && (
                    <p className="text-xs text-rose-400 font-medium pl-1">
                      {errors.fullName.message}
                    </p>
                  )}
                </div>
 
                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-slate-600 dark:text-slate-400 font-medium text-xs">
                    Email address
                  </Label>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400 dark:text-slate-500 group-focus-within:text-cyan-500 dark:group-focus-within:text-cyan-400 transition-colors duration-200" />
                    <Input
                      id="email"
                      type="email"
                      disabled={isSubmitting || !!apiSuccess}
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
 
                {/* Role Selection */}
                <div className="space-y-1.5">
                  <Label className="text-slate-600 dark:text-slate-400 font-medium text-xs">
                    Choose Your Role
                  </Label>
                  <div className="grid grid-cols-2 gap-3 p-1 rounded-xl bg-slate-200/60 dark:bg-[#0d1b46] border border-slate-200/80 dark:border-indigo-400/25">
                    <button
                      type="button"
                      disabled={isSubmitting || !!apiSuccess}
                      onClick={() => setValue("role", "student", { shouldValidate: true })}
                      className={`py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                        roleVal === "student"
                           ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-500/20"
                           : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      <span>Student</span>
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting || !!apiSuccess}
                      onClick={() => setValue("role", "teacher", { shouldValidate: true })}
                      className={`py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                        roleVal === "teacher"
                           ? "bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md shadow-indigo-500/20"
                           : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      <span>Teacher</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-1 leading-relaxed">
                    {roleVal === "teacher"
                      ? "✨ Create AI quizzes, run live lobbies & view classroom analytics."
                      : "📚 For self-paced assignments & tracking course history across terms."}
                  </p>
                  {errors.role && (
                    <p className="text-xs text-rose-400 font-medium pl-1">
                      {errors.role.message}
                    </p>
                  )}
                </div>
 
                {/* Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-slate-600 dark:text-slate-400 font-medium text-xs">
                    Password
                  </Label>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400 dark:text-slate-500 group-focus-within:text-cyan-500 dark:group-focus-within:text-cyan-400 transition-colors duration-200" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      disabled={isSubmitting || !!apiSuccess}
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
 
                  {/* Strength Meter */}
                  {passwordVal && (
                    <div className="space-y-1 pt-1">
                      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800/90 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-300 ${strength.color}`} />
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        <span>Password Strength:</span>
                        <span>{strength.label}</span>
                      </div>
                    </div>
                  )}
 
                  {errors.password && (
                    <p className="text-xs text-rose-400 font-medium pl-1 leading-normal">
                      {errors.password.message}
                    </p>
                  )}
                </div>
 
                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-slate-600 dark:text-slate-400 font-medium text-xs">
                    Confirm Password
                  </Label>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400 dark:text-slate-500 group-focus-within:text-cyan-500 dark:group-focus-within:text-cyan-400 transition-colors duration-200" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      disabled={isSubmitting || !!apiSuccess}
                      placeholder="••••••••"
                      {...register("confirmPassword")}
                      className={`pl-11 pr-11 h-11 w-full bg-slate-100/70 dark:bg-[#132356]/85 border border-slate-200 dark:border-indigo-400/30 rounded-xl hover:border-slate-300 dark:hover:border-indigo-400/50 focus:border-indigo-500 dark:focus:border-cyan-400 focus:bg-white dark:focus:bg-[#182b68] focus:ring-4 focus:ring-indigo-500/10 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-200 ${errors.confirmPassword ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400 hover:text-slate-200 focus:outline-none transition-colors cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-xs text-rose-400 font-medium pl-1">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>
 
                {/* Submit */}
                <motion.div
                  whileHover={!(isSubmitting || !!apiSuccess) ? { scale: 1.01 } : {}}
                  whileTap={!(isSubmitting || !!apiSuccess) ? { scale: 0.99 } : {}}
                  className="pt-2"
                >
                  <Button
                    type="submit"
                    disabled={isSubmitting || !!apiSuccess}
                    className="w-full h-11 font-semibold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600 hover:from-indigo-500 hover:via-indigo-400 hover:to-cyan-500 rounded-xl shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 cursor-pointer border-0 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Creating Account...</span>
                      </>
                    ) : (
                      "Sign Up"
                    )}
                  </Button>
                </motion.div>
              </form>
 
              {/* Redirect to Login */}
              <div className="pt-2 text-center text-sm text-slate-500 dark:text-slate-400">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 hover:underline inline-block py-1"
                >
                  Sign In
                </Link>
              </div>
 
            </CardContent>
          </Card>
        </motion.div>
      </div>
 
      <footer className="text-center text-xs text-slate-400 dark:text-slate-500 pt-6">
        &copy; 2026 QuizVerse AI. All rights reserved.
      </footer>
    </div>
  );
}
