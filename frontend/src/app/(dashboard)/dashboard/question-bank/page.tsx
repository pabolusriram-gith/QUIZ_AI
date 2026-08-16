"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/services/api";
import { toast } from "sonner";
import {
  Search, Filter, Edit2, Trash2, ChevronLeft, ChevronRight,
  X, Plus, Check, Layers, Sparkles, BookOpen, Tag,
  AlertTriangle, CheckCircle2, Clock, Info, ChevronDown, RotateCcw,
  CheckSquare, Square
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/StatCard";
import Link from "next/link";

interface QuestionOption {
  id: string;
  text: string;
  is_correct: boolean;
  display_order: number;
}

interface Question {
  id: string;
  quiz_id: string;
  quiz_title: string;
  quiz_subject: string;
  text: string;
  difficulty: "easy" | "medium" | "hard";
  topic: string;
  marks: number;
  explanation: string | null;
  question_type: string;
  bloom_level: string | null;
  subtopic: string | null;
  estimated_time: number | null;
  negative_marks: number;
  hint: string | null;
  ai_generated: boolean;
  generated_by_ai: boolean;
  order_index: number;
  created_at: string | null;
  updated_at: string | null;
  options: QuestionOption[];
}

interface PaginatedResponse {
  total: number;
  skip: number;
  limit: number;
  items: Question[];
}

const DIFFICULTY_OPTIONS = ["easy", "medium", "hard"] as const;
const TYPE_OPTIONS = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "multiple_select", label: "Multiple Select" },
  { value: "true_false", label: "True / False" },
  { value: "fill_in_the_blank", label: "Fill in the Blank" },
  { value: "short_answer", label: "Short Answer" },
];
const PAGE_SIZE = 10;

const difficultyConfig: Record<string, { label: string; cls: string; dot: string }> = {
  easy: {
    label: "Easy",
    cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    dot: "bg-emerald-500",
  },
  medium: {
    label: "Medium",
    cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    dot: "bg-amber-500",
  },
  hard: {
    label: "Hard",
    cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    dot: "bg-rose-500",
  },
};

const typeLabel = (t: string) => TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t.replace(/_/g, " ");

// =====================================================================
// Edit Question Modal
// =====================================================================
interface EditModalProps {
  question: Question;
  onClose: () => void;
  onSaved: (u: Question) => void;
}

function EditModal({ question, onClose, onSaved }: EditModalProps) {
  const [text, setText] = useState(question.text);
  const [difficulty, setDifficulty] = useState(question.difficulty);
  const [topic, setTopic] = useState(question.topic);
  const [marks, setMarks] = useState(question.marks);
  const [negativeMarks, setNegativeMarks] = useState(question.negative_marks);
  const [explanation, setExplanation] = useState(question.explanation ?? "");
  const [hint, setHint] = useState(question.hint ?? "");
  const [bloomLevel, setBloomLevel] = useState(question.bloom_level ?? "");
  const [questionType, setQuestionType] = useState(question.question_type);
  const [options, setOptions] = useState<QuestionOption[]>(
    question.options.length > 0
      ? [...question.options]
      : [
          { id: "new-0", text: "", is_correct: true, display_order: 0 },
          { id: "new-1", text: "", is_correct: false, display_order: 1 },
        ]
  );
  const [saving, setSaving] = useState(false);
  const needsOptions = ["multiple_choice", "multiple_select", "true_false"].includes(questionType);

  const addOption = () =>
    setOptions((p) => [
      ...p,
      { id: `new-${Date.now()}`, text: "", is_correct: false, display_order: p.length },
    ]);

  const removeOption = (idx: number) => setOptions((p) => p.filter((_, i) => i !== idx));

  const updateOption = (idx: number, field: keyof QuestionOption, value: string | boolean) =>
    setOptions((p) => p.map((o, i) => (i === idx ? { ...o, [field]: value } : o)));

  const toggleCorrect = (idx: number) => {
    if (questionType === "multiple_choice" || questionType === "true_false") {
      setOptions((p) => p.map((o, i) => ({ ...o, is_correct: i === idx })));
    } else {
      setOptions((p) => p.map((o, i) => (i === idx ? { ...o, is_correct: !o.is_correct } : o)));
    }
  };

  const handleSave = async () => {
    if (!text.trim()) return toast.error("Question text is required.");
    if (!topic.trim()) return toast.error("Topic is required.");
    if (marks < 0) return toast.error("Marks must be 0 or more.");
    if (needsOptions) {
      const filled = options.filter((o) => o.text.trim());
      if (filled.length < 2) return toast.error("At least 2 options required.");
      if (!filled.some((o) => o.is_correct)) return toast.error("Mark at least one correct answer.");
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        text,
        difficulty,
        topic,
        marks,
        negative_marks: negativeMarks,
        explanation: explanation || null,
        hint: hint || null,
        bloom_level: bloomLevel || null,
        question_type: questionType,
      };
      if (needsOptions) {
        payload.options = options
          .filter((o) => o.text.trim())
          .map((o, i) => ({
            id: o.id.startsWith("new-") ? undefined : o.id,
            text: o.text,
            is_correct: o.is_correct,
            display_order: i,
          }));
      }
      const res = await api.patch(`/quizzes/${question.quiz_id}/questions/${question.id}`, payload);
      toast.success("Question updated successfully!");
      onSaved({
        ...question,
        ...res.data,
        quiz_title: question.quiz_title,
        quiz_subject: question.quiz_subject,
      });
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          "Failed to update question."
      );
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
        className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Edit2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                Edit Question
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate max-w-sm">
                From quiz: {question.quiz_title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Question Text */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Question Content <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className="w-full px-3.5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition resize-none leading-relaxed"
              placeholder="Enter question text..."
            />
          </div>

          {/* Type & Difficulty */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Question Type
              </label>
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition cursor-pointer"
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value} className="bg-white dark:bg-slate-900">
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition cursor-pointer"
              >
                {DIFFICULTY_OPTIONS.map((d) => (
                  <option key={d} value={d} className="bg-white dark:bg-slate-900 capitalize">
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Topic, Marks, Negative Marks */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Topic <span className="text-rose-500">*</span>
              </label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Data Structures"
                className="bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Marks / Points
              </label>
              <Input
                type="number"
                min={0}
                value={marks}
                onChange={(e) => setMarks(Number(e.target.value))}
                className="bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Neg. Marks
              </label>
              <Input
                type="number"
                min={0}
                step={0.25}
                value={negativeMarks}
                onChange={(e) => setNegativeMarks(Number(e.target.value))}
                className="bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white h-10"
              />
            </div>
          </div>

          {/* Options Manager */}
          {needsOptions && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Answer Options
                </label>
                {questionType !== "true_false" && (
                  <button
                    type="button"
                    onClick={addOption}
                    className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-semibold cursor-pointer transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Choice
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div
                    key={opt.id}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                      opt.is_correct
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleCorrect(idx)}
                      className={`h-6 w-6 shrink-0 rounded-lg border flex items-center justify-center cursor-pointer transition-all ${
                        opt.is_correct
                          ? "bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/20"
                          : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400 hover:border-emerald-500/40"
                      }`}
                      title={opt.is_correct ? "Marked as correct" : "Click to mark as correct"}
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </button>
                    <Input
                      value={opt.text}
                      onChange={(e) => updateOption(idx, "text", e.target.value)}
                      placeholder={`Choice ${String.fromCharCode(65 + (idx % 26))} text...`}
                      className="flex-1 bg-transparent border-none text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white/5 h-8 text-sm shadow-none"
                    />
                    {questionType !== "true_false" && options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(idx)}
                        className="h-7 w-7 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Remove choice"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">
                {questionType === "multiple_choice" || questionType === "true_false"
                  ? "Click the checkmark icon to set the single correct answer."
                  : "Click checkmarks to select all applicable correct choices."}
              </p>
            </div>
          )}

          {/* Explanation & Hint */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Explanation (Optional)
              </label>
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition resize-none leading-relaxed"
                placeholder="Explain why the answer is correct..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Hint (Optional)
              </label>
              <textarea
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition resize-none leading-relaxed"
                placeholder="Provide a clue for test takers..."
              />
            </div>
          </div>

          {/* Bloom Taxonomy */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Bloom&apos;s Taxonomy Level
            </label>
            <select
              value={bloomLevel}
              onChange={(e) => setBloomLevel(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition cursor-pointer"
            >
              <option value="" className="bg-white dark:bg-slate-900">
                Not specified
              </option>
              {["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"].map((l) => (
                <option key={l} value={l.toLowerCase()} className="bg-white dark:bg-slate-900">
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800">
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
// Delete Single Question Modal
// =====================================================================
interface DeleteModalProps {
  question: Question;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

function DeleteModal({ question, onClose, onDeleted }: DeleteModalProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/quizzes/${question.quiz_id}/questions/${question.id}`);
      toast.success("Question deleted.");
      onDeleted(question.id);
    } catch {
      toast.error("Failed to delete question.");
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
              Delete Question?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              This will permanently remove this question and its options from the quiz.
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 italic line-clamp-2">
              &ldquo;{question.text}&rdquo;
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
// Delete All Questions Modal
// =====================================================================
interface DeleteAllModalProps {
  totalCount: number;
  onClose: () => void;
  onDeleted: () => void;
}

function DeleteAllModal({ totalCount, onClose, onDeleted }: DeleteAllModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");

  const handleDeleteAll = async () => {
    if (confirmInput.trim().toUpperCase() !== "DELETE") {
      return toast.error("Please type DELETE to confirm.");
    }
    setDeleting(true);
    try {
      await api.delete("/quizzes/questions");
      toast.success("All questions have been deleted from your Question Bank.");
      onDeleted();
    } catch {
      toast.error("Failed to delete questions.");
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
        className="relative z-10 w-full max-w-md rounded-3xl border border-rose-500/30 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-6 shadow-2xl space-y-5"
      >
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0 text-rose-500">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
              Delete All Questions?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              You are about to permanently purge all <strong className="text-rose-500">{totalCount}</strong> questions in your Question Bank. This action cannot be reversed.
            </p>
          </div>
        </div>

        <div className="space-y-2 p-3.5 rounded-2xl bg-rose-500/5 border border-rose-500/20">
          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">
            Type <span className="font-mono text-rose-500 font-extrabold">DELETE</span> to confirm:
          </label>
          <Input
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder="Type DELETE"
            className="bg-white dark:bg-slate-800 border-rose-500/30 text-slate-900 dark:text-white font-mono text-xs h-9"
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteAll}
            disabled={deleting || confirmInput.trim().toUpperCase() !== "DELETE"}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1.5 shadow-sm shadow-rose-500/20"
          >
            {deleting ? (
              <>
                <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Deleting All...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span>Confirm Delete All</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// =====================================================================
// Main Question Bank Page Component
// =====================================================================
export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [editQuestion, setEditQuestion] = useState<Question | null>(null);
  const [deleteQuestion, setDeleteQuestion] = useState<Question | null>(null);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
    setSelectedIds(new Set());
  }, [filterDifficulty, filterType]);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (filterDifficulty) params.difficulty = filterDifficulty;
      if (filterType) params.question_type = filterType;
      const res = await api.get<PaginatedResponse>("/quizzes/questions", { params });
      setQuestions(res.data.items);
      setTotal(res.data.total);
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          "Failed to load question bank."
      );
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filterDifficulty, filterType]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleSaved = (updated: Question) => {
    setQuestions((p) => p.map((q) => (q.id === updated.id ? updated : q)));
    setEditQuestion(null);
  };

  const handleDeleted = (id: string) => {
    setQuestions((p) => p.filter((q) => q.id !== id));
    setTotal((t) => Math.max(0, t - 1));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setDeleteQuestion(null);
  };

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setFilterDifficulty("");
    setFilterType("");
    setPage(1);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === questions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(questions.map((q) => q.id)));
    }
  };

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    toast.loading(`Deleting ${selectedIds.size} selected questions...`, { id: "bulk-del" });
    try {
      const idsToDelete = Array.from(selectedIds);
      for (const id of idsToDelete) {
        const targetQ = questions.find((q) => q.id === id);
        if (targetQ) {
          await api.delete(`/quizzes/${targetQ.quiz_id}/questions/${targetQ.id}`);
        }
      }
      toast.success(`${selectedIds.size} questions deleted.`, { id: "bulk-del" });
      setSelectedIds(new Set());
      fetchQuestions();
    } catch {
      toast.error("Failed to delete some questions.", { id: "bulk-del" });
    }
  };

  const hasActiveFilters = !!(search || filterDifficulty || filterType);
  const aiCount = questions.filter((q) => q.ai_generated || q.generated_by_ai).length;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Question Bank"
        description={`Manage and search across all ${total.toLocaleString()} questions across your created quizzes.`}
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Total Questions"
          value={total}
          icon={<Layers className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />}
          glowColor="indigo"
        />
        <StatCard
          title="Easy Level"
          value={questions.filter((q) => q.difficulty === "easy").length}
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />}
          glowColor="emerald"
        />
        <StatCard
          title="Hard Level"
          value={questions.filter((q) => q.difficulty === "hard").length}
          icon={<Info className="h-5 w-5 text-rose-500 dark:text-rose-400" />}
          glowColor="rose"
        />
        <StatCard
          title="AI Generated"
          value={aiCount}
          icon={<Sparkles className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />}
          glowColor="cyan"
        />
      </div>

      {/* Search Toolbar & Filter Row */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="glass-panel rounded-3xl p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions by text stem, topic, or subtopic..."
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

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                showFilters || hasActiveFilters
                  ? "bg-indigo-500/15 border-indigo-500/35 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="h-4 w-4 rounded-full bg-indigo-600 text-[9px] font-extrabold text-white flex items-center justify-center">
                  {[filterDifficulty, filterType, debouncedSearch].filter(Boolean).length}
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

            {total > 0 && (
              <button
                onClick={() => setShowDeleteAll(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold bg-rose-500/10 hover:bg-rose-600 border border-rose-500/20 hover:border-rose-600 text-rose-600 dark:text-rose-400 hover:text-white transition-all cursor-pointer shadow-sm shadow-rose-500/5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete All</span>
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden pt-3 border-t border-slate-200 dark:border-slate-800"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Difficulty Level
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {["", ...DIFFICULTY_OPTIONS].map((d) => (
                      <button
                        key={d}
                        onClick={() => setFilterDifficulty(d)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          filterDifficulty === d
                            ? d === ""
                              ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-600 dark:text-indigo-300"
                              : d === "easy"
                              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-emerald-300"
                              : d === "medium"
                              ? "bg-amber-500/20 border-amber-500/40 text-amber-600 dark:text-amber-300"
                              : "bg-rose-500/20 border-rose-500/40 text-rose-600 dark:text-rose-300"
                            : "bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {d === "" ? "All Levels" : d.charAt(0).toUpperCase() + d.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Question Format
                  </label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 transition cursor-pointer"
                  >
                    <option value="" className="bg-white dark:bg-slate-900">
                      All Formats
                    </option>
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value} className="bg-white dark:bg-slate-900">
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bulk Selection Action Bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 text-xs font-semibold">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-300">
              <CheckSquare className="h-4 w-4" />
              <span>{selectedIds.size} question{selectedIds.size > 1 ? "s" : ""} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Clear
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Selected</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Questions List Container */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
        className="glass-panel rounded-3xl overflow-hidden shadow-sm"
      >
        {/* Table Header */}
        <div className="hidden sm:grid grid-cols-[40px_minmax(0,1fr)_140px_120px_110px_90px_80px] gap-4 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-slate-400 hover:text-indigo-500 cursor-pointer"
              title="Select all on this page"
            >
              {selectedIds.size === questions.length && questions.length > 0 ? (
                <CheckSquare className="h-4 w-4 text-indigo-500" />
              ) : (
                <Square className="h-4 w-4" />
              )}
            </button>
          </div>
          <span>Question</span>
          <span>Quiz Context</span>
          <span>Topic</span>
          <span>Format</span>
          <span>Difficulty</span>
          <span className="text-right">Actions</span>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="h-9 w-9 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Loading Question Bank...
            </p>
          </div>
        ) : questions.length === 0 ? (
          /* Empty State */
          <div className="py-20 flex flex-col items-center justify-center gap-4 px-4 text-center">
            <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
              <BookOpen className="h-7 w-7" />
            </div>
            <div className="space-y-1 max-w-sm">
              <p className="text-base font-bold text-slate-900 dark:text-white font-display">
                No questions found
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {hasActiveFilters
                  ? "No questions match your current search and filter settings. Try adjusting or clearing filters."
                  : "Your question bank is currently empty. Generate questions with AI or build custom quizzes to populate it."}
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
          /* Question Rows */
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {questions.map((q, idx) => {
              const isExpanded = expandedId === q.id;
              const isSelected = selectedIds.has(q.id);
              const diff = difficultyConfig[q.difficulty] ?? difficultyConfig.medium;

              return (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15, delay: idx * 0.015 }}
                >
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : q.id)}
                    className={`group flex flex-col sm:grid sm:grid-cols-[40px_minmax(0,1fr)_140px_120px_110px_90px_80px] gap-4 px-5 py-4 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors cursor-pointer ${
                      isSelected ? "bg-indigo-500/5 dark:bg-indigo-500/10" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className="hidden sm:flex items-center justify-center"
                      onClick={(e) => toggleSelectOne(q.id, e)}
                    >
                      <button type="button" className="text-slate-400 hover:text-indigo-500 cursor-pointer">
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-indigo-500" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    {/* Question text stem */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                        {q.ai_generated || q.generated_by_ai ? (
                          <Sparkles className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                        ) : (
                          <Tag className="h-3.5 w-3.5 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-cyan-400 transition-colors">
                          {q.text}
                        </p>
                        {/* Mobile metadata tags */}
                        <div className="sm:hidden flex flex-wrap items-center gap-2 mt-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${diff.cls}`}>
                            {diff.label}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {typeLabel(q.question_type)}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[150px]">
                            • {q.quiz_title}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Context Quiz Title */}
                    <div className="hidden sm:flex items-center text-xs text-slate-500 dark:text-slate-400 truncate" title={q.quiz_title}>
                      {q.quiz_title}
                    </div>

                    {/* Topic */}
                    <div className="hidden sm:flex items-center text-xs text-slate-600 dark:text-slate-300 font-medium truncate">
                      {q.topic || "—"}
                    </div>

                    {/* Question Format */}
                    <div className="hidden sm:flex items-center text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {typeLabel(q.question_type)}
                    </div>

                    {/* Difficulty Badge */}
                    <div className="hidden sm:flex items-center">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${diff.cls}`}>
                        {diff.label}
                      </span>
                    </div>

                    {/* Actions Column */}
                    <div
                      className="hidden sm:flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => setEditQuestion(q)}
                        className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                        title="Edit Question"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteQuestion(q)}
                        className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Delete Question"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Accordion Details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden bg-slate-50/80 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800/80 px-6 py-4 space-y-4"
                      >
                        {/* Options Section */}
                        {q.options && q.options.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Configured Choices
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {q.options.map((opt, oIdx) => (
                                <div
                                  key={opt.id}
                                  className={`flex items-start gap-2.5 px-3 py-2 rounded-xl text-xs font-medium border ${
                                    opt.is_correct
                                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold"
                                      : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                                  }`}
                                >
                                  <span
                                    className={`h-4.5 w-4.5 rounded-md flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold ${
                                      opt.is_correct
                                        ? "bg-emerald-500 text-white"
                                        : "bg-slate-100 dark:bg-slate-700 text-slate-400"
                                    }`}
                                  >
                                    {String.fromCharCode(65 + (oIdx % 26))}
                                  </span>
                                  <span className="flex-1">{opt.text}</span>
                                  {opt.is_correct && (
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-extrabold shrink-0">
                                      Correct
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Metadata Tag Row */}
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400 pt-1">
                          <span>
                            Points: <strong className="text-slate-900 dark:text-white">{q.marks}</strong>
                          </span>
                          {q.negative_marks > 0 && (
                            <span>
                              Negative: <strong className="text-rose-500">-{q.negative_marks}</strong>
                            </span>
                          )}
                          {q.bloom_level && (
                            <span>
                              Bloom Level: <strong className="text-slate-900 dark:text-white capitalize">{q.bloom_level}</strong>
                            </span>
                          )}
                          {q.estimated_time && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{q.estimated_time}s</span>
                            </span>
                          )}
                          {(q.ai_generated || q.generated_by_ai) && (
                            <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 font-semibold">
                              <Sparkles className="h-3 w-3" />
                              <span>AI Generated</span>
                            </span>
                          )}
                        </div>

                        {/* Explanations & Hints */}
                        {q.explanation && (
                          <div className="p-3 rounded-2xl bg-indigo-500/5 border border-indigo-500/15">
                            <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">
                              Explanation
                            </p>
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                              {q.explanation}
                            </p>
                          </div>
                        )}

                        {q.hint && (
                          <div className="p-3 rounded-2xl bg-cyan-500/5 border border-cyan-500/15">
                            <p className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider mb-1">
                              Hint
                            </p>
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                              {q.hint}
                            </p>
                          </div>
                        )}

                        {/* Mobile action bar */}
                        <div className="flex items-center gap-2 sm:hidden pt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditQuestion(q);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20"
                          >
                            <Edit2 className="h-3 w-3" /> Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteQuestion(q);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
              of <span className="text-slate-900 dark:text-white font-bold">{total}</span> questions
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

      {/* Modal Dialogs */}
      <AnimatePresence>
        {editQuestion && (
          <EditModal
            key="edit-modal"
            question={editQuestion}
            onClose={() => setEditQuestion(null)}
            onSaved={handleSaved}
          />
        )}
        {deleteQuestion && (
          <DeleteModal
            key="del-modal"
            question={deleteQuestion}
            onClose={() => setDeleteQuestion(null)}
            onDeleted={handleDeleted}
          />
        )}
        {showDeleteAll && (
          <DeleteAllModal
            key="del-all-modal"
            totalCount={total}
            onClose={() => setShowDeleteAll(false)}
            onDeleted={() => {
              setShowDeleteAll(false);
              fetchQuestions();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
