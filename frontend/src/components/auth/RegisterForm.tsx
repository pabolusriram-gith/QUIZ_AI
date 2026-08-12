"use client";

import { useState } from "react";
import { isAxiosError } from "axios";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { authService } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { BrainCircuit, Eye, EyeOff, Lock, Mail, User } from "lucide-react";

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
      setApiSuccess("Account created successfully! Redirecting to login...");

      setTimeout(() => {
        router.replace("/login");
      }, 2000);

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
    <div className="relative min-h-screen w-full overflow-hidden bg-[#030712] text-slate-100 flex flex-col justify-between items-center py-10 px-4">

      {/* Background Design */}
      <div
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-85 pointer-events-none"
        aria-hidden="true"
      />

      {/* Glowing backdrop elements */}
      <div className="absolute inset-0 -z-20 overflow-hidden pointer-events-none" aria-hidden="true">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            x: [0, 40, 0],
            y: [0, -30, 0],
          }}
          transition={{
            duration: 14,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -top-12 -left-12 h-[450px] w-[450px] rounded-full bg-indigo-950/20 blur-[110px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            x: [0, -30, 0],
            y: [0, 40, 0],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -bottom-16 -right-16 h-[450px] w-[450px] rounded-full bg-cyan-950/20 blur-[110px]"
        />
      </div>

      <div className="flex-1 flex items-center justify-center w-full z-10">

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[440px]"
        >
          <Card className="glass-panel border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.4)] rounded-2xl overflow-hidden p-1">
            <CardContent className="pt-8 pb-7 px-8 space-y-6">

              {/* Header */}
              <div className="flex flex-col items-center text-center space-y-4">
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-md shadow-indigo-500/20"
                >
                  <BrainCircuit className="h-6 w-6 text-white animate-pulse" />
                  <span className="absolute -inset-0.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 opacity-30 blur-sm -z-10" />
                </motion.div>

                <div className="space-y-1">
                  <h1 className="text-2xl font-extrabold tracking-tight text-white font-display">
                    Create Account
                  </h1>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">
                    QuizVerse AI Assessments
                  </p>
                </div>
              </div>

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
                  <span>{apiError}</span>
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
                  <Label htmlFor="fullName" className="text-slate-300 font-medium text-xs">
                    Full Name
                  </Label>
                  <div className="relative group">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-500 group-focus-within:text-cyan-400 transition-colors duration-200" />
                    <Input
                      id="fullName"
                      type="text"
                      disabled={isSubmitting || !!apiSuccess}
                      placeholder="John Doe"
                      {...register("fullName")}
                      className={`pl-11 pr-4 h-11 w-full bg-white/4 border-white/10 rounded-xl hover:border-white/20 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-[#070b16] text-white transition-all duration-200 ${errors.fullName ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' : ''}`}
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
                  <Label htmlFor="email" className="text-slate-300 font-medium text-xs">
                    Email address
                  </Label>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-500 group-focus-within:text-cyan-400 transition-colors duration-200" />
                    <Input
                      id="email"
                      type="email"
                      disabled={isSubmitting || !!apiSuccess}
                      placeholder="name@example.com"
                      {...register("email")}
                      className={`pl-11 pr-4 h-11 w-full bg-white/4 border-white/10 rounded-xl hover:border-white/20 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-[#070b16] text-white transition-all duration-200 ${errors.email ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' : ''}`}
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
                  <Label className="text-slate-300 font-medium text-xs">
                    Choose Your Role
                  </Label>
                  <div className="grid grid-cols-2 gap-3 p-1 rounded-xl bg-white/3 border border-white/5">
                    <button
                      type="button"
                      disabled={isSubmitting || !!apiSuccess}
                      onClick={() => setValue("role", "student", { shouldValidate: true })}
                      className={`py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                        roleVal === "student"
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-500/15"
                          : "text-slate-400 hover:text-slate-200"
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
                          ? "bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md shadow-indigo-500/15"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <span>Teacher</span>
                    </button>
                  </div>
                  {errors.role && (
                    <p className="text-xs text-rose-400 font-medium pl-1">
                      {errors.role.message}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-slate-300 font-medium text-xs">
                    Password
                  </Label>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-500 group-focus-within:text-cyan-400 transition-colors duration-200" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      disabled={isSubmitting || !!apiSuccess}
                      placeholder="••••••••"
                      {...register("password")}
                      className={`pl-11 pr-11 h-11 w-full bg-white/4 border-white/10 rounded-xl hover:border-white/20 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-[#070b16] text-white transition-all duration-200 ${errors.password ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400 hover:text-slate-200 focus:outline-none transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Strength Meter */}
                  {passwordVal && (
                    <div className="space-y-1 pt-1">
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-300 ${strength.color}`} />
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400">
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
                  <Label htmlFor="confirmPassword" className="text-slate-300 font-medium text-xs">
                    Confirm Password
                  </Label>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-500 group-focus-within:text-cyan-400 transition-colors duration-200" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      disabled={isSubmitting || !!apiSuccess}
                      placeholder="••••••••"
                      {...register("confirmPassword")}
                      className={`pl-11 pr-11 h-11 w-full bg-white/4 border-white/10 rounded-xl hover:border-white/20 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-[#070b16] text-white transition-all duration-200 ${errors.confirmPassword ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' : ''}`}
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
                    className="w-full h-11 font-semibold text-white bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 rounded-xl shadow-md shadow-indigo-500/25 cursor-pointer border-0 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              <div className="pt-2 text-center text-sm text-slate-400">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="font-semibold text-cyan-400 hover:text-cyan-300 hover:underline focus:outline-none cursor-pointer"
                >
                  Sign In
                </button>
              </div>

            </CardContent>
          </Card>
        </motion.div>
      </div>

      <footer className="text-center text-xs text-slate-500 pt-6">
        &copy; 2026 QuizVerse AI. All rights reserved.
      </footer>
    </div>
  );
}
