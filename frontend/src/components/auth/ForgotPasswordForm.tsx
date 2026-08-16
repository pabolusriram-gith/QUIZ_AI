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
import { BrainCircuit, Mail, ArrowLeft } from "lucide-react";

// Zod Validation Schema
const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Email address is required").email("Please enter a valid email."),
});

type ForgotPasswordSchemaType = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordForm() {
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiSuccess, setApiSuccess] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  
  const router = useRouter();

  // React Hook Form initialization with custom zero-dependency Zod resolver
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordSchemaType>({
    mode: "onChange",
    defaultValues: {
      email: "",
    },
    resolver: async (values) => {
      try {
        const data = forgotPasswordSchema.parse(values);
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

  const onSubmit = async (data: ForgotPasswordSchemaType) => {
    setApiError(null);
    setApiSuccess(null);
    setDevResetUrl(null);
    try {
      const response = await authService.forgotPassword(data.email);
      setApiSuccess(response.message || "A password reset email has been sent.");
      
      // If backend returns a dev reset URL (when running locally without SMTP setup)
      if (response.dev_reset_url) {
        setDevResetUrl(response.dev_reset_url);
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("Forgot password failure:", errorMsg);
      
      if (isAxiosError(error) && error.response) {
        const responseData = error.response.data as { detail?: string };
        setApiError(responseData?.detail || "An unexpected error occurred. Please try again.");
      } else {
        setApiError("Could not connect to the authentication server.");
      }
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground flex flex-col justify-between items-center py-10 px-4">
      
      {/* Background Design */}
      <div 
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(0,0,0,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.015)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-85 pointer-events-none" 
        aria-hidden="true"
      />
 
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
          className="absolute -top-12 -left-12 h-[450px] w-[450px] rounded-full bg-indigo-500/5 dark:bg-indigo-950/20 blur-[110px]"
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
          className="absolute -bottom-16 -right-16 h-[450px] w-[450px] rounded-full bg-cyan-500/5 dark:bg-cyan-950/20 blur-[110px]"
        />
      </div>
 
      <div className="flex-1 flex items-center justify-center w-full z-10">
        
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[440px]"
        >
          <Card className="glass-panel border-border shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] rounded-2xl overflow-hidden p-1">
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
                  <h1 className="text-2xl font-extrabold tracking-tight text-foreground font-display">
                    Forgot Password
                  </h1>
                  <p className="text-xs text-muted-foreground max-w-[320px]">
                    Enter your email address and we will generate a secure reset link.
                  </p>
                </div>
              </div>

              {/* Feedback messages */}
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
                  className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-medium flex items-start gap-2.5 flex-col"
                >
                  <div className="flex items-start gap-2.5">
                    <svg className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{apiSuccess}</span>
                  </div>
                  
                  {/* Development Mode Helper Link */}
                  {devResetUrl && (
                    <div className="mt-3 p-3 bg-black/5 dark:bg-white/3 border border-emerald-500/20 rounded-lg text-left w-full space-y-1">
                      <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                        Development Reset Link:
                      </p>
                      <a 
                        href={devResetUrl}
                        className="text-xs text-cyan-600 dark:text-cyan-400 font-semibold underline hover:text-cyan-500 dark:hover:text-cyan-300 break-all"
                      >
                        {devResetUrl}
                      </a>
                      <p className="text-[9px] text-muted-foreground font-normal">
                        Click this link to perform a local password reset bypass test.
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
 
              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                
                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-muted-foreground font-medium text-xs">
                    Email address
                  </Label>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-500 group-focus-within:text-cyan-500 dark:group-focus-within:text-cyan-400 transition-colors duration-200" />
                    <Input
                      id="email"
                      type="email"
                      disabled={isSubmitting || !!apiSuccess}
                      placeholder="name@example.com"
                      {...register("email")}
                      className={`pl-11 pr-4 h-11 w-full bg-slate-50 dark:bg-white/4 border-border rounded-xl hover:border-slate-300 dark:hover:border-white/20 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-background focus:ring-primary/10 text-foreground transition-all duration-200 ${errors.email ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' : ''}`}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-xs text-rose-400 font-medium pl-1">
                      {errors.email.message}
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
                        <span>Sending reset link...</span>
                      </>
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>
                </motion.div>
              </form>
 
              {/* Back to Login */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 hover:underline focus:outline-none cursor-pointer"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to Sign In
                </button>
              </div>
 
            </CardContent>
          </Card>
        </motion.div>
      </div>
 
      <footer className="text-center text-xs text-muted-foreground pt-6">
        &copy; 2026 QuizVerse AI. All rights reserved.
      </footer>
    </div>
  );
}
