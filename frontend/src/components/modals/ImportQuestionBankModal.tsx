"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Download,
  ArrowRight,
  Layers,
  HelpCircle,
  Sparkles,
  FileSpreadsheet,
  FileCode,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import api from "@/services/api";
import { toast } from "sonner";

interface QuizOption {
  id: string;
  title: string;
  subject: string;
  questions_count: number;
}

interface QuestionPreview {
  text: string;
  question_type: string;
  difficulty: string;
  marks: number;
  negative_marks?: number;
  topic?: string;
  explanation?: string;
  options?: Array<{ text: string; is_correct: boolean; display_order?: number }>;
}

interface ValidationError {
  row: number;
  error: string;
}

interface ImportQuestionBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
  initialQuizId?: string;
}

export default function ImportQuestionBankModal({
  isOpen,
  onClose,
  onImportSuccess,
  initialQuizId,
}: ImportQuestionBankModalProps) {
  const [quizzes, setQuizzes] = useState<QuizOption[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [selectedQuizId, setSelectedQuizId] = useState<string>(initialQuizId || "");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);

  // Preview & Validation State
  const [previewQuestions, setPreviewQuestions] = useState<QuestionPreview[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [totalParsed, setTotalParsed] = useState(0);
  const [showErrorsList, setShowErrorsList] = useState(true);
  const [showPreviewList, setShowPreviewList] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch teacher's quizzes for target destination
  const fetchTeacherQuizzes = useCallback(async () => {
    setLoadingQuizzes(true);
    try {
      const res = await api.get<{ items: Array<{ id: string; title: string; subject: string; questions?: any[] }> }>("/quizzes", {
        params: { limit: 100 },
      });
      const items = res.data.items || [];
      const mapped = items.map((q) => ({
        id: q.id,
        title: q.title,
        subject: q.subject,
        questions_count: q.questions ? q.questions.length : 0,
      }));
      setQuizzes(mapped);
      if (!selectedQuizId && mapped.length > 0) {
        setSelectedQuizId(mapped[0].id);
      }
    } catch {
      toast.error("Failed to load your existing quizzes.");
    } finally {
      setLoadingQuizzes(false);
    }
  }, [selectedQuizId]);

  useEffect(() => {
    if (isOpen) {
      fetchTeacherQuizzes();
      if (initialQuizId) {
        setSelectedQuizId(initialQuizId);
      }
    } else {
      // Reset state when closed
      setFile(null);
      setPreviewQuestions([]);
      setValidationErrors([]);
      setTotalParsed(0);
    }
  }, [isOpen, fetchTeacherQuizzes, initialQuizId]);

  // Handle Validation Preview
  const handleValidateFile = async (uploadedFile: File, quizId: string) => {
    if (!quizId) {
      toast.error("Please select a destination quiz first.");
      return;
    }
    setValidating(true);
    try {
      const formData = new FormData();
      formData.append("quiz_id", quizId);
      formData.append("file", uploadedFile);
      formData.append("preview_only", "true");

      const res = await api.post<{
        status: string;
        total_parsed: number;
        valid_count: number;
        error_count: number;
        errors: ValidationError[];
        preview_questions: QuestionPreview[];
      }>("/quizzes/questions/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setTotalParsed(res.data.total_parsed);
      setPreviewQuestions(res.data.preview_questions || []);
      setValidationErrors(res.data.errors || []);

      if (res.data.valid_count > 0 && res.data.error_count === 0) {
        toast.success(`File validated: ${res.data.valid_count} questions ready for import.`);
      } else if (res.data.valid_count > 0 && res.data.error_count > 0) {
        toast.warning(
          `Validated ${res.data.valid_count} questions. Found ${res.data.error_count} row errors.`
        );
      } else {
        toast.error(`Validation failed: No valid questions found in file.`);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string | { message?: string } } } })?.response
          ?.data?.detail;
      const displayMsg = typeof msg === "string" ? msg : msg?.message || "Failed to validate file.";
      toast.error(displayMsg);
      setPreviewQuestions([]);
      setValidationErrors([]);
    } finally {
      setValidating(false);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      const name = selected.name.toLowerCase();
      if (!name.endsWith(".csv") && !name.endsWith(".json")) {
        toast.error("Invalid file format. Please upload a .csv or .json file.");
        return;
      }
      setFile(selected);
      handleValidateFile(selected, selectedQuizId);
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      const name = dropped.name.toLowerCase();
      if (!name.endsWith(".csv") && !name.endsWith(".json")) {
        toast.error("Invalid file format. Please upload a .csv or .json file.");
        return;
      }
      setFile(dropped);
      handleValidateFile(dropped, selectedQuizId);
    }
  };

  // Download Sample Template Helpers
  const downloadTemplate = async (format: "csv" | "json") => {
    try {
      const res = await api.get(`/quizzes/questions/template/${format}`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: format === "csv" ? "text/csv" : "application/json",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `quizverse_question_bank_template.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`Downloaded sample ${format.toUpperCase()} template.`);
    } catch {
      toast.error(`Failed to download ${format.toUpperCase()} template.`);
    }
  };

  // Execute Final Import
  const handleExecuteImport = async () => {
    if (!file) {
      toast.error("Please upload a CSV or JSON file.");
      return;
    }
    if (!selectedQuizId) {
      toast.error("Please select a destination quiz.");
      return;
    }
    if (previewQuestions.length === 0) {
      toast.error("No valid questions found to import.");
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("quiz_id", selectedQuizId);
      formData.append("file", file);
      formData.append("preview_only", "false");

      const res = await api.post<{
        status: string;
        quiz_title: string;
        total_imported: number;
        error_count: number;
      }>("/quizzes/questions/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success(
        `Successfully imported ${res.data.total_imported} questions into "${res.data.quiz_title}".`
      );
      onImportSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string | { message?: string } } } })?.response
          ?.data?.detail;
      const displayMsg =
        typeof msg === "string" ? msg : msg?.message || "Import failed. Transaction rolled back.";
      toast.error(displayMsg);
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 dark:bg-slate-950/85 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-indigo-400/25 bg-white dark:bg-[#0c193e] text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-indigo-400/20 bg-slate-50/50 dark:bg-[#0a1538]/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-display text-slate-900 dark:text-white">
                Import Question Bank
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bulk upload structured questions via CSV or JSON into your assessments.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto">
          {/* Step 1: Destination Quiz Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-indigo-500" />
              <span>Destination Quiz (Required)</span>
            </label>

            {loadingQuizzes ? (
              <div className="h-11 rounded-2xl bg-slate-100 dark:bg-slate-800/40 animate-pulse" />
            ) : quizzes.length === 0 ? (
              <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300 text-xs flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span>
                  No existing quizzes found. Please create at least one quiz first before importing questions.
                </span>
              </div>
            ) : (
              <select
                value={selectedQuizId}
                onChange={(e) => {
                  setSelectedQuizId(e.target.value);
                  if (file) handleValidateFile(file, e.target.value);
                }}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-[#132356]/85 border border-slate-200 dark:border-indigo-400/30 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer shadow-xs"
              >
                {quizzes.map((q) => (
                  <option key={q.id} value={q.id} className="bg-white dark:bg-[#0c193e] py-1">
                    {q.title} ({q.subject}) &bull; {q.questions_count} current questions
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Step 2: Download Templates & Upload Zone */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-indigo-500" />
                <span>Upload Question File (.csv / .json)</span>
              </label>

              {/* Download Sample Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadTemplate("csv")}
                  className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-300 hover:text-indigo-500 px-2.5 py-1 rounded-xl bg-indigo-500/10 border border-indigo-500/20 transition-colors cursor-pointer"
                  title="Download sample CSV format"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Sample CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadTemplate("json")}
                  className="flex items-center gap-1 text-[11px] font-bold text-cyan-600 dark:text-cyan-300 hover:text-cyan-500 px-2.5 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/20 transition-colors cursor-pointer"
                  title="Download sample JSON format"
                >
                  <FileCode className="h-3.5 w-3.5" />
                  <span>Sample JSON</span>
                </button>
              </div>
            </div>

            {/* Drag & Drop File Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-indigo-500 bg-indigo-500/10 scale-[1.01]"
                  : file
                  ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/10"
                  : "border-slate-200 dark:border-indigo-400/25 hover:border-indigo-400/50 bg-slate-50/50 dark:bg-[#101e4a]/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .json, text/csv, application/json"
                onChange={onFileSelect}
                className="hidden"
              />

              <div className="flex flex-col items-center justify-center space-y-2">
                <div
                  className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-transform ${
                    file
                      ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30"
                      : "bg-indigo-500/15 text-indigo-500 border border-indigo-500/30"
                  }`}
                >
                  {file ? <CheckCircle2 className="h-6 w-6" /> : <UploadCloud className="h-6 w-6" />}
                </div>

                {file ? (
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{file.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {(file.size / 1024).toFixed(1)} KB &bull; Click or drop another file to replace
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Click to browse or drag and drop your file here
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Supports Standard CSV or JSON Question Arrays
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 3: Validation Summary & Live Preview */}
          {validating && (
            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center gap-2.5 text-xs text-indigo-600 dark:text-indigo-400">
              <span className="h-4 w-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <span>Validating question structure and options...</span>
            </div>
          )}

          {file && !validating && (
            <div className="space-y-4 pt-1">
              {/* Status Header Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#101e4a]/70 border border-slate-200 dark:border-indigo-400/20">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Total Parsed
                  </span>
                  <span className="text-lg font-extrabold text-slate-900 dark:text-white font-display">
                    {totalParsed}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                    Valid Questions
                  </span>
                  <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 font-display">
                    {previewQuestions.length}
                  </span>
                </div>

                <div
                  className={`p-3.5 rounded-2xl border ${
                    validationErrors.length > 0
                      ? "bg-rose-500/10 border-rose-500/30"
                      : "bg-slate-50 dark:bg-[#101e4a]/70 border-slate-200 dark:border-indigo-400/20"
                  }`}
                >
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider block ${
                      validationErrors.length > 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-slate-400"
                    }`}
                  >
                    Errors / Skipped
                  </span>
                  <span
                    className={`text-lg font-extrabold font-display ${
                      validationErrors.length > 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-slate-900 dark:text-white"
                    }`}
                  >
                    {validationErrors.length}
                  </span>
                </div>
              </div>

              {/* Validation Errors Expandable */}
              {validationErrors.length > 0 && (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowErrorsList(!showErrorsList)}
                    className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-400 cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>Validation Errors ({validationErrors.length} invalid rows)</span>
                    </span>
                    {showErrorsList ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  {showErrorsList && (
                    <div className="px-4 pb-3 space-y-1.5 max-h-36 overflow-y-auto border-t border-rose-500/20 pt-2">
                      {validationErrors.map((err, idx) => (
                        <div
                          key={idx}
                          className="text-[11px] text-rose-700 dark:text-rose-300 flex items-start gap-2 font-mono"
                        >
                          <span className="font-bold shrink-0 bg-rose-500/20 px-1.5 py-0.5 rounded text-[10px]">
                            Row {err.row}
                          </span>
                          <span className="leading-snug">{err.error}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Questions Preview Expandable */}
              {previewQuestions.length > 0 && (
                <div className="rounded-2xl border border-slate-200 dark:border-indigo-400/20 bg-slate-50/50 dark:bg-[#101e4a]/60 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowPreviewList(!showPreviewList)}
                    className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Preview Valid Questions ({previewQuestions.length})</span>
                    </span>
                    {showPreviewList ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  {showPreviewList && (
                    <div className="px-4 pb-3 space-y-2 max-h-52 overflow-y-auto border-t border-slate-200 dark:border-indigo-400/20 pt-3">
                      {previewQuestions.slice(0, 15).map((q, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-white dark:bg-[#0c193e] border border-slate-200 dark:border-indigo-400/20 space-y-1.5 text-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-slate-900 dark:text-white line-clamp-2">
                              {idx + 1}. {q.text}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                              {q.question_type.replace(/_/g, " ")} &bull; {q.marks} pt
                            </span>
                          </div>

                          {q.options && q.options.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                              {q.options.map((opt, oIdx) => (
                                <div
                                  key={oIdx}
                                  className={`px-2 py-1 rounded-lg text-[11px] flex items-center gap-1.5 border ${
                                    opt.is_correct
                                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold"
                                      : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300"
                                  }`}
                                >
                                  {opt.is_correct && <Check className="h-3 w-3 text-emerald-500 shrink-0" />}
                                  <span className="truncate">{opt.text}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {previewQuestions.length > 15 && (
                        <p className="text-[11px] text-slate-400 text-center italic">
                          + {previewQuestions.length - 15} more valid questions will be imported
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-indigo-400/20 bg-slate-50/70 dark:bg-[#0a1538]/70">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={
              importing ||
              validating ||
              !file ||
              !selectedQuizId ||
              previewQuestions.length === 0
            }
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-2 shadow-md shadow-indigo-500/20"
          >
            {importing ? (
              <>
                <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Importing Questions...</span>
              </>
            ) : (
              <>
                <span>Import {previewQuestions.length > 0 ? `${previewQuestions.length} Questions` : "Questions"}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
