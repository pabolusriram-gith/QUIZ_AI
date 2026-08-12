"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Sparkles, 
  Check,
  Trophy,
  Users,
  LineChart,
  Monitor,
  FileText,
  Shield,
  Zap,
  ArrowRight,
  HelpCircle,
  ChevronDown,
  BrainCircuit,
  PieChart,
  Activity,
  Layers,
  GraduationCap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const router = useRouter();
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [gamePin, setGamePin] = useState("");

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const faqs = [
    {
      question: "How does the AI Question Generator work?",
      answer: "Our AI model analyses your study guides, textbook content, PDFs, or slides to instantly extract key concepts and construct high-fidelity MCQs, true/false, fill-in-the-blanks, or short answers, complete with explanations."
    },
    {
      question: "What anti-cheating guardrails are active?",
      answer: "QuizVerse AI utilizes advanced tab-switching detection, copy-paste disabling, and fullscreen exit monitors. Proctors receive automatic logs of any violations to maintain test integrity."
    },
    {
      question: "Can we export reports for grading?",
      answer: "Yes, you can easily filter classroom metrics by subject, student, or date range and export them directly to PDF printouts or Excel CSV spreadsheets with one click."
    },
    {
      question: "Is the platform mobile responsive?",
      answer: "Absolutely! The student attempt portal is fully responsive, lightweight, and works seamlessly across desktops, tablets, and smartphones without requiring any app installations."
    }
  ];

  return (
    <div className="relative min-h-screen bg-[#02050c] text-slate-100 overflow-x-hidden font-sans flex flex-col justify-between">
      
      {/* Background grid and glowing lighting */}
      <div 
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] opacity-70 pointer-events-none z-0" 
        aria-hidden="true"
      />

      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden="true">
        <div className="absolute top-[10%] left-[10%] h-[600px] w-[600px] rounded-full bg-indigo-500/5 blur-[150px] animate-pulse" />
        <div className="absolute top-[20%] right-[10%] h-[600px] w-[600px] rounded-full bg-cyan-500/5 blur-[150px] animate-pulse" />
        <div className="absolute bottom-[20%] left-[20%] h-[500px] w-[500px] rounded-full bg-purple-500/5 blur-[130px]" />
      </div>

      {/* Sticky Header Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#02050c]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <BrainCircuit className="h-6 w-6 text-indigo-400 group-hover:text-cyan-400 transition-colors" />
            <span className="text-base font-extrabold font-display text-white tracking-tight">QuizVerse <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">AI</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#ai-tech" className="hover:text-white transition-colors">AI Tech</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">Workflow</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-xs font-bold text-slate-400 hover:text-white transition-colors">Sign In</Link>
            <Link href="/dashboard" className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/10 transition-all cursor-pointer">
              Host a Quiz
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-16 pb-20 flex flex-col items-center space-y-24">
        
        {/* Top Header Badge */}
        <div className="text-center space-y-6 max-w-3xl">
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/20 border border-cyan-500/20 text-cyan-300 text-xs font-semibold"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Powered by Gemini, Groq & OpenAI LLMs</span>
          </motion.div>

          <h1 className="text-4xl sm:text-6xl font-extrabold font-display tracking-tight text-white leading-[1.1] pt-2">
            Transform Learning with <br />
            <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-purple-500 bg-clip-text text-transparent">AI-Generated Quizzes</span>
          </h1>

          <p className="text-sm md:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
            The next-generation live quiz platform for educators, enterprises, and presenters. Instantly generate quizzes using Gemini, Groq, and OpenAI with secure proctored telemetry.
          </p>

          {/* Centered CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2 w-full max-w-md mx-auto">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (gamePin.trim()) {
                  router.push(`/join?pin=${encodeURIComponent(gamePin.trim())}`);
                }
              }}
              className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-1.5 focus-within:border-cyan-500/50 transition-all w-full"
            >
              <input
                type="text"
                value={gamePin}
                onChange={(e) => setGamePin(e.target.value.toUpperCase())}
                placeholder="Enter Game PIN"
                className="bg-transparent border-0 ring-0 focus:outline-none text-white placeholder-slate-500 font-bold tracking-wider text-center text-xs h-9 uppercase w-full"
              />
              <button 
                type="submit" 
                className="px-4 h-9 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-cyan-600/10 cursor-pointer border-none transition-all flex items-center gap-1 shrink-0"
              >
                Enter Game PIN
              </button>
            </form>
            <Link href="/dashboard" className="shrink-0 w-full sm:w-auto">
              <button className="w-full px-6 h-12 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-white font-semibold text-xs flex items-center justify-center cursor-pointer transition-all">
                Host a Quiz
              </button>
            </Link>
          </div>
        </div>

        {/* Laptop & Phone Mockups */}
        <div className="relative w-full max-w-[860px] h-[340px] md:h-[420px] flex items-center justify-center pt-4">
          <div className="absolute top-[42%] left-[45%] w-[16%] h-0.5 border-t border-dashed border-cyan-500/20 z-0 pointer-events-none hidden md:block" />
          <div className="absolute top-[42%] left-[53%] w-2 h-2 rounded-full bg-cyan-400 animate-ping z-10" />

          {/* Left Laptop Mockup */}
          <motion.div
            initial={{ opacity: 0, x: -30, rotate: -2 }}
            animate={{ opacity: 1, x: 0, rotate: -4 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute left-0 top-6 w-[56%] bg-[#080d19]/90 border border-white/8 rounded-2xl p-4 shadow-[0_25px_60px_rgba(0,0,0,0.8)] z-10 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <div className="flex items-center gap-1.5">
                <BrainCircuit className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-[9px] font-extrabold text-white">QuizVerse AI</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[7px] text-slate-500 font-mono">Telemetry Control</span>
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              </div>
            </div>

            <div className="space-y-3 pt-0.5">
              <div className="flex justify-between items-center text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Multi-Model AI Status</span>
                <span className="text-cyan-400">All Systems Normal</span>
              </div>

              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-7 space-y-2">
                  <div className="flex items-center gap-2 p-1.5 rounded-lg bg-white/2 border border-white/5">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span className="text-[8px] font-semibold text-slate-300">Google Gemini</span>
                    <span className="text-[7px] text-slate-500 ml-auto">Active</span>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 rounded-lg bg-white/2 border border-white/5">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <span className="text-[8px] font-semibold text-slate-300">Groq Llama 3</span>
                    <span className="text-[7px] text-slate-500 ml-auto">Active</span>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 rounded-lg bg-white/2 border border-white/5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[8px] font-semibold text-slate-300">OpenAI GPT</span>
                    <span className="text-[7px] text-slate-500 ml-auto">Active</span>
                  </div>
                </div>

                <div className="col-span-5 pl-2 space-y-1.5">
                  <div className="p-2 rounded-lg bg-white/2 border border-white/5 text-center">
                    <div className="text-sm font-black text-cyan-400 font-display">12,482</div>
                    <div className="text-[7px] text-slate-500 font-bold uppercase tracking-wider">Total Quizzes</div>
                  </div>
                  <div className="p-1.5 rounded-lg bg-white/2 border border-white/5 flex items-center justify-between text-[7px] font-bold text-emerald-400">
                    <span>Proctor Status</span>
                    <span>Secure</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Phone Mockup */}
          <motion.div
            initial={{ opacity: 0, x: 30, rotate: 2 }}
            animate={{ opacity: 1, x: 0, rotate: 4 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
            className="absolute right-0 top-12 w-[34%] bg-[#040813]/98 border border-cyan-500/20 rounded-3xl p-4 shadow-[0_25px_60px_rgba(0,0,0,0.85)] z-20 space-y-3"
          >
            <div className="mx-auto w-12 h-2.5 bg-slate-900 rounded-full border border-white/5" />

            <div className="space-y-2.5 pt-0.5">
              <span className="text-[7px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                Attempt Portal
              </span>
              <p className="text-[9px] font-semibold text-slate-200">
                Which data structure operates on a First-In, First-Out (FIFO) basis?
              </p>

              <div className="space-y-1 pt-0.5">
                <div className="p-2 text-[7px] bg-white/3 rounded-lg border border-white/5 text-slate-400">
                  Stack (LIFO)
                </div>
                <div className="p-2 text-[7px] bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-300 font-semibold flex items-center justify-between">
                  <span>Queue (FIFO)</span>
                  <Check className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
                </div>
                <div className="p-2 text-[7px] bg-white/3 rounded-lg border border-white/5 text-slate-400">
                  Binary Tree
                </div>
              </div>
            </div>
          </motion.div>

          {/* Floaters */}
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute right-[-10px] top-[26%] h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 border border-white/10 flex items-center justify-center text-white shadow-lg z-30"
          >
            <Trophy className="h-4 w-4" />
          </motion.div>

          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute right-[-15px] top-[46%] h-8 w-8 rounded-xl bg-[#090f1e]/90 border border-white/5 flex items-center justify-center text-cyan-400 shadow-lg z-30"
          >
            <Users className="h-4 w-4" />
          </motion.div>
        </div>

        {/* Feature Grid */}
        <div id="features" className="w-full pt-12 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display tracking-tight">AI-Powered Live Assessment Workspace</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">Create, secure, and evaluate assessments utilizing robust multi-model AI integrations.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { 
                title: "Multi-Model AI Generation", 
                desc: "Draft high-quality quizzes instantly using Google Gemini, Groq, or OpenAI API models calibrated to course outcomes.", 
                icon: <Sparkles className="h-5 w-5 text-purple-400" />, 
                color: "from-purple-500/20 to-purple-500/5", 
                border: "hover:border-purple-500/30",
                accentLine: "bg-gradient-to-r from-purple-500 to-pink-500 shadow-[0_1px_8px_rgba(168,85,247,0.5)]"
              },
              { 
                title: "Secure Anti-Cheat Proctoring", 
                desc: "Host secure assessments with tab-switching detection, focus monitors, and secure exam workspaces.", 
                icon: <Monitor className="h-5 w-5 text-cyan-400" />, 
                color: "from-cyan-500/20 to-cyan-500/5", 
                border: "hover:border-cyan-500/30",
                accentLine: "bg-gradient-to-r from-cyan-500 to-blue-500 shadow-[0_1px_8px_rgba(6,182,212,0.5)]"
              },
              { 
                title: "Smart Analytics & Export", 
                desc: "Track classroom performance, detect learning gaps, and export reports directly to PDF or Excel CSV sheets.", 
                icon: <LineChart className="h-5 w-5 text-emerald-400" />, 
                color: "from-emerald-500/20 to-emerald-500/5", 
                border: "hover:border-emerald-500/30",
                accentLine: "bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_1px_8px_rgba(16,185,129,0.5)]"
              },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                whileHover={{ y: -4 }}
                className={`glass-panel border-white/5 rounded-2xl p-6 flex flex-col justify-between h-64 transition-all relative overflow-hidden group ${f.border}`}
              >
                <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${f.color} rounded-full blur-2xl pointer-events-none`} />
                <div className="space-y-4">
                  <div className="h-12 w-12 rounded-2xl bg-white/3 border border-white/8 flex items-center justify-center">
                    {f.icon}
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-bold text-white font-display uppercase tracking-wider">{f.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
                <div className={`h-1 rounded-full w-full ${f.accentLine}`} />
              </motion.div>
            ))}
          </div>
        </div>

        {/* AI Tech Section */}
        <div id="ai-tech" className="w-full pt-8 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/20 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-wider">
              <Zap className="h-3 w-3" /> State of the Art LLMs
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display tracking-tight leading-tight">
              Instant Question Drafting Powered by Generative AI
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tired of spending hours writing test sheets? Upload raw text, select your target cognitive Bloom level, choose question counts, and generate formatted test scripts within seconds.
            </p>
            <div className="space-y-3.5">
              {[
                "Supports PDF, raw text, and curriculum files",
                "Applies cognitive filters (Bloom's Taxonomy)",
                "Full inline edit controls before deploying"
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="h-4 w-4 rounded-full bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center shrink-0">
                    <Check className="h-2.5 w-2.5 text-indigo-400" />
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel border-white/5 rounded-2xl p-6 relative overflow-hidden space-y-4">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              <span>Generator Output Preview</span>
              <span className="text-indigo-400">Gemini LLM</span>
            </div>
            <div className="bg-white/2 border border-white/5 rounded-xl p-4 space-y-3">
              <span className="text-[9px] font-extrabold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">QUESTION 01</span>
              <p className="text-xs font-semibold text-white leading-relaxed">
                Which database abstraction allows async connections in Python?
              </p>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-2 bg-white/4 rounded border border-white/5 text-slate-400">PeeWee</div>
                <div className="p-2 bg-indigo-500/10 rounded border border-indigo-500/20 text-indigo-300 font-medium">SQLAlchemy Async</div>
              </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-indigo-500/30 via-cyan-500/30 to-white/5 rounded-full" />
          </div>
        </div>

        {/* How It Works Workflow */}
        <div id="how-it-works" className="w-full pt-12 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display tracking-tight">The 3-Step Lifecycle</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">QuizVerse AI handles the heavy lifting from setup to final marksheet export.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {[
              { step: "01", title: "Create or AI-Generate", desc: "Design quizzes manually or let our AI parse text/PDF content to draft questions instantly." },
              { step: "02", title: "Proctored Attempt", desc: "Share secure pin codes with students. The attempt dashboard locks down tabs and exit states." },
              { step: "03", title: "Export Reports", desc: "Access classroom averages, identify learning gaps, and export spreadsheets in one click." }
            ].map((s, i) => (
              <div key={s.step} className="glass-panel border-white/5 rounded-2xl p-6 space-y-4 relative">
                <span className="text-3xl font-black text-indigo-500/20 font-display absolute top-4 right-4">{s.step}</span>
                <div className="h-8 w-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs">
                  {i + 1}
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white font-display">{s.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Statistic board */}
        <div className="w-full pt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { value: "10,000+", label: "Concurrent Participants", icon: <Users className="h-4 w-4 text-indigo-400" /> },
            { value: "99.9%", label: "Realtime Sync Uptime", icon: <Activity className="h-4 w-4 text-cyan-400" /> },
            { value: "50,000+", label: "AI Questions Generated", icon: <Sparkles className="h-4 w-4 text-purple-400" /> },
            { value: "1M+", label: "Submissions Graded", icon: <GraduationCap className="h-4 w-4 text-emerald-400" /> }
          ].map((stat) => (
            <div key={stat.label} className="glass-panel rounded-xl p-5 text-center space-y-2 border-white/5">
              <div className="h-8 w-8 mx-auto rounded-full bg-white/5 border border-white/5 flex items-center justify-center">{stat.icon}</div>
              <p className="text-2xl font-black text-white font-display tracking-tight">{stat.value}</p>
              <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* FAQ Accordion */}
        <div id="faq" className="w-full pt-12 max-w-3xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display tracking-tight">Frequently Asked Questions</h2>
            <p className="text-xs text-slate-400">Got questions? We have quick answers below.</p>
          </div>

          <div className="space-y-3.5">
            {faqs.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div key={idx} className="glass-panel border-white/5 rounded-2xl overflow-hidden transition-all duration-200">
                  <button 
                    onClick={() => toggleFaq(idx)} 
                    className="w-full px-5 py-4 flex items-center justify-between text-left text-xs font-bold text-white hover:text-indigo-400 transition-colors cursor-pointer select-none"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? "rotate-180 text-indigo-400" : ""}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }} 
                        animate={{ height: "auto", opacity: 1 }} 
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <p className="px-5 pb-4 text-xs text-slate-400 leading-relaxed border-t border-white/5 pt-3">
                          {faq.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        {/* Call To Action Block */}
        <div className="w-full pt-12 relative">
          <div className="glass-panel border-white/5 rounded-3xl p-8 md:p-12 text-center space-y-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none" />
            <h2 className="text-3xl md:text-4xl font-extrabold text-white font-display tracking-tight">Ready to Elevate Learning?</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Integrate AI question generators, implement proctored constraints, and gather full student grading matrices inside one workspace today.
            </p>
            <div className="pt-2 flex justify-center">
              <Link href="/dashboard">
                <button className="px-8 h-12 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs shadow-xl cursor-pointer transition-all flex items-center gap-1.5 hover:scale-[1.02]">
                  Launch Workspace Free <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
            </div>
          </div>
        </div>

      </main>

      {/* Footer Section */}
      <footer className="w-full border-t border-white/5 bg-[#03060d]">
        <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-xs text-slate-500">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-indigo-400" />
              <span className="text-sm font-bold text-white font-display">QuizVerse AI</span>
            </Link>
            <p className="text-[10px] leading-relaxed text-slate-500">
              Transforming live engagement, class assessments, and student progress reports with state of the art generative AI telemetry.
            </p>
          </div>
          <div className="space-y-3 font-semibold">
            <span className="text-white uppercase tracking-wider text-[9px] font-bold">Solutions</span>
            <ul className="space-y-2">
              <li><a href="#features" className="hover:text-white transition-colors">Question Bank</a></li>
              <li><a href="#ai-tech" className="hover:text-white transition-colors">AI Generator</a></li>
              <li><a href="#features" className="hover:text-white transition-colors">Anti-Cheat Proctor</a></li>
            </ul>
          </div>
          <div className="space-y-3 font-semibold">
            <span className="text-white uppercase tracking-wider text-[9px] font-bold">Resources</span>
            <ul className="space-y-2">
              <li><a href="#faq" className="hover:text-white transition-colors">FAQs Documentation</a></li>
              <li><a href="#" className="hover:text-white transition-colors">API References</a></li>
              <li><a href="#" className="hover:text-white transition-colors">System Status</a></li>
            </ul>
          </div>
          <div className="space-y-3 font-semibold">
            <span className="text-white uppercase tracking-wider text-[9px] font-bold">Legal</span>
            <ul className="space-y-2">
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Proctor Compliance</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 py-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-600 gap-4">
          <div>&copy; 2026 QuizVerse AI. All rights reserved. Built with Next.js & FastAPI.</div>
          <div className="flex gap-6 font-semibold">
            <a href="#" className="hover:text-slate-400 transition-colors">Privacy</a>
            <a href="#" className="hover:text-slate-400 transition-colors">Terms</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
