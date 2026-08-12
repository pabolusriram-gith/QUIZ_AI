"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/services/api";
import { toast } from "sonner";
import {
  Search, Filter, Edit2, Trash2, ChevronLeft, ChevronRight,
  X, Plus,  BookOpen, Info,
  ChevronDown, RotateCcw, Copy, Eye, FileSpreadsheet, EyeOff,
  Archive, FileText, CheckCircle2, AlertTriangle, Calendar, Settings2, Play
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";
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

const statusConfig: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  published: { label: "Published", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  archived: { label: "Archived", cls: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
};

// =====================================================================
// View Modal
// =====================================================================
interface ViewModalProps {
  quizId: string;
  onClose: () => void;
}

function ViewModal({ quizId, onClose }: ViewModalProps) {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    api.get(`/quizzes/${quizId}`)
      .then((res) => {
        setDetails(res.data);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load quiz details.");
        onClose();
      });
  }, [quizId, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.2 }}
        className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/8 bg-[#060d1c] shadow-2xl p-6 space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white font-display">{loading ? "Loading..." : details?.title}</h3>
            <p className="text-xs text-slate-500 mt-1">{loading ? "" : details?.subject}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-xs text-slate-500">Loading quiz details...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Meta Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Pass %</span>
                <p className="text-sm font-semibold text-white mt-0.5">{details.pass_percentage}%</p>
              </div>
              <div className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Duration</span>
                <p className="text-sm font-semibold text-white mt-0.5">{details.duration} mins</p>
              </div>
              <div className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Code</span>
                <p className="text-sm font-semibold text-indigo-400 mt-0.5">{details.quiz_code}</p>
              </div>
              <div className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Marks</span>
                <p className="text-sm font-semibold text-emerald-400 mt-0.5">{details.total_marks}</p>
              </div>
            </div>

            {/* Config details */}
            <div className="bg-white/2 border border-white/5 rounded-2xl p-4 space-y-3 text-xs text-slate-400">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5 text-indigo-400" />Settings & Controls</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                <p>Anti-Cheating Enforcement: <span className="text-slate-200 font-semibold">{details.anti_cheating_enabled ? "Enabled" : "Disabled"}</span></p>
                <p>Fullscreen Mode Required: <span className="text-slate-200 font-semibold">{details.fullscreen_required ? "Yes" : "No"}</span></p>
                <p>Randomize Questions: <span className="text-slate-200 font-semibold">{details.randomize_questions ? "Yes" : "No"}</span></p>
                <p>Randomize Options: <span className="text-slate-200 font-semibold">{details.randomize_options ? "Yes" : "No"}</span></p>
                <p>Max Attempts Limit: <span className="text-slate-200 font-semibold">{details.max_attempts}</span></p>
                <p>Adaptive Mode: <span className="text-slate-200 font-semibold">{details.adaptive_mode ? "Enabled" : "Disabled"}</span></p>
              </div>
            </div>

            {/* Description */}
            {details.description && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Description</span>
                <p className="text-xs text-slate-300 bg-white/2 border border-white/5 rounded-xl p-3.5 leading-relaxed">{details.description}</p>
              </div>
            )}

            {/* Questions List */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Questions ({details.questions.length})</span>
              <div className="space-y-3.5">
                {details.questions.map((q: any, qIdx: number) => (
                  <div key={q.id || qIdx} className="bg-white/2 border border-white/5 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-start gap-4">
                      <p className="text-sm font-semibold text-white leading-relaxed"><span className="text-slate-500 mr-1.5">{qIdx + 1}.</span>{q.text}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 border border-white/5 uppercase tracking-wide text-slate-400 shrink-0 capitalize">{q.difficulty}</span>
                    </div>

                    {/* Options Grid */}
                    {q.options && q.options.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((o: any, oIdx: number) => (
                          <div key={o.id || oIdx} className={`px-3 py-2 rounded-lg text-xs border ${o.is_correct ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-white/3 border-white/5 text-slate-400"}`}>
                            {o.text}
                          </div>
                        ))}
                      </div>
                    )}
                    {q.explanation && (
                      <p className="text-xs text-indigo-400/80 mt-1 italic"><span className="font-semibold not-italic text-indigo-400 uppercase tracking-wide text-[10px] mr-1">Explanation:</span>{q.explanation}</p>
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
// Edit Modal
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
      toast.error(err.response?.data?.detail ?? "Failed to save updates.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.2 }}
        className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/8 bg-[#060d1c] shadow-2xl p-6 space-y-5">
        
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <h3 className="text-base font-bold text-white font-display">Edit Quiz Configuration</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-bold text-slate-400 uppercase tracking-widest">Quiz Title *</label>
              <Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Quiz Title" className="bg-white/4 border-white/8 text-white focus:border-indigo-500/50" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-400 uppercase tracking-widest">Subject *</label>
              <Input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="e.g. Mathematics" className="bg-white/4 border-white/8 text-white focus:border-indigo-500/50" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-400 uppercase tracking-widest">Description</label>
            <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3}
              className="w-full px-3 py-2 rounded-xl bg-white/4 border border-white/8 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition resize-none"
              placeholder="Enter quiz description/rules..." />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="font-bold text-slate-400 uppercase tracking-widest">Duration (mins)</label>
              <Input type="number" min={1} value={duration} onChange={e=>setDuration(Number(e.target.value))} className="bg-white/4 border-white/8 text-white focus:border-indigo-500/50" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-400 uppercase tracking-widest">Pass Percentage</label>
              <Input type="number" min={0} max={100} value={passPercentage} onChange={e=>setPassPercentage(Number(e.target.value))} className="bg-white/4 border-white/8 text-white focus:border-indigo-500/50" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-400 uppercase tracking-widest">Max Attempts</label>
              <Input type="number" min={1} value={maxAttempts} onChange={e=>setMaxAttempts(Number(e.target.value))} className="bg-white/4 border-white/8 text-white focus:border-indigo-500/50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-bold text-slate-400 uppercase tracking-widest">Department</label>
              <Input value={department} onChange={e=>setDepartment(e.target.value)} placeholder="e.g. CS" className="bg-white/4 border-white/8 text-white focus:border-indigo-500/50" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-400 uppercase tracking-widest">Semester</label>
              <Input value={semester} onChange={e=>setSemester(e.target.value)} placeholder="e.g. Autumn" className="bg-white/4 border-white/8 text-white focus:border-indigo-500/50" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="font-bold text-slate-400 uppercase tracking-widest">Status</label>
              <select value={status} onChange={e=>setStatus(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/4 border border-white/8 text-white focus:outline-none focus:border-indigo-500/50 transition cursor-pointer">
                <option value="draft" className="bg-[#060d1c]">Draft</option>
                <option value="published" className="bg-[#060d1c]">Published</option>
                <option value="archived" className="bg-[#060d1c]">Archived</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-400 uppercase tracking-widest">Visibility</label>
              <select value={visibility} onChange={e=>setVisibility(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/4 border border-white/8 text-white focus:outline-none focus:border-indigo-500/50 transition cursor-pointer">
                <option value="public" className="bg-[#060d1c]">Public</option>
                <option value="private" className="bg-[#060d1c]">Private</option>
              </select>
            </div>
          </div>

          {/* Toggle Switches */}
          <div className="bg-white/2 border border-white/5 rounded-xl p-4 grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2.5 cursor-pointer text-slate-300">
              <input type="checkbox" checked={antiCheatingEnabled} onChange={e=>setAntiCheatingEnabled(e.target.checked)} className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-indigo-500/30" />
              <span>Anti-Cheating Logs</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer text-slate-300">
              <input type="checkbox" checked={fullscreenRequired} onChange={e=>setFullscreenRequired(e.target.checked)} className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-indigo-500/30" />
              <span>Require Fullscreen</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer text-slate-300">
              <input type="checkbox" checked={randomizeQuestions} onChange={e=>setRandomizeQuestions(e.target.checked)} className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-indigo-500/30" />
              <span>Randomize Questions</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer text-slate-300">
              <input type="checkbox" checked={randomizeOptions} onChange={e=>setRandomizeOptions(e.target.checked)} className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-indigo-500/30" />
              <span>Randomize Options</span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/5 pt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 border border-white/8 transition-colors cursor-pointer">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-2">
            {saving ? (
              <><span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
            ) : (
              <><CheckCircle2 className="h-3.5 w-3.5" />Save Changes</>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// =====================================================================
// Delete Confirmation Modal
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.18 }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/8 bg-[#060d1c] p-6 shadow-2xl">
        <div className="flex items-start gap-4 mb-5">
          <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-rose-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white font-display">Delete Quiz?</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">This will permanently remove the quiz and all associated attempts. This action is irreversible.</p>
            <p className="text-xs text-slate-500 mt-2 line-clamp-2 italic">&ldquo;{quiz.title}&rdquo;</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 border border-white/8 transition-colors cursor-pointer">Cancel</button>
          <button onClick={handleDelete} disabled={deleting} className="px-5 py-2 rounded-xl text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-2">
            {deleting ? <><span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Deleting...</> : <><Trash2 className="h-3.5 w-3.5" />Delete</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// =====================================================================
// Main Page
// =====================================================================
export default function QuizzesPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);

  const handleHostSession = async (quizId: string, settings: any = {}) => {
    toast.loading("Initializing live host lobby...", { id: "lobby-loader" });
    try {
      const res = await api.post("/sessions/create", {
        quiz_id: quizId,
        ...settings
      });
      toast.success("Opening Host Lobby!", { id: "lobby-loader" });
      router.push(`/lobby/${res.data.game_pin}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Failed to initialize live session.", { id: "lobby-loader" });
    }
  };
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Modal State
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
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  useEffect(() => { setPage(1); }, [filterStatus]);

  const fetchQuizzes = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
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

  // Inline Actions
  const handleTogglePublish = async (quiz: Quiz) => {
    const nextStatus = quiz.status === "published" ? "draft" : "published";
    try {
      const res = await api.put(`/quizzes/${quiz.id}`, {
        title: quiz.title,
        subject: quiz.subject,
        status: nextStatus,
      });
      toast.success(nextStatus === "published" ? "Quiz published successfully!" : "Quiz set back to draft.");
      setQuizzes(prev => prev.map(q => q.id === quiz.id ? { ...q, status: nextStatus } : q));
    } catch {
      toast.error("Failed to toggle publish status.");
    }
  };

  const handleToggleArchive = async (quiz: Quiz) => {
    const nextStatus = quiz.status === "archived" ? "draft" : "archived";
    try {
      const res = await api.put(`/quizzes/${quiz.id}`, {
        title: quiz.title,
        subject: quiz.subject,
        status: nextStatus,
      });
      toast.success(nextStatus === "archived" ? "Quiz archived successfully." : "Quiz restored from archives.");
      setQuizzes(prev => prev.map(q => q.id === quiz.id ? { ...q, status: nextStatus } : q));
    } catch {
      toast.error("Failed to update status.");
    }
  };

  const handleDuplicate = async (quiz: Quiz) => {
    toast.loading("Duplicating quiz...", { id: "dup-loader" });
    try {
      // 1. Fetch full quiz details (including questions and options)
      const fullRes = await api.get(`/quizzes/${quiz.id}`);
      const details = fullRes.data;

      // 2. Prep duplicate payload
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
        status: "draft", // always start as draft
        language: details.language,
        fullscreen_required: details.fullscreen_required,
        adaptive_mode: details.adaptive_mode,
        allow_review: details.allow_review,
        quiz_code: randomizedCode,
        max_attempts: details.max_attempts,
        timer_mode: details.timer_mode,
        overall_time_limit_seconds: details.overall_time_limit_seconds,
        questions: details.questions.map((q: any) => ({
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
          options: q.options.map((o: any) => ({
            text: o.text,
            is_correct: o.is_correct,
            display_order: o.display_order,
          }))
        }))
      };

      // 3. Post as new quiz
      await api.post("/quizzes", duplicatePayload);
      toast.success("Quiz duplicated successfully!", { id: "dup-loader" });
      fetchQuizzes();
    } catch {
      toast.error("Failed to duplicate quiz.", { id: "dup-loader" });
    }
  };

  const handleSaved = (updated: Quiz) => {
    setQuizzes(prev => prev.map(q => q.id === updated.id ? updated : q));
    setEditQuiz(null);
  };

  const handleDeleted = (id: string) => {
    setQuizzes(prev => prev.filter(q => q.id !== id));
    setTotal(t => t - 1);
    setDeleteQuiz(null);
  };

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setFilterStatus("");
    setPage(1);
  };

  const hasActiveFilters = !!(search || filterStatus);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Quizzes"
        description="Manage, duplicate, publish, or view student attempts on quizzes."
        actions={
          <Link href="/create-quiz" className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition cursor-pointer">
            <Plus className="h-4 w-4" />Create Quiz
          </Link>
        }
      />

      {/* Analytics stats */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Quizzes", value: total, icon: <FileSpreadsheet className="h-4 w-4 text-indigo-400" />, cls: "text-indigo-400" },
          { label: "Active Live", value: quizzes.filter(q=>q.status==="published").length, icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />, cls: "text-emerald-400" },
          { label: "Drafts", value: quizzes.filter(q=>q.status==="draft").length, icon: <Info className="h-4 w-4 text-amber-400" />, cls: "text-amber-400" },
          { label: "Archived", value: quizzes.filter(q=>q.status==="archived").length, icon: <Archive className="h-4 w-4 text-slate-400" />, cls: "text-slate-400" },
        ].map((s) => (
          <div key={s.label} className="glass-panel rounded-xl p-4 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">{s.icon}</div>
            <div>
              <p className={`text-xl font-extrabold font-display ${s.cls}`}>{s.value}</p>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{s.label}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Search toolbar */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }} className="glass-panel rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
            <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search quizzes by title or subject..."
              className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-white/4 border border-white/8 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition" />
            {search && <button onClick={()=>setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-500 hover:text-white cursor-pointer"><X className="h-3.5 w-3.5" /></button>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={()=>setShowFilters(!showFilters)} className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${showFilters || hasActiveFilters ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" : "bg-white/4 border-white/8 text-slate-400 hover:text-white hover:bg-white/8"}`}>
              <Filter className="h-3.5 w-3.5" />Status Filter
              <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </button>
            {hasActiveFilters && <button onClick={resetFilters} className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-semibold bg-white/4 border border-white/8 text-slate-400 hover:text-white hover:bg-white/8 cursor-pointer"><RotateCcw className="h-3.5 w-3.5" />Reset</button>}
          </div>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="pt-3 border-t border-white/5 flex gap-2 flex-wrap">
                {["", "draft", "published", "archived"].map(st => (
                  <button key={st} onClick={() => setFilterStatus(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${filterStatus === st ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-300" : "bg-white/4 border-white/8 text-slate-400 hover:text-white hover:bg-white/8"}`}>
                    {st === "" ? "All Statuses" : st.charAt(0).toUpperCase() + st.slice(1)}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Main Quizzes Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }} className="glass-panel rounded-2xl overflow-hidden">
        <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_120px_100px_100px_90px_120px_160px] gap-4 px-5 py-3 border-b border-white/5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          <span>Quiz Details</span><span>Subject</span><span>Code</span><span>Questions</span><span>Attempts</span><span>Status</span><span className="text-right">Actions</span>
        </div>

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Loading quizzes...</p>
          </div>
        ) : quizzes.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-white/4 flex items-center justify-center"><BookOpen className="h-7 w-7 text-slate-500" /></div>
            <div className="text-center">
              <p className="text-sm font-bold text-white">No quizzes found</p>
              <p className="text-xs text-slate-500 mt-1">{hasActiveFilters ? "Try clearing your filters." : "Create your first quiz using the Create Quiz wizard."}</p>
            </div>
            {hasActiveFilters && <button onClick={resetFilters} className="px-4 py-2 rounded-xl text-xs font-semibold text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/10 cursor-pointer">Clear Filters</button>}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {quizzes.map((q, idx) => {
              const statusCfg = statusConfig[q.status] ?? statusConfig.draft;
              return (
                <motion.div key={q.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: idx * 0.02 }}
                  className="group flex flex-col sm:grid sm:grid-cols-[minmax(0,1fr)_120px_100px_100px_90px_120px_160px] gap-4 px-5 py-4 hover:bg-white/2 transition-colors">
                  
                  {/* Left Column Info */}
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-white/4 border border-white/8 flex items-center justify-center shrink-0 mt-0.5 text-slate-300">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-white leading-snug truncate group-hover:text-slate-100">{q.title}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5"><Calendar className="h-3 w-3" />Created: {q.created_at ? new Date(q.created_at).toLocaleDateString() : "unknown"}</p>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center text-xs text-slate-400 truncate">{q.subject}</div>
                  <div className="hidden sm:flex items-center text-xs text-indigo-400 font-semibold">{q.quiz_code}</div>
                  <div className="hidden sm:flex items-center text-xs text-slate-400">{q.question_count} items</div>
                  <div className="hidden sm:flex items-center text-xs text-slate-400">{q.attempt_count} plays</div>
                  <div className="hidden sm:flex items-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusCfg.cls}`}>{statusCfg.label}</span>
                  </div>

                  {/* Actions column */}
                  <div className="flex items-center justify-start sm:justify-end gap-1.5">
                    {/* Host Live Session */}
                    {q.status === "published" && (
                      <button onClick={() => setSetupLiveSessionQuizId(q.id)} className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer" title="Host Live Session">
                        <Play className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {/* View */}
                    <button onClick={() => setViewQuizId(q.id)} className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 cursor-pointer" title="View details"><Eye className="h-3.5 w-3.5" /></button>
                    {/* Edit */}
                    <button onClick={() => setEditQuiz(q)} className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 cursor-pointer" title="Edit config"><Edit2 className="h-3.5 w-3.5" /></button>
                    {/* Duplicate */}
                    <button onClick={() => handleDuplicate(q)} className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer" title="Duplicate"><Copy className="h-3.5 w-3.5" /></button>
                    {/* Publish/Unpublish toggle */}
                    <button onClick={() => handleTogglePublish(q)} className={`h-7 w-7 rounded-lg flex items-center justify-center cursor-pointer ${q.status === "published" ? "text-amber-500 hover:bg-amber-500/10" : "text-emerald-500 hover:bg-emerald-500/10"}`} title={q.status === "published" ? "Set to Draft" : "Publish Quiz"}>
                      {q.status === "published" ? <EyeOff className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    </button>
                    {/* Archive toggle */}
                    <button onClick={() => handleToggleArchive(q)} className={`h-7 w-7 rounded-lg flex items-center justify-center cursor-pointer ${q.status === "archived" ? "text-indigo-400 hover:bg-indigo-500/10" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`} title={q.status === "archived" ? "Restore" : "Archive"}>
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                    {/* Delete */}
                    <button onClick={() => setDeleteQuiz(q)} className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>

                </motion.div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-white/5">
            <p className="text-xs text-slate-500 font-medium">
              Showing <span className="text-white font-semibold">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}</span> of <span className="text-white font-semibold">{total}</span> quizzes
            </p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed border border-white/8 transition-colors cursor-pointer">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => totalPages <= 7 || p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | "...")[]>((acc, p, i, arr) => {
                  if (i > 0) {
                    const prev = arr[i - 1];
                    if (typeof prev === "number" && p - prev > 1) acc.push("...");
                  }
                  acc.push(p); return acc;
                }, [])
                .map((item, i) => item === "..."
                  ? <span key={`ell-${i}`} className="text-xs text-slate-600 px-1">...</span>
                  : <button key={item} onClick={() => setPage(item as number)} className={`h-8 w-8 rounded-lg text-xs font-semibold border ${page === item ? "bg-indigo-600 border-indigo-600 text-white" : "border-white/8 text-slate-400 hover:text-white hover:bg-white/5"} transition-colors cursor-pointer`}>{item}</button>
                )}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed border border-white/8 transition-colors cursor-pointer">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Modals */}
      <AnimatePresence>
        {viewQuizId && <ViewModal key="view-modal" quizId={viewQuizId} onClose={() => setViewQuizId(null)} />}
        {editQuiz && <EditModal key="edit-modal" quiz={editQuiz} onClose={() => setEditQuiz(null)} onSaved={handleSaved} />}
        {deleteQuiz && <DeleteModal key="delete-modal" quiz={deleteQuiz} onClose={() => setDeleteQuiz(null)} onDeleted={handleDeleted} />}
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.2 }}
        className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/8 bg-[#060d1c] shadow-2xl p-6 space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-white font-display">Live Session Setup</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Question Navigation */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Question Navigation</label>
            <select value={questionNavigationMode} onChange={e => setQuestionNavigationMode(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/4 border border-white/8 text-white focus:outline-none focus:border-indigo-500/50 transition cursor-pointer text-sm">
              <option value="host_controlled" className="bg-[#060d1c]">Host Controlled (Default)</option>
              <option value="automatic" className="bg-[#060d1c]">Automatic</option>
            </select>
          </div>

          {/* Leaderboard Mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Leaderboard Mode</label>
            <select value={leaderboardMode} onChange={e => setLeaderboardMode(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/4 border border-white/8 text-white focus:outline-none focus:border-indigo-500/50 transition cursor-pointer text-sm">
              <option value="final_results_only" className="bg-[#060d1c]">Final Results Only (Default)</option>
              <option value="hidden" className="bg-[#060d1c]">Hidden</option>
              <option value="after_every_question" className="bg-[#060d1c]">After Every Question</option>
            </select>
          </div>

          {/* Correct Answers */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Correct Answers Visibility</label>
            <select value={correctAnswerVisibility} onChange={e => setCorrectAnswerVisibility(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/4 border border-white/8 text-white focus:outline-none focus:border-indigo-500/50 transition cursor-pointer text-sm">
              <option value="immediately" className="bg-[#060d1c]">Immediately (Default)</option>
              <option value="after_quiz_ends" className="bg-[#060d1c]">After Quiz Ends</option>
              <option value="never" className="bg-[#060d1c]">Never</option>
            </select>
          </div>

          {/* Question Order & Option Order */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Question Order</label>
              <select value={questionOrder} onChange={e => setQuestionOrder(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/4 border border-white/8 text-white focus:outline-none focus:border-indigo-500/50 transition cursor-pointer text-sm">
                <option value="same_for_everyone" className="bg-[#060d1c]">Same for Everyone (Default)</option>
                <option value="randomize" className="bg-[#060d1c]">Randomize</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Option Order</label>
              <select value={optionOrder} onChange={e => setOptionOrder(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/4 border border-white/8 text-white focus:outline-none focus:border-indigo-500/50 transition cursor-pointer text-sm">
                <option value="same_for_everyone" className="bg-[#060d1c]">Same for Everyone (Default)</option>
                <option value="randomize" className="bg-[#060d1c]">Randomize</option>
              </select>
            </div>
          </div>

          {/* Late Join & Max Players */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Late Join Policy</label>
              <select value={lateJoinPolicy} onChange={e => setLateJoinPolicy(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/4 border border-white/8 text-white focus:outline-none focus:border-indigo-500/50 transition cursor-pointer text-sm">
                <option value="disable_after_start" className="bg-[#060d1c]">Disable After Start (Default)</option>
                <option value="until_q1_ends" className="bg-[#060d1c]">Until Question 1 Ends</option>
                <option value="until_q3" className="bg-[#060d1c]">Until Question 3 Ends</option>
                <option value="allow_anytime" className="bg-[#060d1c]">Allow Anytime</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Max Players</label>
              <Input type="number" min={1} max={500} value={maxPlayers} onChange={e => setMaxPlayers(parseInt(e.target.value) || 50)}
                className="bg-white/4 border-white/8 text-white focus:border-indigo-500/50 text-sm" />
            </div>
          </div>

          {/* Toggles: End Mode & Require Host */}
          <div className="bg-white/2 border border-white/5 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium">Require Host to Start</span>
              <input type="checkbox" checked={requireHostToStart} onChange={e => setRequireHostToStart(e.target.checked)} className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-indigo-500/30" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium">Auto End (vs Host Ends Quiz)</span>
              <input type="checkbox" checked={quizEndMode === "auto_end"} onChange={e => setQuizEndMode(e.target.checked ? "auto_end" : "host_ends")} className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-indigo-500/30" />
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 h-11 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/10 transition cursor-pointer text-xs">
              Cancel
            </button>
            <button type="submit" className="flex-1 h-11 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold rounded-xl shadow-lg border-none transition cursor-pointer text-xs flex items-center justify-center gap-1.5">
              <Play className="h-4 w-4" />
              <span>Launch Session</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
