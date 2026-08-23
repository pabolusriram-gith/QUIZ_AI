"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import { 
  Sparkles, 
  LineChart, 
  Shield, 
  ArrowRight, 
  ChevronDown, 
  BrainCircuit, 
  Sun, 
  Moon,
  PlayCircle
} from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [gamePin, setGamePin] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const faqs = [
    {
      question: "How does the AI Question Generator work?",
      answer: "QuizVerse AI parses your course topics, lecture notes, textbook text, or uploaded PDF slides to automatically create rigorous questions (MCQs, Multi-select, True/False, Fill-in-the-Blank, and Short Answer) with pedagogical rationales."
    },
    {
      question: "What anti-cheating guardrails are active during assessments?",
      answer: "QuizVerse AI features configurable fullscreen enforcement, tab-switching detection, and focus monitoring. Violations are logged in real-time so educators can review assessment integrity."
    },
    {
      question: "Can educators export marks and reports?",
      answer: "Yes, instructors can filter classroom submissions by topic, student, or timeframe and export detailed marksheets and grade distributions directly to CSV or print-ready PDF reports."
    },
    {
      question: "Is QuizVerse AI compatible with mobile devices and tablets?",
      answer: "Absolutely. The student test portal and educator dashboard are fully responsive, ultra-fast, and run in any modern web browser without requiring software downloads."
    }
  ];

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-[#f8fafc] via-[#eef2ff] to-[#e0e7ff] dark:from-[#09090f] dark:via-[#09090f] dark:to-[#0d0a14] text-slate-900 dark:text-slate-100 font-sans flex flex-col justify-between transition-colors duration-300">
      
      {/* --- Ambient Visual Background Layers --- */}
      <div className="pointer-events-none select-none absolute inset-0 overflow-hidden z-0" aria-hidden="true">
        {/* Layer 1: Dot Matrix Grid — violet tinted in dark */}
        <div className="absolute inset-0 bg-[radial-gradient(#818cf835_1.2px,transparent_1.2px)] dark:bg-[radial-gradient(rgba(139,92,246,0.12)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_80%_65%_at_50%_35%,#000_70%,transparent_100%)] opacity-70" />
        
        {/* Layer 2: Overhead Aurora Beam — rich violet-cyan in dark */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[500px] bg-gradient-to-b from-indigo-500/28 via-cyan-400/16 to-transparent dark:from-violet-600/35 dark:via-cyan-500/18 dark:to-transparent blur-[115px]" />

        {/* Layer 3: Floating Nebula Orbs — vivid in dark */}
        <div className="absolute -top-24 -left-16 h-[580px] w-[580px] rounded-full bg-gradient-to-tr from-indigo-600/30 via-blue-600/22 to-violet-500/20 dark:from-violet-700/35 dark:via-purple-700/22 dark:to-transparent blur-[135px] animate-nebula-1" />
        <div className="absolute -bottom-24 -right-16 h-[580px] w-[580px] rounded-full bg-gradient-to-bl from-cyan-400/25 via-sky-500/22 to-blue-600/20 dark:from-cyan-500/28 dark:via-sky-600/18 dark:to-transparent blur-[135px] animate-nebula-2" />
        
        {/* Layer 4: Center atmosphere */}
        <div className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 h-[650px] w-[650px] rounded-full bg-indigo-500/14 dark:bg-violet-900/12 blur-[160px]" />
      </div>

      {/* Top Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 dark:border-violet-500/10 bg-[#f8fafc]/85 dark:bg-[#09090f]/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-blue-500 via-indigo-500 to-cyan-400 border border-indigo-400/40 flex items-center justify-center text-white shadow-md shadow-indigo-500/30 group-hover:scale-105 transition-transform">
              <BrainCircuit className="h-4.5 w-4.5" />
            </div>
            <span className="text-base font-extrabold font-display tracking-tight text-slate-900 dark:text-white">
              QuizVerse <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-sky-300 bg-clip-text text-transparent">AI</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-xs font-bold text-slate-600 dark:text-slate-400">
            <a href="#features" className="hover:text-indigo-600 dark:hover:text-white transition-colors">Features</a>
            <a href="#workflow" className="hover:text-indigo-600 dark:hover:text-white transition-colors">How it Works</a>
            <a href="#faq" className="hover:text-indigo-600 dark:hover:text-white transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            {mounted && (
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-600" />}
              </button>
            )}

            <Link
              href="/login"
              className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors px-2 py-1"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm shadow-indigo-600/20 transition-all cursor-pointer"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-16 pb-20 flex flex-col items-center space-y-20">
        
        {/* Header Content */}
        <div className="text-center space-y-6 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Next-Generation Educational Assessment Platform</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold font-display tracking-tight text-slate-900 dark:text-white leading-[1.15]">
            Transform Learning with <br />
            <span className="bg-gradient-to-r from-indigo-600 via-cyan-600 to-indigo-600 dark:from-indigo-400 dark:via-cyan-400 dark:to-indigo-300 bg-clip-text text-transparent">
              Intelligent Assessments
            </span>
          </h1>

          <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 max-w-xl mx-auto leading-relaxed font-medium">
            Design comprehensive quizzes in seconds, conduct secure live proctored sessions, and track classroom mastery with precision telemetry.
          </p>

          {/* Quick PIN Join & Host Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 w-full max-w-md mx-auto">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (gamePin.trim()) {
                  router.push(`/join?pin=${encodeURIComponent(gamePin.trim())}`);
                }
              }}
              className="flex items-center gap-2 bg-white dark:bg-[#0d1633] border border-slate-200 dark:border-indigo-400/25 rounded-2xl p-1.5 shadow-sm focus-within:border-indigo-400 transition-all w-full"
            >
              <input
                type="text"
                value={gamePin}
                onChange={(e) => setGamePin(e.target.value.toUpperCase())}
                placeholder="Enter Quiz PIN"
                className="bg-transparent border-0 ring-0 focus:outline-none text-slate-900 dark:text-white placeholder-slate-400 font-mono font-bold tracking-wider text-center text-xs h-9 uppercase w-full"
              />
              <button 
                type="submit" 
                className="px-4 h-9 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-500/25 cursor-pointer border-none transition-all flex items-center gap-1 shrink-0"
              >
                <span>Submit</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </form>
            <Link href="/dashboard" className="shrink-0 w-full sm:w-auto group">
              <button className="w-full sm:w-auto px-6 h-12 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:via-indigo-400 hover:to-cyan-400 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 shadow-[0_4px_22px_rgba(99,102,241,0.45)] hover:shadow-[0_6px_30px_rgba(99,102,241,0.65)] border border-indigo-300/40 hover:border-indigo-200/60 active:scale-[0.98]">
                <PlayCircle className="h-4.5 w-4.5 text-cyan-200 group-hover:text-white transition-colors" />
                <span className="tracking-wide">Host a Quiz</span>
              </button>
            </Link>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div id="features" className="w-full space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-display tracking-tight">
              Engineered for Modern Classrooms
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto font-medium">
              Everything educators need to compose, deliver, and evaluate student understanding.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-panel dark-card-hover border-slate-200 dark:border-violet-500/14 rounded-3xl p-6 flex flex-col justify-between space-y-4 shadow-sm hover:border-indigo-500/40 dark:hover:border-violet-400/30 transition-colors">
              <div className="space-y-3.5">
                <div className="h-11 w-11 rounded-2xl bg-indigo-500/10 dark:bg-violet-500/10 border border-indigo-500/20 dark:border-violet-500/25 flex items-center justify-center text-indigo-600 dark:text-violet-400">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display uppercase tracking-wider">
                    AI Question Generator
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                    Auto-generate diverse questions from lecture notes, syllabi, or uploaded documents with Bloom&apos;s cognitive calibrations.
                  </p>
                </div>
              </div>
              <div className="h-1 w-12 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500" />
            </div>

            <div className="glass-panel dark-card-hover border-slate-200 dark:border-cyan-500/14 rounded-3xl p-6 flex flex-col justify-between space-y-4 shadow-sm hover:border-cyan-500/40 dark:hover:border-cyan-400/30 transition-colors">
              <div className="space-y-3.5">
                <div className="h-11 w-11 rounded-2xl bg-cyan-500/10 dark:bg-cyan-500/10 border border-cyan-500/20 dark:border-cyan-500/25 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display uppercase tracking-wider">
                    Anti-Cheat Proctoring
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                    Maintain exam integrity with automated tab-switch logs, exit alerts, and fullscreen compliance monitoring.
                  </p>
                </div>
              </div>
              <div className="h-1 w-12 rounded-full bg-gradient-to-r from-cyan-500 to-sky-400" />
            </div>

            <div className="glass-panel dark-card-hover border-slate-200 dark:border-emerald-500/14 rounded-3xl p-6 flex flex-col justify-between space-y-4 shadow-sm hover:border-emerald-500/40 dark:hover:border-emerald-400/30 transition-colors">
              <div className="space-y-3.5">
                <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/20 dark:border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <LineChart className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display uppercase tracking-wider">
                    Deep Learning Analytics
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                    Identify topic weaknesses, review question difficulty accuracy, and export grading spreadsheets with a single click.
                  </p>
                </div>
              </div>
              <div className="h-1 w-12 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" />
            </div>
          </div>
        </div>

        {/* 3-Step Lifecycle Workflow */}
        <div id="workflow" className="w-full space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-display tracking-tight">
              Simple 3-Step Workflow
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto font-medium">
              From draft creation to completed student marksheets in minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Draft or AI Generate",
                desc: "Compose questions manually or prompt our multi-model AI engine to formulate questions from any topic.",
                accent: "from-violet-500 to-indigo-500",
              },
              {
                step: "02",
                title: "Conduct Secure Tests",
                desc: "Share your unique Quiz PIN with participants. Students join instantly on desktop or mobile.",
                accent: "from-cyan-500 to-sky-400",
              },
              {
                step: "03",
                title: "Analyze & Export",
                desc: "Review automated grading, individual student answer breakdowns, and export reports for academic records.",
                accent: "from-emerald-500 to-teal-400",
              },
            ].map((s) => (
              <div
                key={s.step}
                className="glass-panel dark-card-hover border-slate-200 dark:border-violet-500/14 rounded-3xl p-6 space-y-4 shadow-sm relative overflow-hidden"
              >
                <span className="text-4xl font-extrabold text-slate-200 dark:text-white/5 font-display absolute top-4 right-5 select-none pointer-events-none">
                  {s.step}
                </span>
                <div className={`h-8 w-8 rounded-xl bg-gradient-to-br ${s.accent} bg-opacity-10 border border-violet-500/20 dark:border-violet-500/20 flex items-center justify-center text-white font-bold text-xs shadow-sm`} style={{background: 'rgba(124,58,237,0.15)'}}>
                  <span className="bg-gradient-to-br from-violet-400 to-cyan-400 bg-clip-text text-transparent font-extrabold">{s.step}</span>
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">{s.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{s.desc}</p>
                </div>
                <div className={`h-0.5 w-10 rounded-full bg-gradient-to-r ${s.accent}`} />
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Accordion */}
        <div id="faq" className="w-full max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-display tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Clear answers to help you get started quickly.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div
                  key={idx}
                  className="glass-panel border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-all shadow-xs"
                >
                  <button 
                    onClick={() => toggleFaq(idx)} 
                    className="w-full px-5 py-4 flex items-center justify-between text-left text-xs font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer select-none"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "rotate-180 text-indigo-600" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200 dark:border-slate-800 pt-3 transition-all duration-200">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA Card */}
        <div className="w-full">
          <div className="relative overflow-hidden glass-panel-glow border-slate-200 dark:border-violet-500/25 rounded-3xl p-8 md:p-12 text-center space-y-5 shadow-sm">
            {/* CTA ambient glow (dark only) */}
            <div className="absolute inset-0 dark:bg-gradient-to-br dark:from-violet-900/20 dark:via-transparent dark:to-cyan-900/15 pointer-events-none" />
            <h2 className="relative text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-display tracking-tight">
              Ready to Upgrade Your Classroom Tests?
            </h2>
            <p className="relative text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed font-medium">
              Join educators worldwide delivering AI-assisted, proctored assessments with QuizVerse AI.
            </p>
            <div className="relative pt-2 flex justify-center">
              <Link href="/dashboard">
                <button className="px-7 h-11 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 dark:from-violet-500 dark:via-indigo-500 dark:to-cyan-500 hover:from-violet-500 hover:via-indigo-500 hover:to-cyan-400 text-white font-bold text-xs shadow-md shadow-indigo-600/20 dark:shadow-violet-600/30 cursor-pointer transition-all flex items-center gap-1.5 dark:shadow-[0_4px_20px_rgba(124,58,237,0.4)] hover:dark:shadow-[0_6px_28px_rgba(124,58,237,0.6)]">
                  <span>Open Workspace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </Link>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200/80 dark:border-violet-500/10 bg-[#eef2f7]/70 dark:bg-[#09090f]">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span className="font-bold text-slate-900 dark:text-white">QuizVerse AI</span>
            <span>&copy; 2026. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-slate-900 dark:hover:text-white transition-colors">Features</a>
            <a href="#workflow" className="hover:text-slate-900 dark:hover:text-white transition-colors">Workflow</a>
            <a href="#faq" className="hover:text-slate-900 dark:hover:text-white transition-colors">FAQ</a>
            <Link href="/login" className="hover:text-slate-900 dark:hover:text-white transition-colors">Sign In</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
