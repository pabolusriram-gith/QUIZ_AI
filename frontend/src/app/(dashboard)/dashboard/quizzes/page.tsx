"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/services/api";
import { toast } from "sonner";
import {
  Search, Filter, Edit2, Trash2, ChevronLeft, ChevronRight,
  X, Plus, BookOpen, Info,
  ChevronDown, RotateCcw, Copy, Eye, FileSpreadsheet, EyeOff,
  Archive, FileText, CheckCircle2, AlertTriangle, Calendar, Settings2, Play,
  Check
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/StatCard";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface QuestionOption {
  id?: string;
  text: string;
  is_correct: boolean;
  display_order: number;
}

interface Question {
  id?: string;
  text: string;
  difficulty: string;
  topic: string;
  marks: number;
  explanation?: string;
  question_type: string;
  bloom_level?: string;
  options: QuestionOption[];
}

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  duration: number;
  status: "draft" | "published" | "archived";
  quiz_code: string;
  created_at: string | null;
  updated_at: string | null;
  question_count: number;
  attempt_count: number;
  total_marks: number;
  pass_percentage: number;
  visibility: "public" | "private";
  max_attempts: number;
  anti_cheating_enabled: boolean;
  timer_mode: string;
  overall_time_limit_seconds: number | null;
  department: string | null;
  semester: string | null;
  language: string;
  fullscreen_required: boolean;
  adaptive_mode: boolean;
  allow_review: boolean;
  randomize_questions: boolean;
  randomize_options: boolean;
}

interface PaginatedResponse {
  total: number;
  items: Quiz[];
}

const PAGE_SIZE = 10;

const statusConfig: Record<string, { label: string; cls: string; dot: string }> = {
  draft: {
    label: "Draft",
    cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    dot: "bg-amber-500",
  },
  published: {
    label: "Published",
    cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    dot: "bg-emerald-500",
  },
  archived: {
    label: "Archived",
    cls: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    dot: "bg-slate-400",
  },
};

// =====================================================================
// View Quiz Details Modal
// =====================================================================
interface ViewModalProps {
  quizId: string;
  onClose: () => void;
}

function ViewModal({ quizId, onClose }: ViewModalProps) {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    api
      .get(`/quizzes/${quizId}`)
      .then((res) => {
        setDetails(res.data);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load quiz details.");
        onClose();
      });
  }, [quizId, onClose]);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Copied PIN ${code} to clipboard!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 dark:bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl p-6 space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="space-y-0.5">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display">
              {loading ? "Loading Quiz..." : details?.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {loading ? "" : `${details?.subject} • ${details?.visibility?.toUpperCase()} visibility`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="h-9 w-9 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-xs text-slate-500 dark:text-slate-400">Loading full quiz data...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Meta Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-3.5 text-center">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Pass Benchmark</span>
                <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{details.pass_percentage}%</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-3.5 text-center">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Duration</span>
                <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{details.duration} mins</p>
              </div>
              <div
                onClick={() => copyCode(details.quiz_code)}
                className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-3.5 text-center cursor-pointer hover:bg-indigo-500/15 transition-colors"
                title="Click to copy PIN code"
              >
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-bold tracking-wider flex items-center justify-center gap-1">
                  <span>Quiz Code</span>
                  <Copy className="h-2.5 w-2.5" />
                </span>
                <p className="text-base font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{details.quiz_code}</p>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3.5 text-center">
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold tracking-wider">Total Marks</span>
                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{details.total_marks}</p>
              </div>
            </div>

            {/* Config & Security Details */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Settings2 className="h-3.5 w-3.5 text-indigo-500" />
                <span>Test Settings & Safeguards</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                <p>Anti-Cheating Logs: <span className="font-semibold text-slate-900 dark:text-white">{details.anti_cheating_enabled ? "Enabled" : "Disabled"}</span></p>
                <p>Fullscreen Enforcement: <span className="font-semibold text-slate-900 dark:text-white">{details.fullscreen_required ? "Required" : "Optional"}</span></p>
                <p>Randomize Questions: <span className="font-semibold text-slate-900 dark:text-white">{details.randomize_questions ? "Yes" : "No"}</span></p>
                <p>Randomize Option Order: <span className="font-semibold text-slate-900 dark:text-white">{details.randomize_options ? "Yes" : "No"}</span></p>
                <p>Max Attempt Limit: <span className="font-semibold text-slate-900 dark:text-white">{details.max_attempts} attempt{details.max_attempts > 1 ? "s" : ""}</span></p>
                <p>Adaptive Mode: <span className="font-semibold text-slate-900 dark:text-white">{details.adaptive_mode ? "Enabled" : "Disabled"}</span></p>
              </div>
            </div>

            {/* Description */}
            {details.description && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description & Instructions</span>
                <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-3.5 leading-relaxed">
                  {details.description}
                </p>
              </div>
            )}

            {/* Questions List Preview */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Questions ({details.questions?.length ?? 0})
              </span>
              <div className="space-y-3">
                {details.questions?.map((q: any, qIdx: number) => (
                  <div
                    key={q.id || qIdx}
                    className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 space-y-2.5"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                        <span className="text-slate-400 mr-2">{qIdx + 1}.</span>
                        {q.text}
                      </p>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 uppercase tracking-wider text-slate-700 dark:text-slate-300 shrink-0 capitalize">
                        {q.difficulty}
                      </span>
                    </div>

                    {/* Options Grid */}
                    {q.options && q.options.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {q.options.map((o: any, oIdx: number) => (
                          <div
                            key={o.id || oIdx}
                            className={`px-3 py-2 rounded-xl text-xs font-medium border flex items-center gap-2 ${
                              o.is_correct
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold"
                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                            }`}
                          >
                            <span className={`h-4 w-4 rounded-md flex items-center justify-center text-[10px] ${o.is_correct ? "bg-emerald-500 text-white font-bold" : "bg-slate-100 dark:bg-slate-700 text-slate-400"}`}>
                              {String.fromCharCode(65 + (oIdx % 26))}
                            </span>
                            <span className="flex-1">{o.text}</span>
                            {o.is_correct && <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                          </div>
                        ))}
                      </div>
                    )}
                    {q.explanation && (
                      <p className="text-xs text-indigo-600 dark:text-indigo-400/90 pt-1 leading-relaxed">
                        <strong className="text-[10px] uppercase font-bold tracking-wider mr-1">Explanation:</strong>
                        {q.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// =====================================================================
// Edit Quiz Modal
// =====================================================================
interface EditModalProps {
  quiz: Quiz;
  onClose: () => void;
  onSaved: (updated: Quiz) => void;
}

function EditModal({ quiz, onClose, onSaved }: EditModalProps) {
  const [title, setTitle] = useState(quiz.title);
  const [subject, setSubject] = useState(quiz.subject);
  const [description, setDescription] = useState(quiz.description ?? "");
  const [duration, setDuration] = useState(quiz.duration);
  const [passPercentage, setPassPercentage] = useState(quiz.pass_percentage);
  const [visibility, setVisibility] = useState(quiz.visibility);
  const [status, setStatus] = useState(quiz.status);
  const [maxAttempts, setMaxAttempts] = useState(quiz.max_attempts);
  const [antiCheatingEnabled, setAntiCheatingEnabled] = useState(quiz.anti_cheating_enabled);
  const [fullscreenRequired, setFullscreenRequired] = useState(quiz.fullscreen_required);
  const [randomizeQuestions, setRandomizeQuestions] = useState(quiz.randomize_questions);
  const [randomizeOptions, setRandomizeOptions] = useState(quiz.randomize_options);
  const [department, setDepartment] = useState(quiz.department ?? "");
  const [semester, setSemester] = useState(quiz.semester ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return toast.error("Quiz title is required.");
    if (!subject.trim()) return toast.error("Subject is required.");
    if (duration <= 0) return toast.error("Duration must be greater than 0.");

    setSaving(true);
    try {
      const payload = {
        title,
        subject,
        description: description || null,
        duration,
        pass_percentage: passPercentage,
        visibility,
        status,
        max_attempts: maxAttempts,
        anti_cheating_enabled: antiCheatingEnabled,
        fullscreen_required: fullscreenRequired,
        randomize_questions: randomizeQuestions,
        randomize_options: randomizeOptions,
        department: department || null,
        semester: semester || null,
      };

      const res = await api.put(`/quizzes/${quiz.id}`, payload);
      toast.success("Quiz updated successfully!");
      onSaved({
        ...quiz,
        ...res.data,
        question_count: quiz.question_count,
        attempt_count: quiz.attempt_count,
      });
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? "Failed to save quiz settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 dark:bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl p-6 space-y-5"
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Settings2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                Edit Quiz Configuration
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Update parameters, timings, and access rules</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Title & Subject */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Quiz Title <span className="text-rose-500">*</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Quiz Title"
                className="bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Subject / Topic <span className="text-rose-500">*</span>
              </label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Mathematics"
                className="bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white h-10"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Description & Guidelines
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition resize-none leading-relaxed"
              placeholder="Enter quiz instructions or rules..."
            />
          </div>

          {/* Duration, Pass %, Attempts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Duration (mins)
              </label>
              <Input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Pass Percentage
              </label>
              <Input
                type="number"
                min={0}
                max={100}
                value={passPercentage}
                onChange={(e) => setPassPercentage(Number(e.target.value))}
                className="bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Max Attempts
              </label>
              <Input
                type="number"
                min={1}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
                className="bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white h-10"
              />
            </div>
          </div>

          {/* Department & Semester */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Department
              </label>
              <Input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Computer Science"
                className="bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Semester / Class
              </label>
              <Input
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                placeholder="e.g. Fall 2026"
                className="bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white h-10"
              />
            </div>
          </div>

          {/* Status & Visibility */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Lifecycle Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition cursor-pointer h-10"
              >
                <option value="draft" className="bg-white dark:bg-slate-900">Draft</option>
                <option value="published" className="bg-white dark:bg-slate-900">Published</option>
                <option value="archived" className="bg-white dark:bg-slate-900">Archived</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Visibility
              </label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition cursor-pointer h-10"
              >
                <option value="public" className="bg-white dark:bg-slate-900">Public (Accessible with PIN)</option>
                <option value="private" className="bg-white dark:bg-slate-900">Private (Assigned Only)</option>
              </select>
            </div>
          </div>

          {/* Feature Toggles */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label className="flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300 font-medium">
              <input
                type="checkbox"
                checked={antiCheatingEnabled}
                onChange={(e) => setAntiCheatingEnabled(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500/30"
              />
              <span>Anti-Cheating Logs</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300 font-medium">
              <input
                type="checkbox"
                checked={fullscreenRequired}
                onChange={(e) => setFullscreenRequired(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500/30"
              />
              <span>Require Fullscreen</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300 font-medium">
              <input
                type="checkbox"
                checked={randomizeQuestions}
                onChange={(e) => setRandomizeQuestions(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500/30"
              />
              <span>Randomize Questions</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300 font-medium">
              <input
                type="checkbox"
                checked={randomizeOptions}
                onChange={(e) => setRandomizeOptions(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500/30"
              />
              <span>Randomize Options</span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-2 shadow-sm"
          >
            {saving ? (
              <>
                <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// =====================================================================
// Delete Quiz Modal
// =====================================================================
interface DeleteModalProps {
  quiz: Quiz;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

function DeleteModal({ quiz, onClose, onDeleted }: DeleteModalProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/quizzes/${quiz.id}`);
      toast.success("Quiz deleted successfully.");
      onDeleted(quiz.id);
    } catch {
      toast.error("Failed to delete quiz.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 dark:bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.18 }}
        className="relative z-10 w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-6 shadow-2xl"
      >
        <div className="flex items-start gap-4 mb-5">
          <div className="h-11 w-11 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0 text-rose-500">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
              Delete Quiz?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              This will permanently delete this quiz, all its questions, and associated student play attempts.
            </p>
            <p className="text-xs text-slate-700 dark:text-slate-300 mt-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 italic line-clamp-2">
              &ldquo;{quiz.title}&rdquo;
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm shadow-rose-500/20"
          >
            {deleting ? (
              <>
                <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// =====================================================================
// Live Session Setup Dialog
// =====================================================================
interface LiveSessionSetupDialogProps {
  quizId: string;
  onClose: () => void;
  onHost: (quizId: string, settings: any) => void;
}

function LiveSessionSetupDialog({ quizId, onClose, onHost }: LiveSessionSetupDialogProps) {
  const [maxPlayers, setMaxPlayers] = useState(50);
  const [requireHostToStart, setRequireHostToStart] = useState(true);
  const [questionNavigationMode, setQuestionNavigationMode] = useState("host_controlled");
  const [leaderboardMode, setLeaderboardMode] = useState("final_results_only");
  const [quizEndMode, setQuizEndMode] = useState("auto_end");
  const [correctAnswerVisibility, setCorrectAnswerVisibility] = useState("immediately");
  const [questionOrder, setQuestionOrder] = useState("same_for_everyone");
  const [optionOrder, setOptionOrder] = useState("same_for_everyone");
  const [lateJoinPolicy, setLateJoinPolicy] = useState("disable_after_start");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onHost(quizId, {
      max_players: maxPlayers,
      require_host_to_start: requireHostToStart,
      question_navigation_mode: questionNavigationMode,
      leaderboard_mode: leaderboardMode,
      quiz_end_mode: quizEndMode,
      correct_answer_visibility: correctAnswerVisibility,
      question_order: questionOrder,
      option_order: optionOrder,
      late_join_policy: lateJoinPolicy,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 dark:bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl p-6 space-y-5"
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Play className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                Host Live Quiz Lobby
              </h3>
              <p className="text-xs text-slate-500">Configure multiplayer match settings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Question Navigation
            </label>
            <select
              value={questionNavigationMode}
              onChange={(e) => setQuestionNavigationMode(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition cursor-pointer text-xs"
            >
              <option value="host_controlled" className="bg-white dark:bg-slate-900">Host Controlled (Recommended)</option>
              <option value="automatic" className="bg-white dark:bg-slate-900">Automatic Timer Pacing</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Leaderboard Display
            </label>
            <select
              value={leaderboardMode}
              onChange={(e) => setLeaderboardMode(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition cursor-pointer text-xs"
            >
              <option value="final_results_only" className="bg-white dark:bg-slate-900">Final Results Only</option>
              <option value="after_every_question" className="bg-white dark:bg-slate-900">Live After Every Question</option>
              <option value="hidden" className="bg-white dark:bg-slate-900">Hidden from Players</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Question Order
              </label>
              <select
                value={questionOrder}
                onChange={(e) => setQuestionOrder(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition cursor-pointer text-xs"
              >
                <option value="same_for_everyone" className="bg-white dark:bg-slate-900">Same for Everyone</option>
                <option value="randomize" className="bg-white dark:bg-slate-900">Randomized per Player</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Max Players
              </label>
              <Input
                type="number"
                min={1}
                max={500}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(parseInt(e.target.value) || 50)}
                className="bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs h-9"
              />
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-700 dark:text-slate-300 font-medium">Require Host to Start Match</span>
              <input
                type="checkbox"
                checked={requireHostToStart}
                onChange={(e) => setRequireHostToStart(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500/30"
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-700 dark:text-slate-300 font-medium">Auto-End Game when timer expires</span>
              <input
                type="checkbox"
                checked={quizEndMode === "auto_end"}
                onChange={(e) => setQuizEndMode(e.target.checked ? "auto_end" : "host_ends")}
                className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500/30"
              />
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-2xl border border-slate-200 dark:border-slate-700 transition cursor-pointer text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 h-11 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold rounded-2xl shadow-md border-none transition cursor-pointer text-xs flex items-center justify-center gap-1.5"
            >
              <Play className="h-4 w-4" />
              <span>Launch Host Lobby</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// =====================================================================
// Main Quizzes Page Component
// =====================================================================
export default function QuizzesPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [viewQuizId, setViewQuizId] = useState<string | null>(null);
  const [editQuiz, setEditQuiz] = useState<Quiz | null>(null);
  const [deleteQuiz, setDeleteQuiz] = useState<Quiz | null>(null);
  const [setupLiveSessionQuizId, setSetupLiveSessionQuizId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [filterStatus]);

  const handleHostSession = async (quizId: string, settings: any = {}) => {
    toast.loading("Initializing live host lobby...", { id: "lobby-loader" });
    try {
      const res = await api.post("/sessions/create", {
        quiz_id: quizId,
        ...settings,
      });
      const data = res.data;
      toast.success("Game session ready!", { id: "lobby-loader" });
      router.push(`/dashboard/live-quiz?session=${data.game_pin}&host=true`);
    } catch {
      toast.error("Failed to host live session.", { id: "lobby-loader" });
    }
  };

  const fetchQuizzes = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (filterStatus) params.status = filterStatus;

      const res = await api.get<PaginatedResponse>("/quizzes", { params });
      setQuizzes(res.data.items);
      setTotal(res.data.total);
    } catch {
      toast.error("Failed to load quizzes list.");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filterStatus]);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  const handleTogglePublish = async (quiz: Quiz) => {
    const nextStatus = quiz.status === "published" ? "draft" : "published";
    try {
      await api.put(`/quizzes/${quiz.id}`, {
        title: quiz.title,
        subject: quiz.subject,
        status: nextStatus,
      });
      toast.success(nextStatus === "published" ? "Quiz published successfully!" : "Quiz reverted to draft.");
      setQuizzes((prev) =>
        prev.map((q) => (q.id === quiz.id ? { ...q, status: nextStatus } : q))
      );
    } catch {
      toast.error("Failed to update quiz publish status.");
    }
  };

  const handleToggleArchive = async (quiz: Quiz) => {
    const nextStatus = quiz.status === "archived" ? "draft" : "archived";
    try {
      await api.put(`/quizzes/${quiz.id}`, {
        title: quiz.title,
        subject: quiz.subject,
        status: nextStatus,
      });
      toast.success(nextStatus === "archived" ? "Quiz archived." : "Quiz restored from archives.");
      setQuizzes((prev) =>
        prev.map((q) => (q.id === quiz.id ? { ...q, status: nextStatus } : q))
      );
    } catch {
      toast.error("Failed to update archive status.");
    }
  };

  const handleDuplicate = async (quiz: Quiz) => {
    toast.loading("Duplicating quiz and questions...", { id: "dup-loader" });
    try {
      const fullRes = await api.get(`/quizzes/${quiz.id}`);
      const details = fullRes.data;

      const randomizedCode = `QZ-${Math.floor(100000 + Math.random() * 900000)}`;
      const duplicatePayload = {
        title: `Copy of ${details.title}`,
        description: details.description,
        subject: details.subject,
        duration: details.duration,
        randomize_questions: details.randomize_questions,
        randomize_options: details.randomize_options,
        anti_cheating_enabled: details.anti_cheating_enabled,
        ai_feedback_enabled: details.ai_feedback_enabled,
        department: details.department,
        semester: details.semester,
        total_marks: details.total_marks,
        pass_percentage: details.pass_percentage,
        visibility: details.visibility,
        status: "draft",
        language: details.language,
        fullscreen_required: details.fullscreen_required,
        adaptive_mode: details.adaptive_mode,
        allow_review: details.allow_review,
        quiz_code: randomizedCode,
        max_attempts: details.max_attempts,
        timer_mode: details.timer_mode,
        overall_time_limit_seconds: details.overall_time_limit_seconds,
        questions: details.questions?.map((q: any) => ({
          text: q.text,
          difficulty: q.difficulty,
          topic: q.topic,
          marks: q.marks,
          explanation: q.explanation,
          question_type: q.question_type,
          bloom_level: q.bloom_level,
          subtopic: q.subtopic,
          estimated_time: q.estimated_time,
          negative_marks: q.negative_marks,
          hint: q.hint,
          ai_generated: q.ai_generated,
          order_index: q.order_index,
          time_limit_seconds: q.time_limit_seconds,
          options: q.options?.map((o: any) => ({
            text: o.text,
            is_correct: o.is_correct,
            display_order: o.display_order,
          })),
        })),
      };

      await api.post("/quizzes", duplicatePayload);
      toast.success("Quiz duplicated successfully!", { id: "dup-loader" });
      fetchQuizzes();
    } catch {
      toast.error("Failed to duplicate quiz.", { id: "dup-loader" });
    }
  };

  const handleSaved = (updated: Quiz) => {
    setQuizzes((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
    setEditQuiz(null);
  };

  const handleDeleted = (id: string) => {
    setQuizzes((prev) => prev.filter((q) => q.id !== id));
    setTotal((t) => Math.max(0, t - 1));
    setDeleteQuiz(null);
  };

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setFilterStatus("");
    setPage(1);
  };

  const copyCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    toast.success(`Copied PIN ${code} to clipboard!`);
  };

  const hasActiveFilters = !!(search || filterStatus);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Quizzes"
        description="Manage created assessments, duplicate templates, publish, or host live multiplayer sessions."
        actions={
          <Link
            href="/create-quiz"
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition cursor-pointer shadow-sm shadow-indigo-600/10"
          >
            <Plus className="h-4 w-4" />
            <span>Create Quiz</span>
          </Link>
        }
      />

      {/* Top Stat Cards */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-4"
      >
        <StatCard
          title="Total Quizzes"
          value={total}
          icon={<FileSpreadsheet className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />}
          glowColor="indigo"
        />
        <StatCard
          title="Active Live"
          value={quizzes.filter((q) => q.status === "published").length}
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />}
          glowColor="emerald"
        />
        <StatCard
          title="Drafts"
          value={quizzes.filter((q) => q.status === "draft").length}
          icon={<Info className="h-5 w-5 text-amber-500 dark:text-amber-400" />}
          glowColor="indigo"
        />
        <StatCard
          title="Archived"
          value={quizzes.filter((q) => q.status === "archived").length}
          icon={<Archive className="h-5 w-5 text-slate-500 dark:text-slate-400" />}
          glowColor="indigo"
        />
      </motion.div>

      {/* Search Toolbar & Filter Row */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="glass-panel rounded-3xl p-4 sm:p-5 space-y-3"
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search quizzes by title, subject, or code..."
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                showFilters || hasActiveFilters
                  ? "bg-indigo-500/15 border-indigo-500/35 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Status Filter</span>
              {hasActiveFilters && (
                <span className="h-4 w-4 rounded-full bg-indigo-600 text-[9px] font-extrabold text-white flex items-center justify-center">
                  {[filterStatus, debouncedSearch].filter(Boolean).length}
                </span>
              )}
              <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </button>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Status Filter */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden pt-3 border-t border-slate-200 dark:border-slate-800"
            >
              <div className="flex gap-2 flex-wrap">
                {["", "draft", "published", "archived"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      filterStatus === st
                        ? st === ""
                          ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-600 dark:text-indigo-300"
                          : st === "published"
                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-emerald-300"
                          : st === "draft"
                          ? "bg-amber-500/20 border-amber-500/40 text-amber-600 dark:text-amber-300"
                          : "bg-slate-500/20 border-slate-500/40 text-slate-700 dark:text-slate-300"
                        : "bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {st === "" ? "All Statuses" : st.charAt(0).toUpperCase() + st.slice(1)}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Main Quizzes List Container */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
        className="glass-panel rounded-3xl overflow-hidden shadow-sm"
      >
        <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_130px_110px_100px_90px_120px_170px] gap-4 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-900/50">
          <span>Quiz Information</span>
          <span>Subject</span>
          <span>Access PIN</span>
          <span>Questions</span>
          <span>Plays</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="h-9 w-9 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Loading assessments...</p>
          </div>
        ) : quizzes.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 px-4 text-center">
            <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
              <BookOpen className="h-7 w-7" />
            </div>
            <div className="space-y-1 max-w-sm">
              <p className="text-base font-bold text-slate-900 dark:text-white font-display">No quizzes found</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {hasActiveFilters
                  ? "No assessments match your current filters. Try resetting search."
                  : "Create your first quiz using the AI Generator or manual builder."}
              </p>
            </div>
            {hasActiveFilters ? (
              <button
                onClick={resetFilters}
                className="px-4 py-2 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/25 hover:bg-indigo-500/20 transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            ) : (
              <Link
                href="/create-quiz"
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all cursor-pointer shadow-sm"
              >
                Create Quiz
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {quizzes.map((q, idx) => {
              const statusCfg = statusConfig[q.status] ?? statusConfig.draft;

              return (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15, delay: idx * 0.015 }}
                  className="group flex flex-col sm:grid sm:grid-cols-[minmax(0,1fr)_130px_110px_100px_90px_120px_170px] gap-4 px-5 py-4 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {/* Left Column Info */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 mt-0.5 text-slate-500 dark:text-slate-400">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug truncate group-hover:text-indigo-600 dark:group-hover:text-cyan-400 transition-colors">
                        {q.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        <span>Created: {q.created_at ? new Date(q.created_at).toLocaleDateString() : "recent"}</span>
                      </p>
                      {/* Mobile tags */}
                      <div className="sm:hidden flex flex-wrap items-center gap-2 mt-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusCfg.cls}`}>
                          {statusCfg.label}
                        </span>
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                          PIN: {q.quiz_code}
                        </span>
                        <span className="text-[10px] text-slate-400">• {q.subject}</span>
                      </div>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center text-xs text-slate-600 dark:text-slate-300 font-medium truncate">
                    {q.subject}
                  </div>

                  <div
                    className="hidden sm:flex items-center"
                    onClick={(e) => copyCode(q.quiz_code, e)}
                  >
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-mono font-bold hover:bg-indigo-500/20 transition-colors cursor-pointer" title="Click to copy PIN">
                      <span>{q.quiz_code}</span>
                      <Copy className="h-2.5 w-2.5 opacity-60" />
                    </span>
                  </div>

                  <div className="hidden sm:flex items-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {q.question_count} question{q.question_count !== 1 ? "s" : ""}
                  </div>

                  <div className="hidden sm:flex items-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {q.attempt_count} play{q.attempt_count !== 1 ? "s" : ""}
                  </div>

                  <div className="hidden sm:flex items-center">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusCfg.cls}`}>
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* Actions Column */}
                  <div className="flex items-center justify-start sm:justify-end gap-1 flex-wrap sm:flex-nowrap">
                    {/* Host Live Session */}
                    {q.status === "published" && (
                      <button
                        onClick={() => setSetupLiveSessionQuizId(q.id)}
                        className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                        title="Host Live Session"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* View Details */}
                    <button
                      onClick={() => setViewQuizId(q.id)}
                      className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors cursor-pointer"
                      title="View Details"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>

                    {/* Edit Config */}
                    <button
                      onClick={() => setEditQuiz(q)}
                      className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                      title="Edit Settings"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>

                    {/* Duplicate */}
                    <button
                      onClick={() => handleDuplicate(q)}
                      className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                      title="Duplicate Quiz"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>

                    {/* Publish / Draft toggle */}
                    <button
                      onClick={() => handleTogglePublish(q)}
                      className={`h-8 w-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                        q.status === "published"
                          ? "text-amber-500 hover:bg-amber-500/10"
                          : "text-emerald-500 hover:bg-emerald-500/10"
                      }`}
                      title={q.status === "published" ? "Revert to Draft" : "Publish Quiz"}
                    >
                      {q.status === "published" ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                    </button>

                    {/* Archive toggle */}
                    <button
                      onClick={() => handleToggleArchive(q)}
                      className={`h-8 w-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                        q.status === "archived"
                          ? "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10"
                          : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                      title={q.status === "archived" ? "Restore from Archive" : "Archive Quiz"}
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => setDeleteQuiz(q)}
                      className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Delete Quiz"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Pagination Toolbar */}
        {!loading && total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Showing{" "}
              <span className="text-slate-900 dark:text-white font-bold">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}
              </span>{" "}
              of <span className="text-slate-900 dark:text-white font-bold">{total}</span> quizzes
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    totalPages <= 7 ||
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - page) <= 1
                )
                .reduce<(number | "...")[]>((acc, p, i, arr) => {
                  if (i > 0) {
                    const prev = arr[i - 1];
                    if (typeof prev === "number" && p - prev > 1) acc.push("...");
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, i) =>
                  item === "..." ? (
                    <span key={`ell-${i}`} className="text-xs text-slate-400 px-1">
                      ...
                    </span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setPage(item as number)}
                      className={`h-8 w-8 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        page === item
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Modals & Dialogs */}
      <AnimatePresence>
        {viewQuizId && (
          <ViewModal
            key="view-modal"
            quizId={viewQuizId}
            onClose={() => setViewQuizId(null)}
          />
        )}
        {editQuiz && (
          <EditModal
            key="edit-modal"
            quiz={editQuiz}
            onClose={() => setEditQuiz(null)}
            onSaved={handleSaved}
          />
        )}
        {deleteQuiz && (
          <DeleteModal
            key="delete-modal"
            quiz={deleteQuiz}
            onClose={() => setDeleteQuiz(null)}
            onDeleted={handleDeleted}
          />
        )}
        {setupLiveSessionQuizId && (
          <LiveSessionSetupDialog
            key="setup-live-modal"
            quizId={setupLiveSessionQuizId}
            onClose={() => setSetupLiveSessionQuizId(null)}
            onHost={handleHostSession}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
