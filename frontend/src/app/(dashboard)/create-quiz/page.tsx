"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AILoader } from "@/components/ui/AILoader";
import { VoiceWaveform, VoiceState } from "@/components/ui/VoiceWaveform";
import { 
  FileText, 
  MessageSquare, 
  ArrowLeft, 
  ArrowRight,
  PenTool,
  Sparkles,
  CheckCircle2,
  Trash2,
  Plus,
  Save,
  Clock,
  Shuffle,
  Shield,
  Activity,
  ChevronUp,
  ChevronDown,
  Settings,
  ListTodo,
  FileCheck,
  Play,
  RotateCcw,
  Check,
  AlertCircle,
  AlertTriangle,
  ShieldAlert,
  Mic,
  Loader2,
  Volume2,
  UploadCloud,
  Layers,
  Presentation,
  RefreshCw,
  Lightbulb
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/services/api";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";

// Define Interfaces for Question and Option
interface OptionState {
  id: string; // temp or db UUID
  text: string;
  is_correct: boolean;
  display_order: number;
}

interface QuestionState {
  id: string; // temp or db UUID
  text: string;
  difficulty: "easy" | "medium" | "hard";
  topic: string;
  marks: number;
  explanation: string;
  question_type: "multiple_choice" | "multiple_select" | "true_false" | "fill_in_the_blank" | "short_answer";
  bloom_level: string;
  subtopic: string;
  estimated_time: number; // in seconds
  negative_marks: number;
  hint: string;
  ai_generated: boolean;
  version: number;
  order_index: number;
  time_limit_seconds: number | null; // question-specific time
  course_outcome?: string;
  reference?: string;
  ai_provider?: string;
  ai_model?: string;
  generated_by_ai?: boolean;
  generated_at?: string;
  critic_score?: number;
  is_user_modified?: boolean;
  ai_original_json?: string;
  shuffle_seed?: number;
  options: OptionState[];
}

interface QuizState {
  title: string;
  description: string;
  subject: string;
  duration: number; // overall time limit in minutes
  randomize_questions: boolean;
  randomize_options: boolean;
  anti_cheating_enabled: boolean;
  ai_feedback_enabled: boolean;
  department: string;
  semester: string;
  total_marks: number;
  pass_percentage: number;
  visibility: "public" | "private";
  status: "draft" | "published";
  language: string;
  fullscreen_required: boolean;
  adaptive_mode: boolean;
  allow_review: boolean;
  start_time: string | null;
  end_time: string | null;
  quiz_code: string;
  max_attempts: number;
  timer_mode: "none" | "overall" | "per_question" | "both";
  overall_time_limit_seconds: number | null;
  auto_submit_on_expiry: boolean;
  available_from: string | null;
  available_until: string | null;
  result_visibility: "immediate" | "after_due_date" | "manual_release" | "never";
  show_score: boolean;
  show_answers: boolean;
  show_explanations: boolean;
  show_solutions: boolean;
  show_marks: boolean;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  access_code: string;
  custom_instructions: string;
  ai_provider?: string;
  ai_model?: string;
  generation_prompt?: string;
  generated_by_ai?: boolean;
  generation_source?: string;
  generated_at?: string;
  marks_mode?: "default" | "auto";
  default_marks?: number;
  questions: QuestionState[];
}

const PREDEFINED_QUESTION_TIMERS = [
  { label: "10s", value: 10 },
  { label: "20s", value: 20 },
  { label: "30s", value: 30 },
  { label: "45s", value: 45 },
  { label: "1m", value: 60 },
  { label: "2m", value: 120 },
  { label: "3m", value: 180 },
  { label: "5m", value: 300 },
];

const PREDEFINED_OVERALL_TIMERS = [
  { label: "1m", value: 60 },
  { label: "2m", value: 120 },
  { label: "3m", value: 180 },
  { label: "5m", value: 300 },
  { label: "10m", value: 600 },
  { label: "15m", value: 900 },
  { label: "30m", value: 1800 },
  { label: "1h", value: 3600 },
  { label: "2h", value: 7200 },
];

function CreateQuizContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourceParam = searchParams.get("source");

  const [view, setView] = useState<"choice" | "ai-generator" | "loading" | "editor" | "success">("choice");
  const [activeTab, setActiveTab] = useState<"questions" | "details" | "schedule" | "preview">("questions");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (sourceParam === "file") {
      setView("ai-generator");
      setSourceType("file");
    }
  }, [sourceParam]);

  // Initialize Quiz State
  const [quiz, setQuiz] = useState<QuizState>({
    title: "",
    description: "",
    subject: "",
    duration: 10,
    randomize_questions: false,
    randomize_options: false,
    anti_cheating_enabled: false,
    ai_feedback_enabled: false,
    department: "",
    semester: "",
    total_marks: 0,
    pass_percentage: 40,
    visibility: "public",
    status: "draft",
    language: "en",
    fullscreen_required: false,
    adaptive_mode: false,
    allow_review: true,
    start_time: null,
    end_time: null,
    quiz_code: "",
    max_attempts: 1,
    timer_mode: "none",
    overall_time_limit_seconds: null,
    auto_submit_on_expiry: true,
    available_from: null,
    available_until: null,
    result_visibility: "immediate",
    show_score: true,
    show_answers: true,
    show_explanations: true,
    show_solutions: true,
    show_marks: true,
    shuffle_questions: false,
    shuffle_options: false,
    access_code: "",
    custom_instructions: "",
    marks_mode: "default",
    default_marks: 1,
    questions: [],
  });

  // Keep track of the currently selected question index in the canvas
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number>(0);

  // Success screen details
  const [savedQuiz, setSavedQuiz] = useState<{ id: string; quiz_code: string; title: string; status: string } | null>(null);
  const [sessionCreating, setSessionCreating] = useState(false);

  // AI Generator Form States
  const [aiProvider, setAiProvider] = useState<string>("auto");
  const [providers, setProviders] = useState<{ id: string; name: string; recommended?: boolean }[]>([
    { id: "auto", name: "Auto", recommended: true },
    { id: "gemini", name: "Gemini" },
    { id: "groq", name: "Groq" },
    { id: "openai", name: "OpenAI" }
  ]);
  const [aiModel, setAiModel] = useState<string>("");
  const [sourceType, setSourceType] = useState<"topic" | "text" | "file">("topic");
  const [topic, setTopic] = useState<string>("");
  const [text, setText] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [bloomLevels, setBloomLevels] = useState<string[]>(["Understand", "Apply"]);
  const [questionTypes, setQuestionTypes] = useState<string[]>(["multiple_choice"]);
  const [courseOutcomes, setCourseOutcomes] = useState<string>("");
  const [questionQuality, setQuestionQuality] = useState<"fast" | "balanced" | "premium">("balanced");
  const [quizStyle, setQuizStyle] = useState<string>("mixed");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [questionDistribution, setQuestionDistribution] = useState<string>("");

  // AI Generated Results / Warnings / Loading
  const [duplicateWarnings, setDuplicateWarnings] = useState<Record<number, { similarity: number; existing_text: string; warning: string }>>({});
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [mismatchData, setMismatchData] = useState<{ parsedCount: number; currentCount: number } | null>(null);

  // Per-question regeneration loading state — null means no regeneration in progress
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [recentlyRegeneratedIndex, setRecentlyRegeneratedIndex] = useState<number | null>(null);

  // Unsaved draft recovery states
  const [draftBanner, setDraftBanner] = useState<{
    title: string;
    questionCount: number;
    savedAt: number;
    source: "manual" | "ai";
  } | null>(null);

  // Horizontal step progress visited tracker
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(["questions"]));

  const fileInputRef = useRef<HTMLInputElement>(null);
  const generalFileInputRef = useRef<HTMLInputElement>(null);
  const pdfFileInputRef = useRef<HTMLInputElement>(null);
  const pptFileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateAndSetFiles = (files: File[]) => {
    const validExtensions = [".pdf", ".ppt", ".pptx"];
    const maxSize = 20 * 1024 * 1024; // 20MB
    const validFiles: File[] = [];
    setValidationError(null);

    for (const file of files) {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!validExtensions.includes(ext)) {
        setValidationError(`Unsupported file type: "${file.name}". Please upload a PDF or PPT/PPTX file.`);
        return;
      }
      if (file.size > maxSize) {
        setValidationError(`The file "${file.name}" exceeds the 20MB size limit. Please choose a smaller file.`);
        return;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      setSelectedFiles(validFiles);
      setValidationError(null);
    }
  };

  // Voice input states
  const [isRecording, setIsRecording] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("ready");
  const [voiceError, setVoiceError] = useState<string>("");
  const [recordingTime, setRecordingTime] = useState(0);
  const [recognition, setRecognition] = useState<any>(null);

  // Prompt enhancement states
  const [enhancementLoading, setEnhancementLoading] = useState(false);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string>("");
  const [recommendation, setRecommendation] = useState<{
    questionCount: number;
    difficulty: "easy" | "medium" | "hard";
    bloomLevels: string[];
    duration: number;
    distribution: string;
  } | null>(null);

  // Keyboard OS platform label detection
  const [osLabel, setOsLabel] = useState("Ctrl");
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isMac = navigator.userAgent.toLowerCase().includes("mac");
      setOsLabel(isMac ? "⌘" : "Ctrl");
    }
  }, []);

  // Fetch active/enabled AI providers on Mount
  useEffect(() => {
    api.get("/ai/providers")
      .then((res) => {
        if (res.data && Array.isArray(res.data.providers)) {
          setProviders(res.data.providers);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch active AI providers:", err);
      });
  }, []);

  // Load saved draft prompt from localStorage on Mount
  // Helper to save draft to localStorage
  const saveDraft = (updatedQuiz: QuizState) => {
    if (typeof window !== "undefined") {
      const isAI = updatedQuiz.questions.some(q => q.generated_by_ai);
      localStorage.setItem(
        "quizverse_editor_draft",
        JSON.stringify({
          quiz: updatedQuiz,
          source: isAI ? "ai" : "manual",
          savedAt: Date.now()
        })
      );
    }
  };

  // Helper to clear draft
  const clearDraft = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("quizverse_editor_draft");
      setDraftBanner(null);
    }
  };

  // Check for unsaved draft on Mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Restore draft prompt first
      const savedPrompt = localStorage.getItem("quizverse_draft_prompt");
      if (savedPrompt && !topic) {
        setTopic(savedPrompt);
      }

      // Check full editor draft
      const savedDraftRaw = localStorage.getItem("quizverse_editor_draft");
      if (savedDraftRaw) {
        try {
          const parsed = JSON.parse(savedDraftRaw);
          // Check expiration: 7 days max age
          const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
          if (Date.now() - parsed.savedAt > MAX_AGE) {
            localStorage.removeItem("quizverse_editor_draft");
            return;
          }

          setDraftBanner({
            title: parsed.quiz.title || "Untitled Draft",
            questionCount: parsed.quiz.questions?.length || 0,
            savedAt: parsed.savedAt,
            source: parsed.source || "manual"
          });
        } catch (e) {
          console.error("Failed to parse unsaved draft:", e);
        }
      }
    }
  }, []);

  // Save prompt to localStorage while editing to prevent data loss
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (topic) {
        localStorage.setItem("quizverse_draft_prompt", topic);
      } else {
        localStorage.removeItem("quizverse_draft_prompt");
      }
    }
  }, [topic]);

  // Restore draft handler
  const handleRestoreDraft = () => {
    if (typeof window !== "undefined") {
      const savedDraftRaw = localStorage.getItem("quizverse_editor_draft");
      if (savedDraftRaw) {
        try {
          const parsed = JSON.parse(savedDraftRaw);
          setQuiz(parsed.quiz);
          setSelectedQuestionIndex(0);
          setView("editor");
          setActiveTab("questions");
          setDraftBanner(null);
          // Pre-populate visited tabs based on restored quiz data
          setVisitedTabs(new Set(["questions"]));
          toast.success("Unsaved draft restored successfully!");
        } catch (e) {
          toast.error("Failed to restore draft.");
        }
      }
    }
  };

  // Discard draft handler
  const handleDiscardDraft = () => {
    clearDraft();
    toast.info("Draft discarded.");
  };

  // Auto-save effect: save draft every 30 seconds
  useEffect(() => {
    if (view === "editor") {
      const timer = setInterval(() => {
        saveDraft(quiz);
      }, 30000);
      return () => clearInterval(timer);
    }
  }, [quiz, view]);

  // Preview Prompt Modal state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Initialize Speech Recognition on Mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "en-US";
        
        rec.onstart = () => {
          setIsRecording(true);
          setVoiceState("listening");
          setVoiceError("");
        };

        rec.onresult = (event: any) => {
          setVoiceState("processing");
          let textResult = "";
          for (let i = 0; i < event.results.length; ++i) {
            textResult += event.results[i][0].transcript;
          }
          if (textResult) {
            setTopic(textResult);
          }
          setTimeout(() => {
            setVoiceState("listening");
          }, 350);
        };
        
        rec.onerror = (e: any) => {
          console.error("Speech recognition error:", e);
          setIsRecording(false);
          setVoiceState("error");
          setVoiceError(e.error ? `Microphone: ${e.error}` : "Voice capture failed. Please try again.");
        };
        
        rec.onend = () => {
          setIsRecording(false);
          setVoiceState((prev) => (prev === "error" ? "error" : "ready"));
        };
        
        setRecognition(rec);
      }
    }
  }, []);

  // Voice recording timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  const startRecording = () => {
    if (!recognition) {
      toast.error("Speech recognition is not supported in this browser. Please use Google Chrome.");
      return;
    }
    setVoiceError("");
    setVoiceState("listening");
    setIsRecording(true);
    setRecordingTime(0);
    try {
      recognition.start();
      toast.info("Listening... Speak now.");
    } catch (err) {
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (recognition) {
      try {
        recognition.stop();
      } catch (err) {
        console.error(err);
      }
    }
    setIsRecording(false);
    setVoiceState("ready");
    toast.success("Voice recording complete!");
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Enhance prompt with AI
  const handleEnhancePrompt = async () => {
    if (!topic.trim()) {
      toast.error("Please enter a topic or prompt first.");
      return;
    }
    setEnhancementLoading(true);
    setRecommendation(null);
    try {
      const formData = new FormData();
      formData.append("prompt", topic);
      formData.append("provider", aiProvider);
      if (aiModel) formData.append("model_name", aiModel);

      const response = await api.post("/ai/enhance", formData, { timeout: 60000 });
      const enhancedText = response.data.enhanced_prompt;
      
      setTopic(enhancedText);

      // Extract details for recommendations
      const countMatch = enhancedText.match(/(\d+)\s+(?:questions|multiple-choice|MCQs|items)/i);
      const count = countMatch ? Math.min(30, Math.max(1, parseInt(countMatch[1]))) : 20;

      let diff: "easy" | "medium" | "hard" = "medium";
      if (/easy/i.test(enhancedText)) diff = "easy";
      else if (/hard/i.test(enhancedText)) diff = "hard";

      let blooms = ["Understand", "Apply"];
      const bloomOptions = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];
      const matchedBlooms = bloomOptions.filter(level => new RegExp(level, "i").test(enhancedText));
      if (matchedBlooms.length > 0) {
        blooms = matchedBlooms;
      }

      const estDuration = Math.round(count * 1.5);

      setRecommendation({
        questionCount: count,
        difficulty: diff,
        bloomLevels: blooms,
        duration: estDuration,
        distribution: count === 20 ? "30% Easy, 50% Medium, 20% Hard" : "balanced across topics"
      });
      
      toast.success("Prompt enhanced successfully! Recommendations generated.");
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 429) {
        toast.error("You're generating questions too quickly. Please wait a moment and try again.");
      } else {
        toast.error("Failed to enhance prompt. Please try again.");
      }
    } finally {
      setEnhancementLoading(false);
    }
  };

  const applySuggestions = () => {
    if (recommendation) {
      setQuestionCount(recommendation.questionCount);
      setDifficulty(recommendation.difficulty);
      setBloomLevels(recommendation.bloomLevels);
      setQuiz((prev) => ({
        ...prev,
        duration: recommendation.duration,
      }));
      setQuestionDistribution(recommendation.distribution);
      toast.success("Suggestions applied to your AI Engine settings!");
    }
  };

  // Auto-expand textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [topic]);



  // Generate a random code on manual launch
  const handleLaunchManual = () => {
    setView("loading");
    
    // Generate Code
    const generatedCode = `QZ-${Math.floor(100000 + Math.random() * 900000)}`;
    
    // Create initial blank question
    const initialQuestion: QuestionState = {
      id: Math.random().toString(),
      text: "Sample Multiple Choice Question?",
      difficulty: "medium",
      topic: "General",
      marks: 1,
      explanation: "",
      question_type: "multiple_choice",
      bloom_level: "Understanding",
      subtopic: "",
      estimated_time: 30,
      negative_marks: 0,
      hint: "",
      ai_generated: false,
      version: 1,
      order_index: 0,
      time_limit_seconds: 30,
      options: [
        { id: Math.random().toString(), text: "Option A", is_correct: true, display_order: 0 },
        { id: Math.random().toString(), text: "Option B", is_correct: false, display_order: 1 },
        { id: Math.random().toString(), text: "Option C", is_correct: false, display_order: 2 },
        { id: Math.random().toString(), text: "Option D", is_correct: false, display_order: 3 },
      ],
    };

    const initialQuiz: QuizState = {
      title: "New Custom Assessment",
      description: "",
      subject: "Computer Science",
      duration: 10,
      randomize_questions: false,
      randomize_options: false,
      anti_cheating_enabled: false,
      ai_feedback_enabled: false,
      department: "",
      semester: "",
      total_marks: 1,
      pass_percentage: 40,
      visibility: "public",
      status: "draft",
      language: "en",
      fullscreen_required: false,
      adaptive_mode: false,
      allow_review: true,
      start_time: null,
      end_time: null,
      quiz_code: generatedCode,
      max_attempts: 1,
      timer_mode: "none",
      overall_time_limit_seconds: null,
      auto_submit_on_expiry: true,
      available_from: null,
      available_until: null,
      result_visibility: "immediate",
      show_score: true,
      show_answers: true,
      show_explanations: true,
      show_solutions: true,
      show_marks: true,
      shuffle_questions: false,
      shuffle_options: false,
      access_code: "",
      custom_instructions: "",
      questions: [initialQuestion]
    };

    setQuiz(initialQuiz);
    setSelectedQuestionIndex(0);
    setVisitedTabs(new Set(["questions"]));

    setTimeout(() => {
      setView("editor");
      setActiveTab("questions");
      saveDraft(initialQuiz);
    }, 2000);
  };

  const handleLaunchAI = () => {
    setView("ai-generator");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const checkDuplicates = async (questionsToCheck: QuestionState[]) => {
    try {
      const payload = {
        questions: questionsToCheck.map(q => ({ text: q.text }))
      };
      const response = await api.post("/ai/check-duplicate", payload, { timeout: 30000 });
      const warningsList = response.data.warnings || [];
      const warningsMap: Record<number, { similarity: number; existing_text: string; warning: string }> = {};
      warningsList.forEach((w: { index: number; similarity: number; existing_text: string; warning: string }) => {
        warningsMap[w.index] = {
          similarity: w.similarity,
          existing_text: w.existing_text,
          warning: w.warning
        };
      });
      setDuplicateWarnings(warningsMap);
      if (warningsList.length > 0) {
        toast.warning(`Detected ${warningsList.length} duplicate or highly similar questions in the Question Bank.`);
      }
    } catch (e) {
      console.error("Duplicate checking failed:", e);
    }
  };

  const handleGenerateAI = async () => {
    if (sourceType === "topic" && !topic.trim()) {
      toast.error("Please enter a Topic prompt.");
      return;
    }
    if (sourceType === "text" && !text.trim()) {
      toast.error("Please paste content in the Paste Text field.");
      return;
    }
    if (sourceType === "file" && selectedFiles.length === 0) {
      toast.error("Please upload at least one Document.");
      return;
    }

    const textToSearch = `${topic} ${customPrompt}`;
    const countMatch = textToSearch.match(/(\d+)\s*(?:questions|mcqs|items|multiple[- ]choice)/i);
    if (countMatch) {
      const parsedCount = parseInt(countMatch[1], 10);
      if (!isNaN(parsedCount)) {
        const clampedParsed = Math.max(1, Math.min(30, parsedCount));
        if (Math.abs(clampedParsed - questionCount) >= 3) {
          setMismatchData({ parsedCount: clampedParsed, currentCount: questionCount });
          return;
        }
      }
    }

    await executeGenerateAI(questionCount);
  };

  const executeGenerateAI = async (targetCount: number) => {
    setAiLoading(true);
    setView("loading");

    const formData = new FormData();
    formData.append("question_count", targetCount.toString());
    formData.append("difficulty", difficulty);
    formData.append("language", "en");
    formData.append("bloom_levels", bloomLevels.join(","));
    formData.append("question_types", questionTypes.join(","));
    formData.append("provider", aiProvider);
    formData.append("model_name", aiModel);
    formData.append("question_quality", questionQuality);
    formData.append("quiz_style", quizStyle);
    
    if (topic) formData.append("topic", topic);
    if (text) formData.append("text", text);
    if (courseOutcomes) formData.append("course_outcomes", courseOutcomes);
    if (questionDistribution) formData.append("question_distribution", questionDistribution);
    if (customPrompt) formData.append("custom_prompt", customPrompt);

    formData.append("wrap_response", "true");
    formData.append("marks_mode", quiz.marks_mode || "default");
    formData.append("default_marks", String(quiz.default_marks || 1));

    if (sourceType === "file") {
      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });
    }

    try {
      const response = await api.post("/ai/generate", formData, { timeout: 120000 });
      const dataPayload = response.data;
      
      let rawQuestionsList = [];
      if (dataPayload && dataPayload.questions) {
        rawQuestionsList = dataPayload.questions;
        const suggestedMetadata = dataPayload.metadata;
        if (suggestedMetadata) {
          setQuiz(prev => ({
            ...prev,
            title: prev.title || suggestedMetadata.title || "",
            subject: prev.subject || suggestedMetadata.subject || "",
            department: prev.department || suggestedMetadata.department || "",
            description: prev.description || suggestedMetadata.description || ""
          }));
        }
      } else if (Array.isArray(dataPayload)) {
        rawQuestionsList = dataPayload;
      }
      
      if (!rawQuestionsList || rawQuestionsList.length === 0) {
        toast.error("AI returned 0 valid questions. Try a different topic or provider.");
        setAiLoading(false);
        setView("ai-generator");
        return;
      }

      const questions: QuestionState[] = rawQuestionsList.map((q: any, idx: number) => ({
        id: Math.random().toString(),
        text: q.text || "",
        difficulty: (q.difficulty || "medium") as "easy" | "medium" | "hard",
        topic: q.topic || "General",
        marks: q.marks || 1,
        explanation: q.explanation || "",
        question_type: (q.question_type || "multiple_choice") as "multiple_choice" | "multiple_select" | "true_false" | "fill_in_the_blank" | "short_answer",
        bloom_level: q.bloom_level || "Understanding",
        subtopic: q.subtopic || "",
        estimated_time: q.estimated_time || 30,
        negative_marks: q.negative_marks || 0,
        hint: q.hint || "",
        ai_generated: true,
        version: q.version || 1,
        order_index: idx,
        time_limit_seconds: q.time_limit_seconds || 30,
        course_outcome: q.course_outcome || "",
        reference: q.reference || "",
        ai_provider: q.ai_provider || aiProvider,
        ai_model: q.ai_model || aiModel,
        generated_by_ai: true,
        options: (q.options || []).map((o: any, oIdx: number) => ({
          id: Math.random().toString(),
          text: o.text || "",
          is_correct: o.is_correct || false,
          display_order: o.display_order || oIdx
        }))
      }));

      const generatedCode = `AI-QZ-${Math.floor(100000 + Math.random() * 900000)}`;
      const suggestedMetadata = dataPayload.metadata;
      
      const finalTitle = quiz.title.trim() !== "" ? quiz.title : (suggestedMetadata?.title || `AI Quiz: ${topic.substring(0, 40) || "Document"}`);
      const finalSubject = quiz.subject.trim() !== "" ? quiz.subject : (suggestedMetadata?.subject || topic.substring(0, 30) || "Computer Science");
      const finalDescription = quiz.description.trim() !== "" ? quiz.description : (suggestedMetadata?.description || `Generated on ${new Date().toLocaleDateString()} using AI.`);
      const finalDepartment = quiz.department.trim() !== "" ? quiz.department : (suggestedMetadata?.department || "AI Generation");
      const finalSemester = quiz.semester.trim() !== "" ? quiz.semester : "2026";

      const newQuiz: QuizState = {
        ...quiz,
        title: finalTitle,
        description: finalDescription,
        subject: finalSubject,
        department: finalDepartment,
        semester: finalSemester,
        total_marks: questions.reduce((sum, q) => sum + q.marks, 0),
        quiz_code: quiz.quiz_code || generatedCode,
        ai_provider: questions[0]?.ai_provider || aiProvider,
        ai_model: questions[0]?.ai_model || aiModel,
        generation_prompt: topic || text || "AI file generation",
        generated_by_ai: true,
        generation_source: sourceType,
        generated_at: new Date().toISOString(),
        questions: questions
      };

      setQuiz(newQuiz);
      setSelectedQuestionIndex(0);
      setAiLoading(false);
      setView("editor");
      setActiveTab("questions");
      setVisitedTabs(new Set(["questions"]));
      saveDraft(newQuiz);
      toast.success("AI generated questions loaded directly into the editor!");

      // Clear draft prompt upon successful generation
      if (typeof window !== "undefined") {
        localStorage.removeItem("quizverse_draft_prompt");
      }

      // Post-generation check duplicates
      await checkDuplicates(questions);

    } catch (err: unknown) {
      const error = err as { response?: { status?: number, data?: { detail?: string } } };
      setAiLoading(false);
      setView("ai-generator");
      if (error.response?.status === 429) {
        toast.error("You're generating questions too quickly. Please wait a moment and try again.");
      } else {
        toast.error(error.response?.data?.detail || "AI question generation failed.");
      }
    }
  };

  // ─── Shared AI regeneration core ──────────────────────────────────────────
  // This is the single function that handles ALL regeneration triggers:
  //   1. The "Regenerate Question" button (no overrides)
  //   2. Difficulty dropdown change (override: { difficulty })
  //   3. Question Type dropdown change (override: { question_type })
  //
  // Rules:
  // - Always sends a uniqueness_hint so each call produces a genuinely different question
  // - Applies difficulty/type overrides directly via backend params (not modifying original_question locally)
  // - Does NOT set is_user_modified on the result – it remains fully AI-generated
  // - Replaces ONLY the selected question; all others are untouched
  const callRegenerateAPI = async (
    idx: number,
    overrides?: { difficulty?: string; question_type?: string }
  ) => {
    if (regeneratingIndex !== null) {
      toast.warning("Another question is already regenerating. Please wait.");
      return;
    }

    const q = quiz.questions[idx];
    setRegeneratingIndex(idx);

    // If there are overrides, optimistically apply them to the UI immediately
    // (so the user sees the dropdown change right away, even before the AI responds)
    if (overrides) {
      const optimisticQuestions = [...quiz.questions];
      optimisticQuestions[idx] = { ...q, ...overrides } as QuestionState;
      setQuiz(prev => ({ ...prev, questions: optimisticQuestions }));
    }

    // Build the original question context dict – all constraints are forwarded
    // to the backend so QuestionProcessor can enforce them on the replacement.
    // NOTE: We send the ORIGINAL difficulty/type, the overrides are sent as
    // separate form params (target_difficulty_override / target_type_override).
    const originalQuestionContext = {
      text: q.text,
      difficulty: q.difficulty,
      question_type: q.question_type,
      bloom_level: q.bloom_level || "Understand",
      topic: q.topic || topic || quiz.subject || "General",
      learning_objective: q.topic || topic || "General concept",
      subtopic: q.subtopic || "",
      marks: q.marks,
      marks_mode: quiz.marks_mode || "default",
      course_outcome: q.course_outcome || "",
    };

    // Other questions in the quiz to avoid duplication
    const otherQuestions = quiz.questions
      .filter((_, i) => i !== idx)
      .map((g) => ({ text: g.text, question_type: g.question_type }));

    const formData = new FormData();
    formData.append("original_question_json", JSON.stringify(originalQuestionContext));
    formData.append("existing_questions_json", JSON.stringify(otherQuestions));
    formData.append("quiz_subject", quiz.subject || "");
    formData.append("quiz_topic", quiz.generation_prompt || topic || quiz.subject || "");
    formData.append("provider", aiProvider);
    formData.append("model_name", aiModel);
    formData.append("question_quality", questionQuality);
    formData.append("quiz_style", quizStyle);
    formData.append("marks_mode", quiz.marks_mode || "default");
    formData.append("default_marks", String(quiz.default_marks || 1));

    // Uniqueness hint: millisecond timestamp ensures every call is treated as novel
    formData.append("uniqueness_hint", String(Date.now()));

    // Override params: let the backend apply new difficulty / type constraints
    if (overrides?.difficulty) {
      formData.append("target_difficulty_override", overrides.difficulty);
    }
    if (overrides?.question_type) {
      formData.append("target_type_override", overrides.question_type);
    }

    try {
      const toastLabel = overrides?.difficulty
        ? `Regenerating with ${overrides.difficulty} difficulty…`
        : overrides?.question_type
        ? `Regenerating as ${overrides.question_type.replace(/_/g, " ")}…`
        : "Regenerating question via AI…";
      toast.loading(toastLabel, { id: `regen-${idx}` });

      const response = await api.post("/ai/regenerate-question", formData, { timeout: 60000 });
      const newQRaw = response.data as {
        text?: string;
        difficulty?: string;
        topic?: string;
        marks?: number;
        explanation?: string;
        question_type?: string;
        bloom_level?: string;
        subtopic?: string;
        estimated_time?: number;
        negative_marks?: number;
        hint?: string;
        course_outcome?: string;
        reference?: string;
        ai_provider?: string;
        ai_model?: string;
        options?: { text: string; is_correct?: boolean; display_order?: number }[];
      };

      if (!newQRaw || !newQRaw.text) {
        toast.error("AI returned an empty question. Please try again.", { id: `regen-${idx}` });
        // Rollback optimistic update
        if (overrides) {
          const rollback = [...quiz.questions];
          rollback[idx] = q;
          setQuiz(prev => ({ ...prev, questions: rollback }));
        }
        return;
      }

      // Respect the override for difficulty/type in the final state
      const finalDifficulty = (overrides?.difficulty || newQRaw.difficulty || q.difficulty) as "easy" | "medium" | "hard";
      const finalType = (overrides?.question_type || newQRaw.question_type || q.question_type) as
        "multiple_choice" | "multiple_select" | "true_false" | "fill_in_the_blank" | "short_answer";

      // Build the replacement QuestionState, preserving structural props from the original.
      // is_user_modified stays false – this is an AI regeneration, not a manual edit.
      const newQ: QuestionState = {
        id: Math.random().toString(),
        text: newQRaw.text || "",
        difficulty: finalDifficulty,
        topic: newQRaw.topic || q.topic,
        marks: newQRaw.marks || q.marks,
        explanation: newQRaw.explanation || "",
        question_type: finalType,
        bloom_level: newQRaw.bloom_level || q.bloom_level,
        subtopic: newQRaw.subtopic || "",
        estimated_time: newQRaw.estimated_time || 30,
        negative_marks: newQRaw.negative_marks || 0,
        hint: newQRaw.hint || "",
        ai_generated: true,
        // Increment version to track regeneration
        version: (q.version || 1) + 1,
        // Preserve original order_index and time_limit so nothing shifts
        order_index: idx,
        time_limit_seconds: q.time_limit_seconds,
        course_outcome: newQRaw.course_outcome || q.course_outcome || "",
        reference: newQRaw.reference || "",
        ai_provider: newQRaw.ai_provider || aiProvider,
        ai_model: newQRaw.ai_model || aiModel,
        generated_by_ai: true,
        is_user_modified: false,           // AI regeneration ≠ user edit
        ai_original_json: undefined,       // new version IS the canonical original
        options: (newQRaw.options || []).map(
          (o: { text: string; is_correct?: boolean; display_order?: number }, oIdx: number) => ({
            id: Math.random().toString(),
            text: o.text || "",
            is_correct: o.is_correct || false,
            display_order: oIdx
          })
        )
      };

      const updated = [...quiz.questions];
      updated[idx] = newQ;
      setQuiz(prev => {
        const next = { ...prev, questions: updated };
        saveDraft(next);
        return next;
      });

      setRecentlyRegeneratedIndex(idx);
      setTimeout(() => {
        setRecentlyRegeneratedIndex((prev) => (prev === idx ? null : prev));
      }, 3000);

      toast.success("Question regenerated successfully!", { id: `regen-${idx}` });

      // Post-regeneration duplicate check for the updated list
      await checkDuplicates(updated);

    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { detail?: string } } };
      if (error.response?.status === 429) {
        toast.error("Rate limit reached. Please wait a moment before regenerating.", { id: `regen-${idx}` });
      } else {
        toast.error(
          error.response?.data?.detail || "Failed to regenerate question. Please try again.",
          { id: `regen-${idx}` }
        );
      }
      // Rollback optimistic update on error
      if (overrides) {
        const rollback = [...quiz.questions];
        rollback[idx] = q;
        setQuiz(prev => ({ ...prev, questions: rollback }));
      }
    } finally {
      setRegeneratingIndex(null);
    }
  };

  // Keep the old name as a thin alias for the "Regenerate" button
  const handleRegenerateQuestion = (idx: number) => callRegenerateAPI(idx);

  const handleRestoreOriginalAI = (idx: number) => {
    const q = quiz.questions[idx];
    if (!q.ai_original_json) return;

    try {
      const orig = JSON.parse(q.ai_original_json);
      const updated = [...quiz.questions];
      
      updated[idx] = {
        ...q,
        text: orig.text || q.text,
        difficulty: (orig.difficulty || q.difficulty) as "easy" | "medium" | "hard",
        explanation: orig.explanation || q.explanation,
        question_type: (orig.question_type || q.question_type) as any,
        bloom_level: orig.bloom_level || q.bloom_level,
        is_user_modified: false,
        options: (orig.options || []).map((o: any, oIdx: number) => ({
          id: Math.random().toString(),
          text: o.text || "",
          is_correct: o.is_correct || false,
          display_order: oIdx
        }))
      };

      if (quiz.marks_mode === "auto") {
        const diff = updated[idx].difficulty;
        updated[idx].marks = diff === "easy" ? 1 : diff === "hard" ? 5 : 2;
      } else {
        updated[idx].marks = orig.marks || q.marks;
      }

      setQuiz(prev => {
        const next = { ...prev, questions: updated };
        saveDraft(next);
        return next;
      });
      
      toast.success("Restored to original AI version!");
      checkDuplicates(updated);
    } catch (e) {
      console.error(e);
      toast.error("Failed to restore original AI question version.");
    }
  };

  // Add Question
  const addQuestion = () => {
    const newQuestion: QuestionState = {
      id: Math.random().toString(),
      text: "",
      difficulty: "medium",
      topic: "",
      marks: 1,
      explanation: "",
      question_type: "multiple_choice",
      bloom_level: "Recall",
      subtopic: "",
      estimated_time: 30,
      negative_marks: 0,
      hint: "",
      ai_generated: false,
      version: 1,
      order_index: quiz.questions.length,
      time_limit_seconds: quiz.timer_mode === "per_question" || quiz.timer_mode === "both" ? 30 : null,
      options: [
        { id: Math.random().toString(), text: "Option 1", is_correct: false, display_order: 0 },
        { id: Math.random().toString(), text: "Option 2", is_correct: false, display_order: 1 },
      ],
    };
    setQuiz(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion]
    }));
    setSelectedQuestionIndex(quiz.questions.length);
  };

  // Delete Question
  const deleteQuestion = (index: number) => {
    if (quiz.questions.length <= 1) {
      toast.error("A quiz must have at least one question.");
      return;
    }
    const updated = quiz.questions.filter((_, i) => i !== index).map((q, idx) => ({
      ...q,
      order_index: idx
    }));
    setQuiz(prev => ({
      ...prev,
      questions: updated
    }));
    setSelectedQuestionIndex(prev => Math.max(0, prev - 1));
    toast.success("Question removed.");
  };

  // Move Question (Reordering)
  const moveQuestion = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === quiz.questions.length - 1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    const questions = [...quiz.questions];
    
    // Swap
    const temp = questions[index];
    questions[index] = questions[newIndex];
    questions[newIndex] = temp;

    // Reset order_index
    const updated = questions.map((q, idx) => ({
      ...q,
      order_index: idx
    }));

    setQuiz(prev => ({
      ...prev,
      questions: updated
    }));
    setSelectedQuestionIndex(newIndex);
  };

  // Question Form handlers
  const updateQuestionField = (
    field: keyof QuestionState,
    value: string | number | boolean | OptionState[] | null
  ) => {
    const updatedQuestions = [...quiz.questions];
    const originalQ = updatedQuestions[selectedQuestionIndex];
    let updatedQ = {
      ...originalQ,
      [field]: value
    };

    // Only MANUAL content edits set is_user_modified.
    // difficulty and question_type changes for AI questions are handled by
    // callRegenerateAPI (which keeps is_user_modified=false). We exclude them
    // here so falling through to this path (for non-AI questions) also stays clean.
    if (["text", "marks", "explanation", "options"].includes(field)) {
      updatedQ.is_user_modified = true;
    }

    if (quiz.marks_mode === "auto") {
      const currentDiff = field === "difficulty" ? value : updatedQ.difficulty;
      if (currentDiff === "easy") {
        updatedQ.marks = 1;
      } else if (currentDiff === "hard") {
        updatedQ.marks = 5;
      } else {
        updatedQ.marks = 2;
      }
    }

    // If type changes on a non-AI question, re-configure default placeholder options
    if (field === "question_type") {
      const type = value;
      let options: OptionState[] = [];
      if (type === "true_false") {
        options = [
          { id: Math.random().toString(), text: "True", is_correct: true, display_order: 0 },
          { id: Math.random().toString(), text: "False", is_correct: false, display_order: 1 },
        ];
      } else if (type === "fill_in_the_blank" || type === "short_answer") {
        options = [
          { id: Math.random().toString(), text: "", is_correct: true, display_order: 0 }
        ];
      } else {
        options = [
          { id: Math.random().toString(), text: "Option 1", is_correct: true, display_order: 0 },
          { id: Math.random().toString(), text: "Option 2", is_correct: false, display_order: 1 },
          { id: Math.random().toString(), text: "Option 3", is_correct: false, display_order: 2 },
        ];
      }
      updatedQ.options = options;
    }

    updatedQuestions[selectedQuestionIndex] = updatedQ;
    setQuiz(prev => ({ ...prev, questions: updatedQuestions }));
  };

  const handleToggleMarksMode = (mode: "default" | "auto") => {
    const defaultMarks = quiz.default_marks || 1;
    const updatedQuestions = quiz.questions.map(q => {
      let newMarks = q.marks;
      if (mode === "auto") {
        if (q.difficulty === "easy") newMarks = 1;
        else if (q.difficulty === "hard") newMarks = 5;
        else newMarks = 2;
      } else {
        newMarks = defaultMarks;
      }
      return { ...q, marks: newMarks };
    });
    setQuiz(prev => ({ ...prev, marks_mode: mode, questions: updatedQuestions }));
  };

  const handleDefaultMarksChange = (val: number) => {
    const updatedQuestions = quiz.questions.map(q => {
      if (quiz.marks_mode === "default") {
        return { ...q, marks: val };
      }
      return q;
    });
    setQuiz(prev => ({ ...prev, default_marks: val, questions: updatedQuestions }));
  };

  // Options handlers
  const updateOptionText = (optIdx: number, text: string) => {
    const updatedQuestions = [...quiz.questions];
    const question = updatedQuestions[selectedQuestionIndex];
    const updatedOptions = [...question.options];
    updatedOptions[optIdx] = { ...updatedOptions[optIdx], text };
    question.options = updatedOptions;
    setQuiz(prev => ({ ...prev, questions: updatedQuestions }));
  };

  const toggleOptionCorrectness = (optIdx: number) => {
    const updatedQuestions = [...quiz.questions];
    const question = updatedQuestions[selectedQuestionIndex];
    const updatedOptions = question.options.map((opt, i) => {
      if (question.question_type === "multiple_choice" || question.question_type === "true_false") {
        // Only one correct option
        return { ...opt, is_correct: i === optIdx };
      } else {
        // Multi-select can have multiple correct
        return i === optIdx ? { ...opt, is_correct: !opt.is_correct } : opt;
      }
    });
    question.options = updatedOptions;
    setQuiz(prev => ({ ...prev, questions: updatedQuestions }));
  };

  const addOption = () => {
    const question = quiz.questions[selectedQuestionIndex];
    const newOpt: OptionState = {
      id: Math.random().toString(),
      text: `Option ${question.options.length + 1}`,
      is_correct: false,
      display_order: question.options.length,
    };
    const updatedQuestions = [...quiz.questions];
    updatedQuestions[selectedQuestionIndex].options = [...question.options, newOpt];
    setQuiz(prev => ({ ...prev, questions: updatedQuestions }));
  };

  const removeOption = (optIdx: number) => {
    const question = quiz.questions[selectedQuestionIndex];
    if (question.options.length <= 1) {
      toast.error("You need at least one option/answer.");
      return;
    }
    const updatedOptions = question.options.filter((_, i) => i !== optIdx).map((o, idx) => ({
      ...o,
      display_order: idx
    }));
    const updatedQuestions = [...quiz.questions];
    updatedQuestions[selectedQuestionIndex].options = updatedOptions;
    setQuiz(prev => ({ ...prev, questions: updatedQuestions }));
  };

  // Timer mode configuration
  const handleTimerModeChange = (mode: "none" | "overall" | "per_question" | "both") => {
    setQuiz(prev => {
      const overallSeconds = mode === "overall" || mode === "both" ? 600 : null;
      const updatedQuestions = prev.questions.map(q => ({
        ...q,
        time_limit_seconds: mode === "per_question" || mode === "both" ? 30 : null
      }));
      return {
        ...prev,
        timer_mode: mode,
        overall_time_limit_seconds: overallSeconds,
        questions: updatedQuestions
      };
    });
  };

  // Total Marks auto calculate
  useEffect(() => {
    const total = quiz.questions.reduce((sum, q) => sum + (q.marks || 0), 0);
    setQuiz(prev => ({ ...prev, total_marks: total }));
  }, [quiz.questions]);

  // Submit / Save Handler
  const handleSaveQuiz = async (status: "draft" | "published") => {
    if (!quiz.title.trim()) {
      toast.error("Quiz title is required.");
      return;
    }
    if (!quiz.subject.trim()) {
      toast.error("Quiz subject is required.");
      return;
    }
    if (!quiz.quiz_code.trim()) {
      toast.error("Quiz code is required.");
      return;
    }

    // Validate Questions
    for (let i = 0; i < quiz.questions.length; i++) {
      const q = quiz.questions[i];
      if (!q.text.trim()) {
        toast.error(`Question ${i + 1} text is empty.`);
        return;
      }
      
      // MCQ/MSQ checks
      if (q.question_type === "multiple_choice" || q.question_type === "multiple_select" || q.question_type === "true_false") {
        const correctCount = q.options.filter(o => o.is_correct).length;
        if (correctCount === 0) {
          toast.error(`Question ${i + 1} has no correct answer selected.`);
          return;
        }
        for (let j = 0; j < q.options.length; j++) {
          if (!q.options[j].text.trim()) {
            toast.error(`Question ${i + 1}, Option ${j + 1} text is empty.`);
            return;
          }
        }
      }

      // Fill in blank check
      if (q.question_type === "fill_in_the_blank" || q.question_type === "short_answer") {
        const filledAnswers = q.options.filter(o => o.text.trim() !== "");
        if (filledAnswers.length === 0) {
          toast.error(`Question ${i + 1} requires at least one acceptable correct answer string.`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    const savePromise = async () => {
      // Map data cleanly for API
      const payload = {
        ...quiz,
        status,
        shuffle_questions: quiz.shuffle_questions || quiz.randomize_questions,
        shuffle_options: quiz.shuffle_options || quiz.randomize_options,
        available_from: quiz.available_from ? new Date(quiz.available_from).toISOString() : null,
        available_until: quiz.available_until ? new Date(quiz.available_until).toISOString() : null,
        duration: quiz.overall_time_limit_seconds ? Math.max(1, Math.ceil(quiz.overall_time_limit_seconds / 60)) : quiz.duration,
        questions: quiz.questions.map(q => ({
          ...q,
          options: q.options.map(o => ({
            text: o.text,
            is_correct: o.is_correct,
            display_order: o.display_order
          }))
        }))
      };

      const response = await api.post("/quizzes", payload);
      setSavedQuiz({
        id: response.data.id,
        quiz_code: response.data.quiz_code,
        title: response.data.title,
        status: status
      });
      return response.data;
    };

    toast.promise(savePromise(), {
      loading: status === "published" ? "Publishing assessment..." : "Saving draft...",
      success: (data) => {
        setIsSubmitting(false);
        setView("success");
        clearDraft(); // clear draft upon successful save
        return status === "published" 
          ? `Quiz published successfully! Code: ${data.quiz_code}`
          : "Quiz draft saved successfully!";
      },
      error: (err) => {
        setIsSubmitting(false);
        return err.response?.data?.detail || "An error occurred while saving the quiz.";
      }
    });
  };

  const handleStartLiveSession = async () => {
    if (!savedQuiz) return;
    setSessionCreating(true);
    try {
      const res = await api.post("/sessions/create", { quiz_id: savedQuiz.id });
      toast.success("Live session initialized!");
      router.push(`/lobby/${res.data.game_pin}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Failed to initialize live session.");
    } finally {
      setSessionCreating(false);
    }
  };

  // --- Student Simulator Logic ---
  const [simStarted, setSimStarted] = useState(false);
  const [simCurrentIdx, setSimCurrentIdx] = useState(0);
  const [simAnswers, setSimAnswers] = useState<Record<string, string[]>>({});
  const [simOverallTimer, setSimOverallTimer] = useState<number>(0);
  const [simQuestionTimer, setSimQuestionTimer] = useState<number>(0);
  const [simFinished, setSimFinished] = useState(false);
  const [simScore, setSimScore] = useState(0);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startSimulation = () => {
    setSimStarted(true);
    setSimCurrentIdx(0);
    setSimAnswers({});
    setSimFinished(false);
    setSimScore(0);
    
    // Set initial timers
    if (quiz.timer_mode === "overall" || quiz.timer_mode === "both") {
      setSimOverallTimer(quiz.overall_time_limit_seconds || 600);
    }
    if (quiz.timer_mode === "per_question" || quiz.timer_mode === "both") {
      setSimQuestionTimer(quiz.questions[0]?.time_limit_seconds || 30);
    }
  };

  useEffect(() => {
    if (simStarted && !simFinished) {
      timerRef.current = setInterval(() => {
        // Handle Overall Timer
        if (quiz.timer_mode === "overall" || quiz.timer_mode === "both") {
          setSimOverallTimer(prev => {
            if (prev <= 1) {
              if (quiz.auto_submit_on_expiry) {
                toast.warning("Overall time expired! Auto-submitting quiz...");
                finishSimulation();
              } else {
                toast.error("Time expired!");
                finishSimulation();
              }
              return 0;
            }
            return prev - 1;
          });
        }

        // Handle Per Question Timer
        if (quiz.timer_mode === "per_question" || quiz.timer_mode === "both") {
          setSimQuestionTimer(prev => {
            if (prev <= 1) {
              toast.info("Time expired for this question. Moving to next...");
              moveToNextQuestionOrSubmit();
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [simStarted, simFinished, simCurrentIdx, quiz.timer_mode]);

  function moveToNextQuestionOrSubmit() {
    if (simCurrentIdx < quiz.questions.length - 1) {
      const nextIdx = simCurrentIdx + 1;
      setSimCurrentIdx(nextIdx);
      // Reset question timer
      if (quiz.timer_mode === "per_question" || quiz.timer_mode === "both") {
        setSimQuestionTimer(quiz.questions[nextIdx]?.time_limit_seconds || 30);
      }
    } else {
      finishSimulation();
    }
  }

  function finishSimulation() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Calculate Score
    let correctCount = 0;
    quiz.questions.forEach(q => {
      const answers = simAnswers[q.id] || [];
      if (q.question_type === "multiple_choice" || q.question_type === "true_false") {
        const correctOpt = q.options.find(o => o.is_correct);
        if (correctOpt && answers.includes(correctOpt.text)) {
          correctCount++;
        }
      } else if (q.question_type === "multiple_select") {
        const correctOpts = q.options.filter(o => o.is_correct).map(o => o.text);
        const hasAllCorrect = correctOpts.every(txt => answers.includes(txt)) && 
                              answers.every(txt => correctOpts.includes(txt));
        if (hasAllCorrect && correctOpts.length > 0) {
          correctCount++;
        }
      } else if (q.question_type === "fill_in_the_blank" || q.question_type === "short_answer") {
        const correctAnswers = q.options.map(o => o.text.trim().toLowerCase());
        const userAns = answers.map(a => a.trim().toLowerCase());
        const isMatched = userAns.some(ua => correctAnswers.includes(ua));
        if (isMatched) {
          correctCount++;
        }
      }
    });

    const percent = quiz.questions.length > 0 ? Math.round((correctCount / quiz.questions.length) * 100) : 0;
    setSimScore(percent);
    setSimFinished(true);
  };

  const handleSimSelectAnswer = (qId: string, answerText: string, isMulti: boolean) => {
    setSimAnswers(prev => {
      const currentAnswers = prev[qId] || [];
      if (isMulti) {
        if (currentAnswers.includes(answerText)) {
          return { ...prev, [qId]: currentAnswers.filter(a => a !== answerText) };
        } else {
          return { ...prev, [qId]: [...currentAnswers, answerText] };
        }
      } else {
        return { ...prev, [qId]: [answerText] };
      }
    });
  };

  // TTS State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speakQuestion = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      toast.error("Speech synthesis is not supported in this browser.");
      return;
    }
    
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;
    utterance.onend = () => {
      utteranceRef.current = null;
      setIsSpeaking(false);
    };
    utterance.onerror = () => {
      utteranceRef.current = null;
      setIsSpeaking(false);
    };
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Ensure speech is stopped when switching tabs, changing question, or exiting simulator.
  // Explicitly reset isSpeaking here because speechSynthesis.cancel() does not
  // reliably fire utterance.onend / utterance.onerror in all browsers.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      utteranceRef.current = null;
      setIsSpeaking(false);
    };
  }, [activeTab, simCurrentIdx, simStarted, view]);

  const getPublishReadiness = () => {
    const checks = {
      hasQuestions: quiz.questions.length > 0,
      hasTitle: !!quiz.title.trim(),
      hasSubject: !!quiz.subject.trim(),
      hasCorrectAnswers: quiz.questions.length > 0 && quiz.questions.every(q => {
        if (q.question_type === "fill_in_the_blank" || q.question_type === "short_answer") {
          return q.options.length > 0 && q.options.some(opt => opt.text.trim() !== "");
        }
        return q.options.some(opt => opt.is_correct);
      }),
      hasSchedule: !!quiz.available_from && !!quiz.available_until,
      hasTimeLimit: quiz.timer_mode !== "none",
      missingExplanationsCount: quiz.questions.filter(q => !q.explanation?.trim()).length
    };

    let score = 0;
    if (checks.hasTitle) score += 15;
    if (checks.hasSubject) score += 15;
    if (checks.hasQuestions) score += 20;
    if (checks.hasCorrectAnswers) score += 20;
    if (checks.hasSchedule) score += 10;
    if (checks.hasTimeLimit) score += 10;

    if (quiz.questions.length > 0) {
      const explainRatio = (quiz.questions.length - checks.missingExplanationsCount) / quiz.questions.length;
      score += Math.round(explainRatio * 10);
    } else {
      score += 10;
    }

    const isReady = checks.hasQuestions && checks.hasTitle && checks.hasSubject && checks.hasCorrectAnswers;

    return {
      checks,
      score: isReady ? score : Math.min(score, 59),
      isReady
    };
  };

  const renderProgressIndicator = () => {
    const steps = [
      { id: "questions", label: "Questions", num: 1 },
      { id: "details", label: "Quiz Details", num: 2 },
      { id: "schedule", label: "Schedule", num: 3 },
      { id: "preview", label: "Preview", num: 4 },
    ];

    const isStepCompleted = (stepId: string) => {
      if (stepId === "questions") return quiz.questions.length > 0;
      if (stepId === "details") return !!quiz.title.trim() && !!quiz.subject.trim();
      if (stepId === "schedule") return true;
      if (stepId === "preview") return false;
      return false;
    };

    return (
      <div className="bg-slate-100/80 dark:bg-[#0c1427]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_10px_30px_rgba(2,6,17,0.4)] rounded-2xl p-2.5 sm:p-4 flex items-center justify-between select-none mb-6 overflow-x-auto no-scrollbar">
        <div className="flex items-center w-full justify-between sm:justify-around md:justify-center md:gap-12 min-w-max px-1">
          {steps.map((step, idx) => {
            const isActive = activeTab === step.id;
            const isCompleted = isStepCompleted(step.id);
            const isVisited = visitedTabs.has(step.id);

            return (
              <React.Fragment key={step.id}>
                {/* Step Item */}
                <button
                  type="button"
                  onClick={() => setActiveTab(step.id as any)}
                  className="flex items-center gap-1.5 sm:gap-2 group focus:outline-none transition-colors cursor-pointer shrink-0"
                >
                  <div
                    className={`h-6.5 w-6.5 sm:h-7 sm:w-7 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-bold border transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-indigo-600 to-cyan-600 border-indigo-500 text-white shadow-md shadow-indigo-500/25 scale-105"
                        : isCompleted
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                        : isVisited
                        ? "bg-slate-200/70 dark:bg-slate-800/70 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        : "bg-slate-200/40 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                    ) : (
                      step.num
                    )}
                  </div>
                  <span
                    className={`text-xs font-bold transition-colors ${
                      isActive
                        ? "text-slate-900 dark:text-white inline"
                        : isCompleted
                        ? "text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-500 hidden sm:inline"
                        : isVisited
                        ? "text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white hidden sm:inline"
                        : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400 hidden sm:inline"
                    }`}
                  >
                    {step.label}
                  </span>
                </button>

                {/* Divider Line */}
                {idx < steps.length - 1 && (
                  <div
                    className={`hidden sm:block h-[2px] w-6 md:w-12 transition-colors ${
                      isStepCompleted(steps[idx].id)
                        ? "bg-emerald-500/30"
                        : "bg-slate-200 dark:bg-slate-800"
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  const handleExitEditor = () => {
    if (quiz.questions.length > 0) {
      if (window.confirm("This will discard all unsaved changes and clear your current quiz draft. Are you sure you want to exit?")) {
        clearDraft();
        setView("choice");
      }
    } else {
      setView("choice");
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-5xl mx-auto w-full pb-16 px-1 sm:px-0">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes sound-wave-bar {
          0% { height: 3px; opacity: 0.35; }
          100% { height: 12px; opacity: 1; }
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
      
      {/* HEADER SECTION */}
      {view === "success" ? null : view === "editor" ? (() => {
        const { score, isReady } = getPublishReadiness();
        return (
          <PageHeader
            title={`Quiz Editor: ${quiz.title || "Untitled Assessment"}`}
            description="Design questions, configure metadata settings, specify timing/schedule windows, and test-drive inside the simulator."
            actions={
              <div className="flex flex-wrap sm:flex-nowrap gap-1.5 sm:gap-2 items-center justify-end w-full sm:w-auto">
                <div className="hidden lg:flex flex-col items-end mr-1 select-none">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Readiness</span>
                  <span className={`text-sm font-extrabold ${isReady ? "text-emerald-500 dark:text-emerald-400" : "text-amber-500 dark:text-amber-400"}`}>
                    {score}%
                  </span>
                </div>
                <Button
                  variant="outline"
                  onClick={handleExitEditor}
                  className="rounded-xl border-slate-200 dark:border-slate-700/70 bg-slate-100/80 dark:bg-[#121c33]/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-[#172442] font-semibold px-2.5 sm:px-3.5 cursor-pointer h-9 sm:h-10 border flex items-center gap-1.5 text-xs transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline sm:inline">Exit</span>
                </Button>
                <Button
                  disabled={isSubmitting}
                  onClick={() => handleSaveQuiz("draft")}
                  className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold px-2.5 sm:px-3.5 cursor-pointer h-9 sm:h-10 flex items-center gap-1.5 text-xs transition-colors"
                >
                  <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>Draft</span>
                </Button>
                <Button
                  disabled={isSubmitting || !isReady}
                  onClick={() => handleSaveQuiz("published")}
                  className={`rounded-xl font-semibold px-3 sm:px-4.5 h-9 sm:h-10 flex items-center gap-1.5 text-xs border-none cursor-pointer transition-all ${
                    isReady 
                      ? "bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white shadow-md shadow-indigo-500/25" 
                      : "bg-slate-200/60 dark:bg-slate-800/40 border border-slate-300/40 dark:border-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60"
                  }`}
                  title={!isReady ? "Please complete all critical details before publishing" : "Publish Quiz"}
                >
                  <FileCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>Publish</span>
                </Button>
              </div>
            }
          />
        );
      })() : (
        <PageHeader
          title="Create Quiz"
          description="Choose your preferred workflow: build custom assessments manually from scratch, or let AI assist you."
          actions={
            <div className="flex flex-wrap gap-2">
              {view !== "choice" && (
                <Button
                  variant="outline"
                  onClick={() => setView("choice")}
                  className="rounded-xl border-slate-200 dark:border-slate-700/70 bg-slate-100/80 dark:bg-[#121c33]/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-[#172442] font-semibold px-3 sm:px-4 cursor-pointer h-9 sm:h-10 text-xs border flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>Change Workflow</span>
                </Button>
              )}
              <Link
                href="/dashboard"
                className={buttonVariants({ variant: "outline", className: "rounded-xl border-slate-200 dark:border-slate-700/70 bg-slate-100/80 dark:bg-[#121c33]/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-[#172442] font-semibold px-3 sm:px-4 cursor-pointer h-9 sm:h-10 text-xs border flex items-center gap-1.5 transition-colors" })}
              >
                {view === "choice" && <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                <span>Dashboard</span>
              </Link>
            </div>
          }
        />
      )}

      <AnimatePresence mode="wait">
        
        {/* CHOICE SELECTION */}
        {view === "choice" && (
          <div className="space-y-6 w-full">
            {draftBanner && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg relative overflow-hidden"
              >
                <div className="space-y-1">
                  <div className="text-sm font-bold text-amber-500 dark:text-amber-400 flex items-center gap-2">
                    <span>📝</span>
                    <span>Unsaved draft found — &quot;{draftBanner.title}&quot;</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium pl-6">
                    {draftBanner.questionCount} questions · saved {(() => {
                      const diffMins = Math.round((Date.now() - draftBanner.savedAt) / 60000);
                      if (diffMins < 1) return "just now";
                      if (diffMins === 1) return "1 minute ago";
                      return `${diffMins} minutes ago`;
                    })()} · source: {draftBanner.source === "ai" ? "AI Assisted" : "Manual Custom"}
                  </div>
                </div>
                <div className="flex gap-2 self-end sm:self-auto">
                  <Button
                    onClick={handleDiscardDraft}
                    variant="outline"
                    className="h-9 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-semibold px-3 cursor-pointer"
                  >
                    Discard
                  </Button>
                  <Button
                    onClick={handleRestoreDraft}
                    className="h-9 rounded-xl bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white text-xs font-bold px-4 cursor-pointer border-none"
                  >
                    Restore Draft
                  </Button>
                </div>
              </motion.div>
            )}

            <motion.div
              key="choice-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-1 md:grid-cols-2 gap-7 w-full"
            >
              {/* Manual Creation Card */}
              <motion.div
                whileHover={{ y: -4 }}
                className="group relative overflow-hidden rounded-3xl border border-indigo-500/35 bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50/50 dark:from-[#101e4a] dark:via-[#0d183f] dark:to-[#081230] p-5 sm:p-7 md:p-8 flex flex-col justify-between min-h-0 sm:min-h-[470px] shadow-[0_10px_35px_rgba(0,0,0,0.06)] dark:shadow-[0_16px_45px_rgba(6,16,51,0.7)] transition-all duration-300 hover:border-indigo-400/60 hover:shadow-[0_20px_50px_rgba(99,102,241,0.25)]"
              >
                {/* Subtle abstract glow and wave background */}
                <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-transparent blur-3xl group-hover:from-indigo-500/30 transition-all duration-500" />
                <svg
                  className="pointer-events-none absolute right-0 top-0 h-56 w-56 text-indigo-400/20 stroke-current fill-none overflow-visible opacity-40 group-hover:opacity-60 transition-opacity duration-500"
                  viewBox="0 0 200 200"
                >
                  <path
                    d="M30 180 C80 120, 120 160, 190 70"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  <path
                    d="M60 200 C110 130, 150 140, 200 50"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M10 150 C70 90, 140 120, 200 20"
                    strokeWidth="1.8"
                  />
                  {/* Subtle decorative sparkle star */}
                  <g transform="translate(145, 45) scale(0.6)">
                    <path
                      d="M0 -15 Q0 0 15 0 Q0 0 0 15 Q0 0 -15 0 Q0 0 0 -15 Z"
                      fill="currentColor"
                    />
                  </g>
                  <g transform="translate(175, 110) scale(0.4)">
                    <path
                      d="M0 -15 Q0 0 15 0 Q0 0 0 15 Q0 0 -15 0 Q0 0 0 -15 Z"
                      fill="currentColor"
                    />
                  </g>
                </svg>

                <div className="relative z-10 space-y-6">
                  {/* Icon Container */}
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500/25 via-purple-500/20 to-indigo-900/40 border border-indigo-400/40 flex items-center justify-center text-indigo-400 dark:text-indigo-300 shadow-[0_4px_20px_rgba(99,102,241,0.25)] group-hover:border-indigo-400/60 group-hover:scale-105 transition-all duration-300">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-8 w-8 text-indigo-500 dark:text-indigo-300"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 19l7-7 3 3-7 7-3-3z" />
                      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18" />
                      <path d="M2 2l7.586 7.586" />
                      <circle cx="11" cy="11" r="2" />
                    </svg>
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-2">
                    <h3 className="text-xl md:text-[1.3rem] font-bold text-slate-900 dark:text-white font-display tracking-tight flex items-center gap-2">
                      <span>📝</span>
                      <span>Create Questions Manually</span>
                    </h3>
                    <p className="text-xs md:text-[0.8125rem] text-slate-600 dark:text-slate-300/80 leading-relaxed max-w-md">
                      Build assessment sessions with full edit control. Design questions step-by-step, assign distinct layouts, and configure flexible timers.
                    </p>
                  </div>

                  {/* Features List */}
                  <ul className="space-y-3 pt-2">
                    <li className="flex items-center gap-2.5 text-xs md:text-[0.8125rem] text-slate-700 dark:text-slate-200">
                      <CheckCircle2 className="h-4.5 w-4.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                      <span>Multiple Choice, True/False & Short Answer types</span>
                    </li>
                    <li className="flex items-center gap-2.5 text-xs md:text-[0.8125rem] text-slate-700 dark:text-slate-200">
                      <CheckCircle2 className="h-4.5 w-4.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                      <span>Flexible timer configuration (overall, per-question, or both)</span>
                    </li>
                    <li className="flex items-center gap-2.5 text-xs md:text-[0.8125rem] text-slate-700 dark:text-slate-200">
                      <CheckCircle2 className="h-4.5 w-4.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                      <span>Rearrange indexes and adjust scoring parameters</span>
                    </li>
                    <li className="flex items-center gap-2.5 text-xs md:text-[0.8125rem] text-slate-700 dark:text-slate-200">
                      <CheckCircle2 className="h-4.5 w-4.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                      <span>Live test-drive simulator prior to publishing</span>
                    </li>
                  </ul>
                </div>

                {/* CTA Button */}
                <div className="relative z-10 pt-8">
                  <Button
                    onClick={handleLaunchManual}
                    className="w-full h-12 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(79,70,229,0.3)] hover:shadow-[0_6px_25px_rgba(79,70,229,0.45)] cursor-pointer border border-indigo-400/30 transition-all group-hover:scale-[1.005]"
                  >
                    <span>Build Manually</span>
                    <ArrowRight className="h-4.5 w-4.5" />
                  </Button>
                </div>
              </motion.div>

              {/* AI Assistant Card */}
              <motion.div
                whileHover={{ y: -4 }}
                className="group relative overflow-hidden rounded-3xl border border-cyan-500/35 bg-gradient-to-br from-slate-50 via-slate-100 to-cyan-50/50 dark:from-[#0b2447] dark:via-[#081d38] dark:to-[#051428] p-5 sm:p-7 md:p-8 flex flex-col justify-between min-h-0 sm:min-h-[470px] shadow-[0_10px_35px_rgba(0,0,0,0.06)] dark:shadow-[0_16px_45px_rgba(6,16,51,0.7)] transition-all duration-300 hover:border-cyan-400/60 hover:shadow-[0_20px_50px_rgba(6,182,212,0.25)]"
              >
                {/* Subtle abstract glow and wave background */}
                <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-gradient-to-br from-cyan-500/20 via-teal-500/15 to-transparent blur-3xl group-hover:from-cyan-500/30 transition-all duration-500" />
                <svg
                  className="pointer-events-none absolute right-0 top-0 h-56 w-56 text-cyan-400/20 stroke-current fill-none overflow-visible opacity-40 group-hover:opacity-60 transition-opacity duration-500"
                  viewBox="0 0 200 200"
                >
                  <path
                    d="M20 170 C70 110, 130 150, 195 60"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  <path
                    d="M50 190 C100 120, 160 130, 200 40"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M10 130 C80 80, 130 110, 200 10"
                    strokeWidth="1.8"
                  />
                  {/* Subtle decorative sparkle stars */}
                  <g transform="translate(155, 35) scale(0.7)">
                    <path
                      d="M0 -15 Q0 0 15 0 Q0 0 0 15 Q0 0 -15 0 Q0 0 0 -15 Z"
                      fill="currentColor"
                    />
                  </g>
                  <g transform="translate(180, 95) scale(0.4)">
                    <path
                      d="M0 -15 Q0 0 15 0 Q0 0 0 15 Q0 0 -15 0 Q0 0 0 -15 Z"
                      fill="currentColor"
                    />
                  </g>
                </svg>

                <div className="relative z-10 space-y-6">
                  {/* Icon Container */}
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-cyan-500/25 via-teal-500/20 to-cyan-900/40 border border-cyan-400/40 flex items-center justify-center text-cyan-500 dark:text-cyan-300 shadow-[0_4px_20px_rgba(6,182,212,0.25)] group-hover:border-cyan-300/60 group-hover:scale-105 transition-all duration-300">
                    <Sparkles className="h-8 w-8 text-cyan-500 dark:text-cyan-300" />
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-2">
                    <h3 className="text-xl md:text-[1.3rem] font-bold text-slate-900 dark:text-white font-display tracking-tight flex items-center gap-2">
                      <span>🤖</span>
                      <span>Generate with AI</span>
                    </h3>
                    <p className="text-xs md:text-[0.8125rem] text-slate-600 dark:text-slate-300/80 leading-relaxed max-w-md">
                      Accelerate drafting using machine learning models. Instantly synthesize high-fidelity quizzes from raw documentation or files.
                    </p>
                  </div>

                  {/* Features List */}
                  <ul className="space-y-3 pt-2">
                    <li className="flex items-center gap-2.5 text-xs md:text-[0.8125rem] text-slate-700 dark:text-slate-200">
                      <CheckCircle2 className="h-4.5 w-4.5 text-cyan-500 dark:text-cyan-400 shrink-0" />
                      <span>Generate from PDF / Slides (PPT / PPTX)</span>
                    </li>
                    <li className="flex items-center gap-2.5 text-xs md:text-[0.8125rem] text-slate-700 dark:text-slate-200">
                      <CheckCircle2 className="h-4.5 w-4.5 text-cyan-500 dark:text-cyan-400 shrink-0" />
                      <span>Extract questions from documents (DOCX / TXT)</span>
                    </li>
                    <li className="flex items-center gap-2.5 text-xs md:text-[0.8125rem] text-slate-700 dark:text-slate-200">
                      <CheckCircle2 className="h-4.5 w-4.5 text-cyan-500 dark:text-cyan-400 shrink-0" />
                      <span>Generate directly from raw Prompt Topics</span>
                    </li>
                    <li className="flex items-center gap-2.5 text-xs md:text-[0.8125rem] text-slate-700 dark:text-slate-200">
                      <CheckCircle2 className="h-4.5 w-4.5 text-cyan-500 dark:text-cyan-400 shrink-0" />
                      <span>Synthesize based on learning outcomes</span>
                    </li>
                  </ul>
                </div>

                {/* CTA Button */}
                <div className="relative z-10 pt-8">
                  <Button
                    onClick={handleLaunchAI}
                    className="w-full h-12 bg-gradient-to-r from-cyan-600 via-teal-500 to-cyan-600 hover:from-cyan-500 hover:to-teal-400 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(6,182,212,0.3)] hover:shadow-[0_6px_25px_rgba(6,182,212,0.45)] cursor-pointer border border-cyan-400/30 transition-all group-hover:scale-[1.005]"
                  >
                    <span>Select AI Engine</span>
                    <ArrowRight className="h-4.5 w-4.5" />
                  </Button>
                </div>
              </motion.div>
            </motion.div>

            {/* Bottom Tip Bar */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="relative overflow-hidden rounded-2xl border border-indigo-500/25 bg-slate-100/80 dark:bg-gradient-to-r dark:from-[#101e4a]/90 dark:via-[#0d183f]/95 dark:to-[#101e4a]/90 p-4 sm:p-5 flex items-center justify-between gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(6,16,51,0.6)] backdrop-blur-md"
            >
              {/* Subtle background glow */}
              <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-amber-500/10 blur-2xl" />

              <div className="flex items-center gap-3.5 z-10">
                <div className="h-11 w-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400 shrink-0 shadow-inner shadow-amber-500/10">
                  <Lightbulb className="h-5.5 w-5.5 text-amber-500 dark:text-amber-400" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Tip: You can always switch workflow anytime.
                  </p>
                  <p className="text-[0.75rem] sm:text-xs text-slate-500 dark:text-slate-400 font-normal">
                    Your progress is automatically saved as you build.
                  </p>
                </div>
              </div>

              {/* Decorative golden stars on the right */}
              <div className="hidden sm:flex items-center gap-6 pr-4 opacity-40 pointer-events-none text-amber-500 dark:text-amber-400">
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                </svg>
                <svg className="h-3.5 w-3.5 fill-current opacity-70" viewBox="0 0 24 24">
                  <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                </svg>
              </div>
            </motion.div>
          </div>
        )}

        {/* LOADING ANIMATIONS */}
        {view === "loading" && (
          <motion.div
            key="unified-loader"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-slate-50/80 dark:bg-[#0c1427]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-12 flex flex-col items-center justify-center min-h-[400px] shadow-2xl"
          >
            <AILoader
              steps={
                aiLoading
                  ? [
                      "Connecting to AI generation engine...",
                      "Preparing model response weights...",
                      "Formatting generated questions with validator...",
                      "AI engine workspace ready!"
                    ]
                  : [
                      "Initializing unified quiz editor layout...",
                      "Loading dynamic canvas options...",
                      "Establishing database relationships...",
                      "Configuring timing modes engine...",
                      "Editor workspace ready!"
                    ]
              }
            />
          </motion.div>
        )}

        {view === "ai-generator" && (
          <motion.div
            key="ai-generator-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Left Column: AI Parameters */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-slate-50/80 dark:bg-[#0c1427]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_10px_30px_rgba(2,6,17,0.4)] rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="h-4.5 w-4.5 text-cyan-500 dark:text-cyan-400" />
                  <span>AI Engine Settings</span>
                </h3>

                <div className="space-y-4">
                  {/* Provider Select */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">AI Model Provider</label>
                    <select
                      value={aiProvider}
                      onChange={(e) => {
                        setAiProvider(e.target.value);
                        setAiModel(""); // Reset specific model
                      }}
                      className="w-full bg-slate-100/80 dark:bg-[#121c33]/85 border border-slate-200 dark:border-slate-700/60 rounded-xl h-11 px-3 text-slate-800 dark:text-slate-200 font-medium text-sm focus:border-cyan-500/50 outline-none"
                    >
                      {providers.map((p) => {
                        let label = p.name;
                        if (p.id === "auto") {
                          label = "🤖 Auto (Recommended)";
                        } else if (p.id === "gemini") {
                          label = "💎 Gemini";
                        } else if (p.id === "groq") {
                          label = "⚡ Groq";
                        } else if (p.id === "openai") {
                          label = "🧠 OpenAI";
                        } else if (p.id === "mock") {
                          label = "🛠️ Mock Engine";
                        }
                        return (
                          <option key={p.id} value={p.id} className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Model input (optional override) */}
                  {aiProvider !== "mock" && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Specific Model Override (Optional)</label>
                      <Input
                        type="text"
                        value={aiModel}
                        onChange={(e) => setAiModel(e.target.value)}
                        placeholder={
                          aiProvider === "gemini" 
                            ? "e.g. gemini-1.5-flash" 
                            : aiProvider === "groq"
                            ? "e.g. llama-3.3-70b-versatile"
                            : aiProvider === "openai" 
                            ? "e.g. gpt-4o-mini" 
                            : "Leave blank for default"
                        }
                        className="bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl h-11 text-slate-900 dark:text-white font-medium text-sm focus:border-cyan-500/50"
                      />
                    </div>
                  )}

                  {/* Question Count */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Question Count</label>
                    <Input
                      type="number"
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Math.max(1, Math.min(30, Number(e.target.value))))}
                      min={1}
                      max={30}
                      className="bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl h-11 text-slate-900 dark:text-white font-medium text-sm focus:border-cyan-500/50"
                    />
                  </div>

                  {/* Difficulty */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Difficulty</label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
                      className="w-full bg-slate-100/80 dark:bg-[#121c33]/85 border border-slate-200 dark:border-slate-700/60 rounded-xl h-11 px-3 text-slate-800 dark:text-slate-200 font-medium text-sm focus:border-cyan-500/50 outline-none"
                    >
                      <option value="easy" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">Easy</option>
                      <option value="medium" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">Medium</option>
                      <option value="hard" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">Hard</option>
                    </select>
                  </div>

                  {/* Quiz Style */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Quiz Style</label>
                    <select
                      value={quizStyle}
                      onChange={(e) => setQuizStyle(e.target.value)}
                      className="w-full bg-slate-100/80 dark:bg-[#121c33]/85 border border-slate-200 dark:border-slate-700/60 rounded-xl h-11 px-3 text-slate-800 dark:text-slate-200 font-medium text-sm focus:border-cyan-500/50 outline-none"
                    >
                      <option value="mixed" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">Mixed (Standard)</option>
                      <option value="exam" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">Exam Mode</option>
                      <option value="interview" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">Interview Mode</option>
                      <option value="competitive" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">Competitive Exam (UPSC/GATE)</option>
                      <option value="college" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">College Test</option>
                      <option value="scenario" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">Scenario Based</option>
                      <option value="case_study" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">Case Study</option>
                      <option value="puzzle" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">Puzzle</option>
                      <option value="logical_reasoning" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">Logical Reasoning</option>
                    </select>
                  </div>

                  {/* Quality Strategy */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Generation Quality Mode</label>
                    <select
                      value={questionQuality}
                      onChange={(e) => setQuestionQuality(e.target.value as "fast" | "balanced" | "premium")}
                      className="w-full bg-slate-100/80 dark:bg-[#121c33]/85 border border-slate-200 dark:border-slate-700/60 rounded-xl h-11 px-3 text-slate-800 dark:text-slate-200 font-medium text-sm focus:border-cyan-500/50 outline-none"
                    >
                      <option value="fast" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">Fast (Lower latency, simple questions)</option>
                      <option value="balanced" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">Balanced (Standard reasoning)</option>
                      <option value="premium" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">Premium (Double prompt validation checks)</option>
                    </select>
                  </div>

                  {/* Question Types Checkboxes */}
                  <div className="space-y-2 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Question Formats</label>
                    {[
                      { id: "multiple_choice", label: "Multiple Choice" },
                      { id: "multiple_select", label: "Multiple Select" },
                      { id: "true_false", label: "True / False" },
                      { id: "fill_in_the_blank", label: "Fill in the Blank" },
                      { id: "short_answer", label: "Short Answer" }
                    ].map(type => (
                      <div key={type.id} className="flex items-center justify-between">
                        <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">{type.label}</span>
                        <input
                          type="checkbox"
                          checked={questionTypes.includes(type.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setQuestionTypes([...questionTypes, type.id]);
                            } else {
                              if (questionTypes.length > 1) {
                                setQuestionTypes(questionTypes.filter(t => t !== type.id));
                              } else {
                                toast.error("Select at least one question type.");
                              }
                            }
                          }}
                          className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Bloom Taxonomy levels */}
                  <div className="space-y-2 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Bloom&apos;s Taxonomy levels</label>
                    {["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"].map(level => (
                      <div key={level} className="flex items-center justify-between">
                        <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">{level}</span>
                        <input
                          type="checkbox"
                          checked={bloomLevels.includes(level)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBloomLevels([...bloomLevels, level]);
                            } else {
                              if (bloomLevels.length > 1) {
                                setBloomLevels(bloomLevels.filter(b => b !== level));
                              } else {
                                toast.error("Select at least one Bloom level.");
                              }
                            }
                          }}
                          className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Course Outcomes */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Course / Learning Outcome mapping</label>
                    <Input
                      type="text"
                      value={courseOutcomes}
                      onChange={(e) => setCourseOutcomes(e.target.value)}
                      placeholder="e.g. CO1, CO2, LO3"
                      className="bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl h-11 text-slate-900 dark:text-white font-medium text-sm focus:border-cyan-500/50"
                    />
                  </div>

                  {/* Optional Quiz Metadata */}
                  <div className="space-y-3 pt-3 border-t border-slate-200/80 dark:border-slate-800/80">
                    <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400" />
                      <span>Quiz Metadata (Optional)</span>
                    </h4>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Quiz Title</label>
                      <Input
                        type="text"
                        value={quiz.title}
                        onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
                        placeholder="Leave blank to generate automatically"
                        className="bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl h-10 text-slate-900 dark:text-white font-medium text-xs focus:border-cyan-500/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Subject</label>
                      <Input
                        type="text"
                        value={quiz.subject}
                        onChange={(e) => setQuiz({ ...quiz, subject: e.target.value })}
                        placeholder="Leave blank to generate automatically"
                        className="bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl h-10 text-slate-900 dark:text-white font-medium text-xs focus:border-cyan-500/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Description</label>
                      <textarea
                        value={quiz.description}
                        onChange={(e) => setQuiz({ ...quiz, description: e.target.value })}
                        placeholder="Leave blank to generate automatically"
                        rows={2}
                        className="w-full bg-slate-100/80 dark:bg-[#121c33]/85 border border-slate-200 dark:border-slate-700/60 rounded-xl p-2.5 text-slate-900 dark:text-white font-medium text-xs focus:border-cyan-500/50 outline-none transition-colors resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Source Material Configuration */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-50/80 dark:bg-[#0c1427]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_10px_30px_rgba(2,6,17,0.4)] rounded-2xl p-6 space-y-6">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="h-4.5 w-4.5 text-indigo-500 dark:text-indigo-400" />
                  <span>Context Source Material</span>
                </h3>

                {/* Source Selection Tabs */}
                <div className="flex border-b border-slate-200/80 dark:border-slate-800/80 gap-6">
                  {[
                    { id: "topic", label: "Topic Prompt", icon: MessageSquare },
                    { id: "text", label: "Pasted Text", icon: FileText },
                    { id: "file", label: "Upload Documents", icon: Plus }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSourceType(tab.id as "topic" | "text" | "file")}
                      className={`flex items-center gap-2 pb-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                        sourceType === tab.id
                          ? "text-cyan-600 dark:text-cyan-400 border-cyan-500 dark:border-cyan-400"
                          : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                    >
                      <tab.icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                <div className="space-y-4 min-h-[160px]">
                  {sourceType === "topic" && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">AI Prompt Assistant</label>
                          <p className="text-[10px] text-slate-500 font-medium">Formulate your assessment request using natural language or voice.</p>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-[10px] font-bold uppercase tracking-wider select-none">
                          <Sparkles className="h-3 w-3 motion-safe:animate-pulse" />
                          <span>AI Powered</span>
                        </div>
                      </div>

                      {/* --- Premium Prompt Composer Container --- */}
                      <div className="relative group rounded-2xl border border-slate-200 dark:border-slate-700/70 bg-slate-100/60 dark:bg-[#111a30]/80 focus-within:border-purple-500/60 focus-within:ring-4 focus-within:ring-purple-500/10 transition-all duration-300 overflow-hidden">
                        <textarea
                          ref={textareaRef}
                          value={topic}
                          onChange={(e) => setTopic(e.target.value)}
                          placeholder="Speak or type your topic...&#10;Example:&#10;Generate 20 medium-level conceptual questions on Foundation of Machine Learning Unit 2 focusing on similarity measures and distance metrics."
                          disabled={enhancementLoading}
                          rows={3}
                          aria-label="AI Prompt Assistant Composer"
                          className="w-full bg-transparent border-0 rounded-2xl p-4 text-slate-900 dark:text-white font-medium text-sm focus:ring-0 outline-none resize-none min-h-[96px] placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-medium leading-relaxed"
                          onKeyDown={(e) => {
                            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                              e.preventDefault();
                              setIsPreviewOpen(true);
                            }
                          }}
                        />
                      </div>

                      {/* Horizontal Voice Waveform (ChatGPT Style) */}
                      {voiceState !== "ready" && (
                        <div className="pt-1">
                          <VoiceWaveform
                            state={voiceState}
                            durationSeconds={recordingTime}
                            errorMessage={voiceError}
                            onStop={stopRecording}
                            onRetry={startRecording}
                          />
                        </div>
                      )}

                      {/* Character Count & Shortcuts bar */}
                      <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 px-1 select-none">
                        <span>Characters: {topic.length}</span>
                        <span>Press <kbd className="font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-[9px] text-slate-700 dark:text-slate-300">{osLabel}</kbd> + <kbd className="font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-[9px] text-slate-700 dark:text-slate-300">Enter</kbd> to preview</span>
                      </div>

                      {/* Retry Option Banner if last call failed */}
                      {lastFailedPrompt && !enhancementLoading && (
                        <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-300 text-xs w-full">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                            <span className="font-medium">The last AI prompt enhancement request encountered a network or API issue.</span>
                          </div>
                          <button
                            type="button"
                            onClick={handleEnhancePrompt}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold border border-amber-500/30 cursor-pointer transition-colors"
                          >
                            Retry Enhancement
                          </button>
                        </div>
                      )}

                      {/* --- Control Actions: Enhance, Preview, recommendations --- */}
                      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            disabled={enhancementLoading || isRecording || !topic.trim()}
                            onClick={handleEnhancePrompt}
                            className="h-10 px-4 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-300 font-semibold text-xs border border-purple-500/20 cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {enhancementLoading ? (
                              <>
                                <svg className="animate-spin h-3.5 w-3.5 text-purple-500 dark:text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Enhancing...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
                                <span>Enhance with AI</span>
                              </>
                            )}
                          </Button>

                          <Button
                            type="button"
                            disabled={!topic.trim() || isRecording}
                            onClick={() => setIsPreviewOpen(true)}
                            className="h-10 px-4 rounded-xl bg-slate-100 dark:bg-[#121c33] hover:bg-slate-200 dark:hover:bg-[#182645] text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-200 dark:border-slate-700/60 cursor-pointer flex items-center gap-2 transition-colors"
                          >
                            <FileText className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                            <span>Preview Prompt</span>
                          </Button>

                          <Button
                            type="button"
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`h-10 px-4 rounded-xl font-semibold text-xs border border-slate-200 dark:border-slate-700/60 cursor-pointer flex items-center gap-2 transition-all duration-200 ${
                              isRecording
                                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/25"
                                : "bg-slate-100 dark:bg-[#121c33] hover:bg-slate-200 dark:hover:bg-[#182645] text-slate-700 dark:text-slate-300"
                            }`}
                            title={isRecording ? "Stop voice input" : "Voice input (Speech-to-text)"}
                          >
                            <Mic className={`h-3.5 w-3.5 ${isRecording ? "text-white motion-safe:animate-pulse" : "text-rose-500 dark:text-rose-400"}`} />
                            <span>{isRecording ? "Stop Recording" : "Voice Input"}</span>
                          </Button>

                          <Button
                            type="button"
                            disabled={isRecording}
                            onClick={() => setSourceType("file")}
                            className="h-10 px-4 rounded-xl bg-slate-100 dark:bg-[#121c33] hover:bg-slate-200 dark:hover:bg-[#182645] text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-200 dark:border-slate-700/60 cursor-pointer flex items-center gap-2 transition-colors"
                            title="Switch to document upload mode"
                          >
                            <Plus className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                            <span>Upload PDF / Slides</span>
                          </Button>
                        </div>

                        {/* Recommendations panel */}
                        {recommendation && (
                          <div className="flex items-center gap-2 p-2 rounded-xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/15 text-slate-700 dark:text-slate-300 text-xs w-full sm:w-auto">
                            <div className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase shrink-0">Recommendation:</div>
                            <div className="truncate font-semibold text-[11px] text-slate-600 dark:text-slate-400">
                              {recommendation.questionCount} Qs • {recommendation.difficulty} • {recommendation.duration} mins
                            </div>
                            <button
                              type="button"
                              onClick={applySuggestions}
                              className="ml-auto px-2 py-1 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-600 dark:text-purple-300 text-[10px] font-bold border border-purple-500/35 cursor-pointer transition-colors"
                            >
                              Apply
                            </button>
                          </div>
                        )}
                      </div>

                      {/* --- AI Capability Cards --- */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
                        {[
                          { title: "🎤 Voice Input", desc: "Speak naturally", color: "hover:border-rose-500/30 hover:bg-rose-500/5 border-slate-200 dark:border-slate-800/80 bg-slate-100/50 dark:bg-[#111a30]/60" },
                          { title: "✨ AI Enhancement", desc: "Improve prompts automatically", color: "hover:border-purple-500/30 hover:bg-purple-500/5 border-slate-200 dark:border-slate-800/80 bg-slate-100/50 dark:bg-[#111a30]/60" },
                          { title: "⚡ Auto Fill", desc: "Suggest optimal quiz settings", color: "hover:border-cyan-500/30 hover:bg-cyan-500/5 border-slate-200 dark:border-slate-800/80 bg-slate-100/50 dark:bg-[#111a30]/60" },
                          { title: "🎯 Better Results", desc: "Higher quality AI-generated quizzes", color: "hover:border-emerald-500/30 hover:bg-emerald-500/5 border-slate-200 dark:border-slate-800/80 bg-slate-100/50 dark:bg-[#111a30]/60" }
                        ].map((card, idx) => (
                          <motion.div
                            key={idx}
                            whileHover={{ scale: 1.02, translateY: -2 }}
                            className={`p-4 rounded-2xl border cursor-default select-none transition-all duration-200 flex flex-col space-y-1 ${card.color}`}
                          >
                            <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">{card.title}</h4>
                            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 leading-normal">{card.desc}</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {sourceType === "text" && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Pasted Reference Content</label>
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Paste guidelines details, textbook excerpts, or notes here..."
                        rows={6}
                        className="w-full bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3 text-slate-900 dark:text-white font-medium text-sm focus:border-cyan-500/50 outline-none"
                      />
                    </div>
                  )}

                  {sourceType === "file" && (
                    <div className="space-y-6">
                      <div className="text-center max-w-md mx-auto space-y-2 select-none">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">Choose Document Source</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Upload your reference material to let the AI analyze and generate contextually accurate questions.
                        </p>
                      </div>

                      {selectedFiles.length === 0 ? (
                        <div className="space-y-5">
                          {/* Centered Drag & Drop Box */}
                          <div
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (!aiLoading) {
                                setIsDragging(true);
                              }
                            }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setIsDragging(false);
                              if (!aiLoading && e.dataTransfer.files) {
                                validateAndSetFiles(Array.from(e.dataTransfer.files));
                              }
                            }}
                            onClick={() => {
                              if (!aiLoading) {
                                generalFileInputRef.current?.click();
                              }
                            }}
                            className={`border-2 border-dashed rounded-3xl p-10 text-center transition-all duration-300 flex flex-col items-center justify-center space-y-4 ${
                              aiLoading 
                                ? "opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-800 bg-slate-100/30 dark:bg-slate-900/20" 
                                : isDragging
                                ? "border-cyan-500 bg-cyan-500/10 scale-[1.01] shadow-[0_0_25px_rgba(6,182,212,0.15)] cursor-pointer"
                                : "border-slate-300 dark:border-slate-700/80 bg-slate-100/50 dark:bg-[#111a30]/50 hover:bg-slate-100 dark:hover:bg-[#15203c] hover:border-cyan-500/50 hover:scale-[1.005] cursor-pointer"
                            }`}
                          >
                            <div className="h-14 w-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shadow-lg shadow-cyan-500/5">
                              <UploadCloud className="h-7 w-7" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Drag & Drop Here</h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">or click this card to browse files</p>
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-wider uppercase select-none pt-3 border-t border-slate-200/80 dark:border-slate-800/80 w-full">
                              Supported Formats: .pdf, .ppt, .pptx · Max size: 20 MB
                            </div>
                            
                            <input
                              type="file"
                              ref={generalFileInputRef}
                              onChange={(e) => {
                                if (e.target.files) {
                                  validateAndSetFiles(Array.from(e.target.files));
                                }
                              }}
                              disabled={aiLoading}
                              accept=".pdf,.ppt,.pptx"
                              className="hidden"
                            />
                          </div>

                          {/* Friendly Validation Error Message Inline */}
                          {validationError && (
                            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-300 text-xs font-semibold flex items-start gap-2.5 max-w-md mx-auto leading-normal">
                              <AlertCircle className="h-4.5 w-4.5 shrink-0 text-rose-500 dark:text-rose-400 mt-0.5" />
                              <span>{validationError}</span>
                            </div>
                          )}

                          {/* Quick Upload Buttons */}
                          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto select-none pt-1">
                            <Button
                              type="button"
                              disabled={aiLoading}
                              onClick={() => pdfFileInputRef.current?.click()}
                              className="h-11 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-100 dark:bg-[#121c33] hover:bg-slate-200 dark:hover:bg-[#182645] hover:border-cyan-500/30 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <FileText className="h-4 w-4 text-rose-500 dark:text-rose-400" />
                              <span>Upload PDF</span>
                              <input
                                type="file"
                                ref={pdfFileInputRef}
                                onChange={(e) => {
                                  if (e.target.files) {
                                    validateAndSetFiles(Array.from(e.target.files));
                                  }
                                }}
                                disabled={aiLoading}
                                accept=".pdf"
                                className="hidden"
                              />
                            </Button>

                            <Button
                              type="button"
                              disabled={aiLoading}
                              onClick={() => pptFileInputRef.current?.click()}
                              className="h-11 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-100 dark:bg-[#121c33] hover:bg-slate-200 dark:hover:bg-[#182645] hover:border-cyan-500/30 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Presentation className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                              <span>Upload PPT / PPTX</span>
                              <input
                                type="file"
                                ref={pptFileInputRef}
                                onChange={(e) => {
                                  if (e.target.files) {
                                    validateAndSetFiles(Array.from(e.target.files));
                                  }
                                }}
                                disabled={aiLoading}
                                accept=".ppt,.pptx"
                                className="hidden"
                              />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* Uploaded file preview card (Premium Styling) */
                        <div className="max-w-md mx-auto p-5 rounded-2xl bg-slate-100/80 dark:bg-[#121c33]/85 border border-slate-200 dark:border-slate-700/80 space-y-4 shadow-xl relative overflow-hidden">
                          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 pb-3">
                            <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Uploaded Document
                            </span>
                            <span className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2.5 py-1 rounded-md select-none">
                              <Check className="h-3.5 w-3.5" /> Ready
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0 select-none">
                              {selectedFiles[0]?.name.toLowerCase().endsWith(".pdf") ? (
                                <FileText className="h-6 w-6 text-rose-500 dark:text-rose-400 animate-pulse" />
                              ) : (
                                <Presentation className="h-6 w-6 text-amber-500 dark:text-amber-400 animate-pulse" />
                              )}
                            </div>
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                                {selectedFiles[0]?.name}
                              </div>
                              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                {selectedFiles[0] ? (selectedFiles[0].size / 1024 / 1024).toFixed(2) : 0} MB
                              </div>
                            </div>
                          </div>

                          {/* Control Action Buttons */}
                          <div className="flex gap-3 pt-2 select-none">
                            <Button
                              type="button"
                              disabled={aiLoading}
                              onClick={() => {
                                const ext = "." + selectedFiles[0]?.name.split(".").pop()?.toLowerCase();
                                if (ext === ".pdf") {
                                  pdfFileInputRef.current?.click();
                                } else {
                                  pptFileInputRef.current?.click();
                                }
                              }}
                              className="flex-1 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-200/60 dark:bg-slate-800/80 hover:bg-slate-300/60 dark:hover:bg-slate-700 hover:border-cyan-500/30 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <RotateCcw className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                              <span>Replace</span>
                            </Button>
                            <Button
                              type="button"
                              disabled={aiLoading}
                              onClick={() => {
                                setSelectedFiles([]);
                                setValidationError(null);
                              }}
                              className="h-9 w-20 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Remove</span>
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Additional instructions */}
                <div className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Custom Instructor Instructions (Optional)</label>
                    <textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="e.g. 'Use scenario-based application questions', 'Avoid math calculation equations'..."
                      rows={2}
                      className="w-full bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3 text-slate-900 dark:text-white font-medium text-xs focus:border-cyan-500/50 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Specify Question Distribution (Optional)</label>
                      <Input
                        type="text"
                        value={questionDistribution}
                        onChange={(e) => setQuestionDistribution(e.target.value)}
                        placeholder="e.g. 40% Easy, 60% Medium..."
                        className="bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl h-11 text-slate-900 dark:text-white font-medium text-xs focus:border-cyan-500/50"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button
                    onClick={handleGenerateAI}
                    disabled={aiLoading || (sourceType === "file" && selectedFiles.length === 0)}
                    className="h-11 px-8 bg-gradient-to-r from-cyan-600 via-indigo-600 to-indigo-700 hover:from-cyan-500 hover:via-indigo-500 hover:to-indigo-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/20 border-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {aiLoading ? (
                      <>
                        <Loader2 className="h-4.5 w-4.5 animate-spin" />
                        <span>AI Generating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4.5 w-4.5 animate-pulse" />
                        <span>Generate Quiz with AI</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* WORKSPACE UNIFIED EDITOR */}
        {view === "editor" && (
          <motion.div
            key="unified-editor-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* PROGRESS INDICATOR */}
            {renderProgressIndicator()}

            {/* TAB CONTENT CAROUSEL */}
            <div className="min-h-[500px]">
              
              {/* TAB 1: QUIZ DETAILS */}
              {activeTab === "details" && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-6"
                >
                  <div className="md:col-span-2 space-y-6">
                    <div className="bg-slate-50/80 dark:bg-[#0c1427]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_10px_30px_rgba(2,6,17,0.4)] rounded-2xl p-6 space-y-4">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <FileText className="h-4.5 w-4.5 text-indigo-500 dark:text-indigo-400" />
                        <span>General Metadata</span>
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5 col-span-2">
                          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Quiz Title *</label>
                          <Input
                            type="text"
                            value={quiz.title}
                            onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
                            placeholder="Enter a descriptive quiz title..."
                            className="bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl h-11 text-slate-900 dark:text-white font-medium text-sm focus:border-indigo-500/50"
                          />
                        </div>

                        <div className="space-y-1.5 col-span-2">
                          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Description / Instructions</label>
                          <textarea
                            value={quiz.description}
                            onChange={(e) => setQuiz({ ...quiz, description: e.target.value })}
                            placeholder="Add guidelines, syllabus scope, or details..."
                            rows={3}
                            className="w-full bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3 text-slate-900 dark:text-white font-medium text-sm focus:border-indigo-500/50 outline-none transition-colors"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Subject *</label>
                          <Input
                            type="text"
                            value={quiz.subject}
                            onChange={(e) => setQuiz({ ...quiz, subject: e.target.value })}
                            placeholder="e.g. Computer Science"
                            className="bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl h-11 text-slate-900 dark:text-white font-medium text-sm focus:border-indigo-500/50"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Department</label>
                          <Input
                            type="text"
                            value={quiz.department}
                            onChange={(e) => setQuiz({ ...quiz, department: e.target.value })}
                            placeholder="e.g. Software Engineering"
                            className="bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl h-11 text-slate-900 dark:text-white font-medium text-sm focus:border-indigo-500/50"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Semester</label>
                          <Input
                            type="text"
                            value={quiz.semester}
                            onChange={(e) => setQuiz({ ...quiz, semester: e.target.value })}
                            placeholder="e.g. Fall 2026"
                            className="bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl h-11 text-slate-900 dark:text-white font-medium text-sm focus:border-indigo-500/50"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Pass Percentage (%)</label>
                          <Input
                            type="number"
                            value={quiz.pass_percentage}
                            onChange={(e) => setQuiz({ ...quiz, pass_percentage: Number(e.target.value) })}
                            min={0}
                            max={100}
                            className="bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl h-11 text-slate-900 dark:text-white font-medium text-sm focus:border-indigo-500/50"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Marks Assignment Mode</label>
                          <select
                            value={quiz.marks_mode || "default"}
                            onChange={(e) => handleToggleMarksMode(e.target.value as "default" | "auto")}
                            className="w-full bg-slate-100/80 dark:bg-[#121c33]/85 border border-slate-200 dark:border-slate-700/60 rounded-xl h-11 px-3 text-slate-800 dark:text-slate-200 font-medium text-sm focus:border-indigo-500/50 outline-none"
                          >
                            <option value="default" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">Default Marks (Constant)</option>
                            <option value="auto" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">Auto Marks (Scale by Difficulty)</option>
                          </select>
                        </div>

                        {(quiz.marks_mode === "default" || !quiz.marks_mode) && (
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Default Marks per Question</label>
                            <Input
                              type="number"
                              value={quiz.default_marks || 1}
                              onChange={(e) => handleDefaultMarksChange(Math.max(1, Number(e.target.value)))}
                              min={1}
                              className="bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl h-11 text-slate-900 dark:text-white font-medium text-sm focus:border-indigo-500/50"
                            />
                          </div>
                        )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                    {/* PUBLISH READINESS CHECKLIST */}
                    {(() => {
                      const { checks, score, isReady } = getPublishReadiness();
                      return (
                        <div className="bg-slate-50/80 dark:bg-[#0c1427]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_10px_30px_rgba(2,6,17,0.4)] rounded-2xl p-6 space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              <ShieldAlert className="h-4.5 w-4.5 text-indigo-500 dark:text-indigo-400" />
                              <span>Publish Readiness</span>
                            </h3>
                            <span className={`text-sm font-extrabold ${isReady ? "text-emerald-500 dark:text-emerald-400" : "text-amber-500 dark:text-amber-400"}`}>
                              {score}%
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 relative overflow-hidden">
                            <div 
                              className={`h-2 rounded-full transition-all duration-500 ${
                                isReady ? "bg-gradient-to-r from-emerald-500 to-teal-500" : "bg-gradient-to-r from-amber-500 to-orange-500"
                              }`}
                              style={{ width: `${score}%` }}
                            />
                          </div>

                          {/* Checklist details */}
                          <div className="space-y-2 pt-2 text-xs font-semibold select-none">
                            <div className="flex items-center gap-2">
                              {checks.hasTitle ? (
                                <Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                              ) : (
                                <span className="text-rose-500 font-bold shrink-0 w-4 text-center">✖</span>
                              )}
                              <span className={checks.hasTitle ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"}>
                                Quiz Title {!checks.hasTitle && <span className="text-rose-500 dark:text-rose-400 font-bold">(Required)</span>}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {checks.hasSubject ? (
                                <Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                              ) : (
                                <span className="text-rose-500 font-bold shrink-0 w-4 text-center">✖</span>
                              )}
                              <span className={checks.hasSubject ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"}>
                                Subject / Category {!checks.hasSubject && <span className="text-rose-500 dark:text-rose-400 font-bold">(Required)</span>}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {checks.hasQuestions ? (
                                <Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                              ) : (
                                <span className="text-rose-500 font-bold shrink-0 w-4 text-center">✖</span>
                              )}
                              <span className={checks.hasQuestions ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"}>
                                At least one question {!checks.hasQuestions && <span className="text-rose-500 dark:text-rose-400 font-bold">(Required)</span>}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {checks.hasCorrectAnswers ? (
                                <Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                              ) : (
                                <span className="text-rose-500 font-bold shrink-0 w-4 text-center">✖</span>
                              )}
                              <span className={checks.hasCorrectAnswers ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"}>
                                Correct answers selected {!checks.hasCorrectAnswers && <span className="text-rose-500 dark:text-rose-400 font-bold">(Required)</span>}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {checks.hasSchedule ? (
                                <Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0" />
                              )}
                              <span className={checks.hasSchedule ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"}>
                                Schedule & Availability {!checks.hasSchedule && <span className="text-amber-500 dark:text-amber-400">(Warning: unscheduled)</span>}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {checks.hasTimeLimit ? (
                                <Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0" />
                              )}
                              <span className={checks.hasTimeLimit ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"}>
                                Time Limit configured {!checks.hasTimeLimit && <span className="text-amber-500 dark:text-amber-400">(Warning: no timer)</span>}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {checks.missingExplanationsCount === 0 ? (
                                <Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0" />
                              )}
                              <span className={checks.missingExplanationsCount === 0 ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"}>
                                Explanation feedback {checks.missingExplanationsCount > 0 && (
                                  <span className="text-amber-500 dark:text-amber-400">({checks.missingExplanationsCount} missing explanation{checks.missingExplanationsCount > 1 ? "s" : ""})</span>
                                )}
                              </span>
                            </div>
                          </div>

                          {!isReady && (
                            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-600 dark:text-rose-300 leading-relaxed font-semibold">
                              Please fill out all required fields marked with ✖ to enable publishing.
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div className="bg-slate-50/80 dark:bg-[#0c1427]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_10px_30px_rgba(2,6,17,0.4)] rounded-2xl p-6 space-y-4">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Settings className="h-4.5 w-4.5 text-indigo-500 dark:text-indigo-400" />
                        <span>Security & Access</span>
                      </h3>

                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Quiz Reference Code</label>
                          <div className="flex gap-2">
                            <Input
                              type="text"
                              value={quiz.quiz_code}
                              onChange={(e) => setQuiz({ ...quiz, quiz_code: e.target.value })}
                              placeholder="e.g. MATH-101"
                              className="bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl h-11 text-slate-900 dark:text-white font-medium text-sm focus:border-indigo-500/50"
                            />
                            <button
                              type="button"
                              onClick={() => setQuiz({ ...quiz, quiz_code: `QZ-${Math.floor(100000 + Math.random() * 900000)}` })}
                              className="px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer font-semibold text-xs"
                            >
                              Reset
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Visibility</label>
                          <select
                            value={quiz.visibility}
                            onChange={(e) => setQuiz({ ...quiz, visibility: e.target.value as "public" | "private" })}
                            className="w-full bg-slate-100/80 dark:bg-[#121c33]/85 border border-slate-200 dark:border-slate-700/60 rounded-xl h-11 px-3 text-slate-800 dark:text-slate-200 font-medium text-sm focus:border-indigo-500/50 outline-none"
                          >
                            <option value="public" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">Public (All Classroom)</option>
                            <option value="private" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">Private (Invite Only)</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Max Attempts Allowed</label>
                          <Input
                            type="number"
                            value={quiz.max_attempts}
                            onChange={(e) => setQuiz({ ...quiz, max_attempts: Number(e.target.value) })}
                            min={1}
                            className="bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl h-11 text-slate-900 dark:text-white font-medium text-sm focus:border-indigo-500/50"
                          />
                        </div>

                        {/* Interactive toggles */}
                        <div className="space-y-3 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <Shuffle className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                                <span>Shuffle Questions</span>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={quiz.randomize_questions}
                              onChange={(e) => setQuiz({ ...quiz, randomize_questions: e.target.checked })}
                              className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <Shuffle className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                                <span>Shuffle Options</span>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={quiz.randomize_options}
                              onChange={(e) => setQuiz({ ...quiz, randomize_options: e.target.checked })}
                              className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <Shield className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />
                                <span>Anti-Cheating Safeguards</span>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={quiz.anti_cheating_enabled}
                              onChange={(e) => setQuiz({ ...quiz, anti_cheating_enabled: e.target.checked })}
                              className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <Activity className="h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400" />
                                <span>AI Evaluation Feedback</span>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={quiz.ai_feedback_enabled}
                              onChange={(e) => setQuiz({ ...quiz, ai_feedback_enabled: e.target.checked })}
                              className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </div>
                        </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

              {/* TAB 2: SCHEDULE & TIMING */}
              {activeTab === "schedule" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-6"
                >
                  <div className="md:col-span-2 space-y-6">
                    {/* TIMING CONFIGURATION */}
                    <div className="bg-slate-50/80 dark:bg-[#0c1427]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_10px_30px_rgba(2,6,17,0.4)] rounded-2xl p-6 space-y-4">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Clock className="h-4.5 w-4.5 text-indigo-500 dark:text-indigo-400" />
                        <span>Flexible Timer Configuration</span>
                      </h3>

                      <div className="space-y-4">
                        {/* Mode Select */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { id: "none", label: "No Timer", desc: "Untimed play" },
                            { id: "overall", label: "Overall Timer", desc: "Single quiz countdown" },
                            { id: "per_question", label: "Per-Question", desc: "Every question timed" },
                            { id: "both", label: "Both Timers", desc: "Dual timing modes" }
                          ].map(mode => (
                            <button
                              key={mode.id}
                              type="button"
                              onClick={() => handleTimerModeChange(mode.id as any)}
                              className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                                quiz.timer_mode === mode.id
                                  ? "bg-indigo-500/10 dark:bg-indigo-500/15 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.1)] text-indigo-700 dark:text-indigo-300 font-bold"
                                  : "bg-slate-100/70 dark:bg-[#121c33]/70 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-[#182645] hover:text-slate-900 dark:hover:text-slate-200"
                              }`}
                            >
                              <div className="text-xs font-bold">{mode.label}</div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{mode.desc}</div>
                            </button>
                          ))}
                        </div>

                        {/* Overall Timer Settings */}
                        {(quiz.timer_mode === "overall" || quiz.timer_mode === "both") && (
                          <div className="p-4 rounded-xl bg-slate-100/60 dark:bg-[#111a30]/80 border border-slate-200 dark:border-slate-700/60 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                              <div className="space-y-1">
                                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Overall Quiz Time Limit</h4>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">Choose a predefined countdown limit or enter a custom amount.</p>
                              </div>
                              <div className="flex gap-2">
                                {PREDEFINED_OVERALL_TIMERS.map(preset => (
                                  <button
                                    key={preset.value}
                                    type="button"
                                    onClick={() => setQuiz({ ...quiz, overall_time_limit_seconds: preset.value })}
                                    className={`px-3 py-1 rounded-lg text-xs font-semibold border cursor-pointer transition-all ${
                                      quiz.overall_time_limit_seconds === preset.value
                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                        : "bg-slate-200/70 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300/70 dark:hover:bg-slate-700"
                                    }`}
                                  >
                                    {preset.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                              <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 font-display">Custom Limit (seconds)</label>
                                <Input
                                  type="number"
                                  value={quiz.overall_time_limit_seconds || ""}
                                  onChange={(e) => setQuiz({ ...quiz, overall_time_limit_seconds: e.target.value ? Number(e.target.value) : null })}
                                  placeholder="Enter custom seconds..."
                                  className="bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl h-11 text-slate-900 dark:text-white font-medium text-sm focus:border-indigo-500/50"
                                />
                              </div>
                              {/* Auto submit toggler */}
                              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-200/50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 mt-6">
                                <div className="space-y-0.5">
                                  <div className="text-xs font-bold text-slate-900 dark:text-white">Auto-Submit on Expiry</div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Instantly submits draft once time expires.</div>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={quiz.auto_submit_on_expiry}
                                  onChange={(e) => setQuiz({ ...quiz, auto_submit_on_expiry: e.target.checked })}
                                  className="h-4.5 w-4.5 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Per Question info */}
                        {(quiz.timer_mode === "per_question" || quiz.timer_mode === "both") && (
                          <div className="p-4 rounded-xl bg-cyan-500/10 dark:bg-cyan-950/20 border border-cyan-500/25 flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <h4 className="text-xs font-bold text-cyan-700 dark:text-cyan-300">Per-Question timing enabled!</h4>
                              <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-normal">
                                Instructors can define specific timers for each question inside the Canvas. Once time runs out on a question, the client automatically forwards the student to the next question.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                      {/* Assessment Windows & Instructions Panel */}
                      <div className="bg-slate-50/80 dark:bg-[#0c1427]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_10px_30px_rgba(2,6,17,0.4)] rounded-2xl p-6 space-y-4">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <Clock className="h-4.5 w-4.5 text-cyan-500 dark:text-cyan-400" />
                          <span>Schedule & Guidelines</span>
                        </h3>

                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Available From</label>
                              <Input
                                type="datetime-local"
                                value={quiz.available_from || ""}
                                onChange={(e) => setQuiz({ ...quiz, available_from: e.target.value || null })}
                                className="bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl h-11 text-slate-900 dark:text-white text-xs focus:border-indigo-500/50 outline-none"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Available Until</label>
                              <Input
                                type="datetime-local"
                                value={quiz.available_until || ""}
                                onChange={(e) => setQuiz({ ...quiz, available_until: e.target.value || null })}
                                className="bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl h-11 text-slate-900 dark:text-white text-xs focus:border-indigo-500/50 outline-none"
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Access Passcode (Optional)</label>
                            <Input
                              type="text"
                              value={quiz.access_code || ""}
                              onChange={(e) => setQuiz({ ...quiz, access_code: e.target.value })}
                              placeholder="e.g. SECURE123"
                              className="bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl h-11 text-slate-900 dark:text-white font-medium text-sm focus:border-indigo-500/50"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Custom Instructor Instructions</label>
                            <textarea
                              value={quiz.custom_instructions || ""}
                              onChange={(e) => setQuiz({ ...quiz, custom_instructions: e.target.value })}
                              placeholder="Provide custom instructions to display before starting..."
                              rows={3}
                              className="w-full bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3 text-slate-900 dark:text-white font-medium text-xs focus:border-indigo-500/50 outline-none transition-colors"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Result Visibility & Review Permissions Panel */}
                      <div className="bg-slate-50/80 dark:bg-[#0c1427]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_10px_30px_rgba(2,6,17,0.4)] rounded-2xl p-6 space-y-4">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <FileText className="h-4.5 w-4.5 text-indigo-500 dark:text-indigo-400" />
                          <span>Result Visibility & Permissions</span>
                        </h3>

                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Release Mode</label>
                            <select
                              value={quiz.result_visibility}
                              onChange={(e) => setQuiz({ ...quiz, result_visibility: e.target.value as any })}
                              className="w-full bg-slate-100/80 dark:bg-[#121c33]/85 border border-slate-200 dark:border-slate-700/60 rounded-xl h-11 px-3 text-slate-800 dark:text-slate-200 font-medium text-sm focus:border-indigo-500/50 outline-none"
                            >
                              <option value="immediate" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">Immediate Release (Upon Submission)</option>
                              <option value="after_due_date" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">After Due Date (Requires End Date)</option>
                              <option value="manual_release" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">Manual Release (Instructor Triggered)</option>
                              <option value="never" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">Never (Keep Private)</option>
                            </select>
                          </div>

                          <div className="space-y-3 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Show Score & Percentage</span>
                              <input
                                type="checkbox"
                                checked={quiz.show_score}
                                onChange={(e) => setQuiz({ ...quiz, show_score: e.target.checked })}
                                className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Show Correct/Incorrect Answers</span>
                              <input
                                type="checkbox"
                                checked={quiz.show_answers}
                                onChange={(e) => setQuiz({ ...quiz, show_answers: e.target.checked })}
                                className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Show Answer Explanations</span>
                              <input
                                type="checkbox"
                                checked={quiz.show_explanations}
                                onChange={(e) => setQuiz({ ...quiz, show_explanations: e.target.checked })}
                                className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Show Grading Solutions</span>
                              <input
                                type="checkbox"
                                checked={quiz.show_solutions}
                                onChange={(e) => setQuiz({ ...quiz, show_solutions: e.target.checked })}
                                className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Show Marks per Question</span>
                              <input
                                type="checkbox"
                                checked={quiz.show_marks}
                                onChange={(e) => setQuiz({ ...quiz, show_marks: e.target.checked })}
                                className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </div>

                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

              {/* TAB 2: QUESTIONS CANVAS */}
              {activeTab === "questions" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  {/* Mobile Question Selector Strip (Shown on screens < lg) */}
                  <div className="block lg:hidden bg-slate-50/80 dark:bg-[#0c1427]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3 shadow-sm space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <ListTodo className="h-3.5 w-3.5 text-indigo-500" />
                        Questions ({quiz.questions.length})
                      </span>
                      <Button
                        type="button"
                        onClick={addQuestion}
                        className="h-7 px-2.5 text-[11px] font-bold rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/30 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Add Q</span>
                      </Button>
                    </div>
                    {/* Horizontal scrollable question pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {quiz.questions.map((q, idx) => (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => setSelectedQuestionIndex(idx)}
                          className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            selectedQuestionIndex === idx
                              ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25 scale-105"
                              : "bg-slate-200/70 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 border border-slate-300/60 dark:border-slate-700/60"
                          }`}
                        >
                          <span>Q{idx + 1}</span>
                          {q.generated_by_ai && <Sparkles className="h-2.5 w-2.5 text-cyan-300" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Desktop Sidebar list */}
                    <div className="hidden lg:block lg:col-span-1 space-y-4">
                      <div className="bg-slate-50/80 dark:bg-[#0c1427]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_10px_30px_rgba(2,6,17,0.4)] rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Questions List</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold">
                            {quiz.questions.length} Items
                          </span>
                        </div>

                        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                          {quiz.questions.map((q, idx) => (
                            <div
                              key={q.id}
                              onClick={() => setSelectedQuestionIndex(idx)}
                              className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between group relative ${
                                selectedQuestionIndex === idx
                                  ? "bg-indigo-500/15 dark:bg-indigo-500/20 border-indigo-500/40 text-slate-900 dark:text-white shadow-sm"
                                  : "bg-slate-100/60 dark:bg-[#10192e]/60 border-slate-200/60 dark:border-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-[#14203a] hover:text-slate-900 dark:hover:text-slate-200"
                              }`}
                            >
                              {duplicateWarnings[idx] && (
                                <div className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500 animate-pulse" title="Similarity warning" />
                              )}
                              <div className="space-y-1 truncate pr-2">
                                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                  Question {idx + 1} • {q.question_type.replace("_", " ")}
                                </div>
                                <div className="text-xs font-semibold truncate">
                                  {q.text || "Untitled blank question..."}
                                </div>
                              </div>
                              {/* Reorder / Regenerate / Delete */}
                              <div className="flex gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={(e) => { e.stopPropagation(); moveQuestion(idx, "up"); }}
                                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 disabled:opacity-30 cursor-pointer"
                                  title="Move up"
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === quiz.questions.length - 1}
                                  onClick={(e) => { e.stopPropagation(); moveQuestion(idx, "down"); }}
                                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 disabled:opacity-30 cursor-pointer"
                                  title="Move down"
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </button>
                                {/* Quick regenerate icon — only for AI-generated questions */}
                                {q.generated_by_ai && (
                                  <button
                                    type="button"
                                    disabled={regeneratingIndex !== null}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedQuestionIndex(idx);
                                      handleRegenerateQuestion(idx);
                                    }}
                                    className="p-1 rounded hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 disabled:opacity-30 cursor-pointer transition-colors"
                                    title="Regenerate this AI question"
                                  >
                                    {regeneratingIndex === idx
                                      ? <Loader2 className="h-3 w-3 animate-spin" />
                                      : <RefreshCw className="h-3 w-3" />}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); deleteQuestion(idx); }}
                                  className="p-1 rounded hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 cursor-pointer"
                                  title="Delete question"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <Button
                          onClick={addQuestion}
                          className="w-full h-10 border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add Question</span>
                        </Button>
                      </div>
                    </div>

                    {/* Main editing area */}
                    <div className="lg:col-span-3 space-y-6">
                      {quiz.questions[selectedQuestionIndex] ? (
                        <div className="relative bg-slate-50/80 dark:bg-[#0c1427]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_10px_30px_rgba(2,6,17,0.4)] rounded-2xl p-4 sm:p-6 space-y-6">

                          {/* Targeted Regeneration Loading Overlay */}
                          {regeneratingIndex === selectedQuestionIndex && (
                            <div className="absolute inset-0 bg-slate-100/90 dark:bg-[#060b18]/90 backdrop-blur-[2px] rounded-2xl z-20 flex flex-col items-center justify-center space-y-3">
                              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-500 dark:text-cyan-400 shadow-lg shadow-cyan-500/10">
                                <RefreshCw className="h-5 w-5 animate-spin text-cyan-500 dark:text-cyan-400" />
                              </div>
                              <div className="space-y-1 text-center">
                                <p className="text-xs font-bold text-slate-900 dark:text-white">Regenerating Question with AI</p>
                                <p className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400/80 animate-pulse">Applying pedagogical constraints & variations...</p>
                              </div>
                            </div>
                          )}

                          {/* ── Editing Panel Header: Question number + AI badge + Regenerate button ── */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                Question {selectedQuestionIndex + 1} of {quiz.questions.length}
                              </span>
                              {quiz.questions[selectedQuestionIndex].generated_by_ai && (
                                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-[10px] font-bold">
                                  <Sparkles className="h-2.5 w-2.5" />
                                  AI Generated
                                </span>
                              )}
                              {quiz.questions[selectedQuestionIndex].is_user_modified && (
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                                  Edited
                                </span>
                              )}
                              {recentlyRegeneratedIndex === selectedQuestionIndex && (
                                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold animate-pulse">
                                  <Check className="h-2.5 w-2.5" />
                                  Replaced
                                </span>
                              )}
                            </div>

                            {/* Regenerate Question button — only for AI-generated questions */}
                            {quiz.questions[selectedQuestionIndex].generated_by_ai && (
                              <button
                                type="button"
                                id={`regenerate-btn-${selectedQuestionIndex}`}
                                disabled={regeneratingIndex !== null}
                                onClick={() => handleRegenerateQuestion(selectedQuestionIndex)}
                                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-sm w-full sm:w-auto ${
                                  regeneratingIndex === selectedQuestionIndex
                                    ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-700 dark:text-cyan-300 cursor-wait"
                                    : regeneratingIndex !== null
                                    ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed opacity-50"
                                    : "bg-cyan-500/10 border-cyan-500/25 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/40 hover:text-cyan-500 dark:hover:text-cyan-300"
                                }`}
                                title={regeneratingIndex !== null ? "Regenerating another question…" : "Regenerate this question using AI"}
                              >
                                {regeneratingIndex === selectedQuestionIndex ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span>Regenerating…</span>
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    <span>Regenerate Question</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                          
                          {/* Duplicate Warning banner if exists */}
                          {duplicateWarnings[selectedQuestionIndex] && (
                            <div className="p-3 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                              <div className="space-y-1">
                                <h5 className="text-xs font-bold text-amber-500 dark:text-amber-400 flex items-center gap-1.5">
                                  <AlertCircle className="h-4 w-4 shrink-0" />
                                  <span>Overlap Warning ({Math.floor(duplicateWarnings[selectedQuestionIndex].similarity * 100)}%)</span>
                                </h5>
                                <p className="text-[10px] text-slate-600 dark:text-slate-400 max-w-xl leading-normal">
                                  This question overlaps with: &quot;{duplicateWarnings[selectedQuestionIndex].existing_text.substring(0, 100)}...&quot;
                                </p>
                              </div>
                              <div className="flex gap-2 w-full sm:w-auto">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = { ...duplicateWarnings };
                                    delete updated[selectedQuestionIndex];
                                    setDuplicateWarnings(updated);
                                    toast.info("Warning dismissed.");
                                  }}
                                  className="flex-1 sm:flex-initial px-2.5 py-1 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500/35 text-[10px] font-semibold cursor-pointer border-none"
                                >
                                  Keep
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRegenerateQuestion(selectedQuestionIndex)}
                                  className="flex-1 sm:flex-initial px-2.5 py-1 rounded bg-cyan-600 text-white hover:bg-cyan-500 text-[10px] font-semibold cursor-pointer border-none flex items-center justify-center gap-1"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  <span>Regenerate</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Restore AI Version Banner */}
                          {quiz.questions[selectedQuestionIndex].is_user_modified && 
                           quiz.questions[selectedQuestionIndex].ai_original_json && (
                            <div className="p-3 sm:p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                              <div className="space-y-1">
                                <h5 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                                  <Sparkles className="h-4 w-4 shrink-0" />
                                  <span>Teacher Modified Question</span>
                                </h5>
                                <p className="text-[10px] text-slate-600 dark:text-slate-400 max-w-xl leading-normal">
                                  This question was edited. You can restore the original AI version to undo modifications.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRestoreOriginalAI(selectedQuestionIndex)}
                                className="w-full sm:w-auto px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold cursor-pointer border-none flex items-center justify-center gap-1.5 transition-colors"
                              >
                                <RotateCcw className="h-3 w-3" />
                                <span>Restore Original AI</span>
                              </button>
                            </div>
                          )}

                          {/* Header: Type, Difficulty, Marks */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Question Type</label>
                              <select
                                value={quiz.questions[selectedQuestionIndex].question_type}
                                onChange={(e) => updateQuestionField("question_type", e.target.value)}
                                className="w-full bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 h-10 text-slate-900 dark:text-white font-semibold text-xs focus:border-indigo-500/50 outline-none transition-colors"
                              >
                                <option value="multiple_choice">Multiple Choice</option>
                                <option value="multiple_select">Multiple Select</option>
                                <option value="true_false">True / False</option>
                                <option value="short_answer">Short Answer</option>
                                <option value="fill_in_the_blank">Fill in the Blank</option>
                              </select>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Difficulty</label>
                              <select
                                value={quiz.questions[selectedQuestionIndex].difficulty}
                                onChange={(e) => updateQuestionField("difficulty", e.target.value)}
                                className="w-full bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 h-10 text-slate-900 dark:text-white font-semibold text-xs focus:border-indigo-500/50 outline-none transition-colors"
                              >
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                              </select>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Points / Marks</label>
                              <Input
                                type="number"
                                min={1}
                                max={100}
                                value={quiz.questions[selectedQuestionIndex].marks}
                                onChange={(e) => updateQuestionField("marks", parseInt(e.target.value) || 1)}
                                className="bg-slate-100/70 dark:bg-[#121c33]/75 border-slate-200 dark:border-slate-700/60 text-slate-900 dark:text-white font-semibold text-xs h-10 rounded-xl"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Negative Marks</label>
                              <Input
                                type="number"
                                step="0.25"
                                min={0}
                                max={10}
                                value={quiz.questions[selectedQuestionIndex].negative_marks || 0}
                                onChange={(e) => updateQuestionField("negative_marks", parseFloat(e.target.value) || 0)}
                                className="bg-slate-100/70 dark:bg-[#121c33]/75 border-slate-200 dark:border-slate-700/60 text-slate-900 dark:text-white font-semibold text-xs h-10 rounded-xl"
                              />
                            </div>
                          </div>

                          {/* QUESTION CONTENT & TIMING */}
                          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                            <div className="lg:col-span-3 space-y-1.5">
                              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Question Text</label>
                              <textarea
                                value={quiz.questions[selectedQuestionIndex].text}
                                onChange={(e) => updateQuestionField("text", e.target.value)}
                                placeholder="Enter your question statement or scenario..."
                                rows={3}
                                className="w-full bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3 text-slate-900 dark:text-white font-medium text-sm focus:border-indigo-500/50 outline-none transition-colors"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Question Timer</label>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                                  <Input
                                    type="number"
                                    min={5}
                                    max={600}
                                    value={quiz.questions[selectedQuestionIndex].time_limit_seconds || 60}
                                    onChange={(e) => updateQuestionField("time_limit_seconds", parseInt(e.target.value) || 60)}
                                    className="bg-slate-100/70 dark:bg-[#121c33]/75 border-slate-200 dark:border-slate-700/60 text-slate-900 dark:text-white font-semibold text-xs h-10 rounded-xl"
                                  />
                                </div>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 block pl-1">
                                  Seconds per question
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* OPTIONS BUILDER */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                {quiz.questions[selectedQuestionIndex].question_type === "true_false"
                                  ? "Correct Answer Selection"
                                  : quiz.questions[selectedQuestionIndex].question_type === "fill_in_the_blank" ||
                                    quiz.questions[selectedQuestionIndex].question_type === "short_answer"
                                  ? "Accepted Answer Keys"
                                  : "Answer Choices & Options"}
                              </label>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                {quiz.questions[selectedQuestionIndex].question_type === "multiple_select"
                                  ? "Check all that apply"
                                  : quiz.questions[selectedQuestionIndex].question_type === "true_false"
                                  ? "Select True or False"
                                  : "Select radio to mark correct answer"}
                              </span>
                            </div>

                            {/* True / False Layout */}
                            {quiz.questions[selectedQuestionIndex].question_type === "true_false" ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {quiz.questions[selectedQuestionIndex].options.map((opt, optIdx) => {
                                  return (
                                    <div
                                      key={opt.id}
                                      onClick={() => {
                                        const updatedOptions = quiz.questions[selectedQuestionIndex].options.map((o, idx) => ({
                                          ...o,
                                          is_correct: idx === optIdx
                                        }));
                                        updateQuestionField("options", updatedOptions);
                                      }}
                                      className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                                        opt.is_correct
                                          ? "bg-emerald-500/10 dark:bg-emerald-950/30 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-sm"
                                          : "bg-slate-100/70 dark:bg-[#121c33]/70 border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300"
                                      }`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className={`h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                                          opt.is_correct
                                            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                            : "bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
                                        }`}>
                                          {optIdx === 0 ? "T" : "F"}
                                        </div>
                                        <div>
                                          <div className="text-sm font-bold text-slate-900 dark:text-white">{opt.text}</div>
                                          <div className="text-[10px] text-slate-500 dark:text-slate-400">Click to set as correct answer</div>
                                        </div>
                                      </div>
                                      <div className={`h-6 w-6 rounded-full flex items-center justify-center border ${
                                        opt.is_correct
                                          ? "bg-emerald-500 border-emerald-500 text-white"
                                          : "border-slate-300 dark:border-slate-700 bg-slate-200/60 dark:bg-slate-900"
                                      }`}>
                                        {opt.is_correct && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              /* Standard Options List for MCQ / Multiple Select / Fill Blank / Short Answer */
                              <div className="space-y-3">
                                {quiz.questions[selectedQuestionIndex].options.map((opt, optIdx) => {
                                  const optionLetter = String.fromCharCode(65 + (optIdx % 26));
                                  const isMultipleChoice = quiz.questions[selectedQuestionIndex].question_type === "multiple_choice";
                                  const isMultipleSelect = quiz.questions[selectedQuestionIndex].question_type === "multiple_select";
                                  const isTextBased = quiz.questions[selectedQuestionIndex].question_type === "fill_in_the_blank" || 
                                                      quiz.questions[selectedQuestionIndex].question_type === "short_answer";

                                  return (
                                    <div
                                      key={opt.id}
                                      className={`flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-2xl border transition-all duration-200 ${
                                        opt.is_correct && !isTextBased
                                          ? "bg-emerald-500/10 dark:bg-emerald-950/25 border-emerald-500/40 dark:border-emerald-500/30 shadow-sm"
                                          : "bg-slate-100/70 dark:bg-[#121c33]/70 border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600"
                                      }`}
                                    >
                                      {/* Option Letter Indicator */}
                                      {!isTextBased && (
                                        <div className={`h-7 w-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                          opt.is_correct
                                            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                            : "bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
                                        }`}>
                                          {optionLetter}
                                        </div>
                                      )}

                                      {/* Correct option toggle mark */}
                                      {isMultipleChoice && (
                                        <input
                                          type="radio"
                                          name={`q-${quiz.questions[selectedQuestionIndex].id}-correct`}
                                          checked={opt.is_correct}
                                          onChange={() => toggleOptionCorrectness(optIdx)}
                                          className="h-4.5 w-4.5 text-emerald-600 border-slate-300 dark:border-slate-700 focus:ring-emerald-500 cursor-pointer shrink-0"
                                          title="Mark as correct answer"
                                        />
                                      )}
                                      {isMultipleSelect && (
                                        <input
                                          type="checkbox"
                                          checked={opt.is_correct}
                                          onChange={() => toggleOptionCorrectness(optIdx)}
                                          className="h-4.5 w-4.5 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                                          title="Mark as correct answer"
                                        />
                                      )}

                                      {/* Choice Text input */}
                                      <div className="flex-1 min-w-0">
                                        <Input
                                          type="text"
                                          value={opt.text}
                                          onChange={(e) => updateOptionText(optIdx, e.target.value)}
                                          placeholder={
                                            isTextBased
                                              ? `Acceptable answer phrase ${optIdx + 1}...`
                                              : `Choice ${optionLetter} content...`
                                          }
                                          className="bg-transparent border-none text-slate-900 dark:text-white text-xs sm:text-sm font-semibold h-9 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-slate-200/40 dark:focus:bg-white/5 focus:ring-0 w-full"
                                        />
                                      </div>

                                      {/* Delete option */}
                                      <button
                                        type="button"
                                        onClick={() => removeOption(optIdx)}
                                        className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 shrink-0 cursor-pointer transition-colors"
                                        title="Remove option"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  );
                                })}

                                {/* Clean Dashed Add Option Button */}
                                {(quiz.questions[selectedQuestionIndex].question_type === "multiple_choice" || 
                                  quiz.questions[selectedQuestionIndex].question_type === "multiple_select") && (
                                  <button
                                    type="button"
                                    onClick={addOption}
                                    className="w-full py-2.5 rounded-2xl border border-dashed border-indigo-500/30 hover:border-indigo-500/50 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    <span>Add Option Choice</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* EXPLANATION / HINTS */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Correct Answer Explanation</label>
                              <textarea
                                value={quiz.questions[selectedQuestionIndex].explanation}
                                onChange={(e) => updateQuestionField("explanation", e.target.value)}
                                placeholder="Provide feedback details on why answer choice is correct..."
                                rows={2}
                                className="w-full bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl p-2.5 text-slate-900 dark:text-white font-medium text-xs focus:border-indigo-500/50 outline-none transition-colors"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Hints</label>
                              <textarea
                                value={quiz.questions[selectedQuestionIndex].hint}
                                onChange={(e) => updateQuestionField("hint", e.target.value)}
                                placeholder="Add help/hints hints for students..."
                                rows={2}
                                className="w-full bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl p-2.5 text-slate-900 dark:text-white font-medium text-xs focus:border-indigo-500/50 outline-none transition-colors"
                              />
                            </div>
                          </div>

                          {/* Bottom Question Navigation Footer */}
                          <div className="flex items-center justify-between pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
                            <Button
                              type="button"
                              variant="outline"
                              disabled={selectedQuestionIndex === 0}
                              onClick={() => setSelectedQuestionIndex(prev => Math.max(0, prev - 1))}
                              className="h-9 px-3 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
                            >
                              <ArrowLeft className="h-3.5 w-3.5" />
                              <span>Previous Q</span>
                            </Button>
                            
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                              {selectedQuestionIndex + 1} of {quiz.questions.length}
                            </span>

                            {selectedQuestionIndex < quiz.questions.length - 1 ? (
                              <Button
                                type="button"
                                onClick={() => setSelectedQuestionIndex(prev => Math.min(quiz.questions.length - 1, prev + 1))}
                                className="h-9 px-3 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 border-none cursor-pointer"
                              >
                                <span>Next Q</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                onClick={addQuestion}
                                className="h-9 px-3 text-xs font-semibold rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white flex items-center gap-1.5 border-none cursor-pointer shadow-sm"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                <span>Add Q</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50/80 dark:bg-[#0c1427]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-12 text-center text-slate-500">
                          No questions in this quiz. Click &apos;Add Question&apos; to start.
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 3: STUDENT PREVIEW / SIMULATOR */}
              {activeTab === "preview" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="max-w-3xl mx-auto"
                >
                  {!simStarted ? (
                    <div className="bg-slate-50/80 dark:bg-[#0c1427]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-12 text-center space-y-6 shadow-xl">
                      <div className="h-16 w-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto shadow-lg shadow-indigo-500/5">
                        <Play className="h-8 w-8" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Student View Simulator</h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                          Test-drive the assessment flow just like a student. Check how the timers behave, toggle question transitions, and audit submissions.
                        </p>
                      </div>

                      {/* Summary rules */}
                      <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto text-left py-2.5 border-y border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-400">
                        <div>Timer Mode: <strong className="text-slate-900 dark:text-slate-200 uppercase">{quiz.timer_mode}</strong></div>
                        <div>Total Marks: <strong className="text-slate-900 dark:text-slate-200">{quiz.total_marks} pts</strong></div>
                        <div>Questions: <strong className="text-slate-900 dark:text-slate-200">{quiz.questions.length} Items</strong></div>
                        <div>Attempts: <strong className="text-slate-900 dark:text-slate-200">{quiz.max_attempts} Allowed</strong></div>
                      </div>

                      <Button
                        onClick={startSimulation}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl px-6 h-11 flex items-center gap-2 mx-auto cursor-pointer border-none shadow-lg shadow-indigo-500/20 transition-colors"
                      >
                        <span>Start Test Simulation</span>
                        <ArrowRight className="h-4.5 w-4.5" />
                      </Button>
                    </div>
                  ) : simFinished ? (
                    /* SIMULATION FINISHED SUMMARY SCREEN */
                    <div className="bg-slate-50/80 dark:bg-[#0c1427]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-12 text-center space-y-6 shadow-xl">
                      <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
                        <Check className="h-8 w-8" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">Quiz Submitted!</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Assessment simulation complete. Here are the grades.</p>
                      </div>

                      <div className="inline-block p-6 rounded-2xl bg-slate-100/70 dark:bg-[#121c33]/70 border border-slate-200 dark:border-slate-700/60 space-y-2">
                        <div className="text-sm text-slate-500 dark:text-slate-400">Graded Marks</div>
                        <div className="text-4xl font-extrabold text-slate-900 dark:text-white">
                          {simScore} <span className="text-lg text-slate-400 dark:text-slate-500">/ {quiz.total_marks}</span>
                        </div>
                        <div className="text-xs font-semibold mt-2">
                          {simScore >= (quiz.total_marks * quiz.pass_percentage / 100) ? (
                            <span className="text-emerald-600 dark:text-emerald-400">PASS ({(simScore / (quiz.total_marks || 1) * 100).toFixed(0)}%)</span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400">FAIL ({(simScore / (quiz.total_marks || 1) * 100).toFixed(0)}%)</span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-3 justify-center">
                        <Button
                          variant="outline"
                          onClick={startSimulation}
                          className="rounded-xl border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold px-4 cursor-pointer h-10 border flex items-center gap-2 transition-colors"
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span>Retake Simulation</span>
                        </Button>
                        <Button
                          onClick={() => setSimStarted(false)}
                          className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 h-10 border-none cursor-pointer transition-colors"
                        >
                          Exit Simulation
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* ACTIVE SIMULATION PLAY SCREEN */
                    <div className="bg-slate-50/80 dark:bg-[#0c1427]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 md:p-8 space-y-6 relative overflow-hidden shadow-xl">
                      
                      {/* Active header with timers */}
                      <div className="flex justify-between items-center pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
                        <div className="space-y-1">
                          <h4 className="text-base font-bold text-slate-900 dark:text-white">{quiz.title}</h4>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            Question {simCurrentIdx + 1} of {quiz.questions.length}
                          </div>
                        </div>

                        {/* Overall timer ticking countdown */}
                        {(quiz.timer_mode === "overall" || quiz.timer_mode === "both") && (
                          <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-xl">
                            <Clock className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                            <div className="text-xs font-bold text-indigo-700 dark:text-indigo-300 font-mono">
                              Overall: {Math.floor(simOverallTimer / 60)}:{(simOverallTimer % 60).toString().padStart(2, "0")}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Question Content Box */}
                      {quiz.questions[simCurrentIdx] && (
                        <div className="space-y-6">
                          
                          {/* Question header metadata */}
                          <div className="flex items-center justify-between">
                            <div className="flex gap-2">
                              <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                                {quiz.questions[simCurrentIdx].difficulty}
                              </span>
                              <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                {quiz.questions[simCurrentIdx].marks} pts
                              </span>
                            </div>

                            {/* Question specific timer ticking countdown */}
                            {(quiz.timer_mode === "per_question" || quiz.timer_mode === "both") && (
                              <div className="text-xs font-bold text-cyan-600 dark:text-cyan-400 font-mono flex items-center gap-1 bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/20">
                                <Clock className="h-3 w-3 shrink-0 animate-pulse" />
                                <span>Time Left: {simQuestionTimer}s</span>
                              </div>
                            )}
                          </div>

                          {/* Question specific visual progress bar */}
                          {(quiz.timer_mode === "per_question" || quiz.timer_mode === "both") && (
                            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1">
                              <div 
                                className="bg-cyan-500 h-1 rounded-full transition-all duration-1000 ease-linear"
                                style={{ width: `${(simQuestionTimer / (quiz.questions[simCurrentIdx].time_limit_seconds || 30)) * 100}%` }}
                              />
                            </div>
                          )}

                          {/* Text */}
                          <div className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight leading-relaxed">
                            <span>{quiz.questions[simCurrentIdx].text || "Blank question text content..."}</span>
                            <button
                              type="button"
                              onClick={() => speakQuestion(quiz.questions[simCurrentIdx].text || "")}
                              className={`inline-flex items-center gap-1.5 align-middle ml-2.5 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer duration-200 ${
                                isSpeaking 
                                  ? "bg-indigo-500/20 border-indigo-500/35 text-indigo-600 dark:text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.15)] scale-105" 
                                  : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
                              }`}
                              title={isSpeaking ? "Stop reading" : "Read question aloud"}
                            >
                              <Volume2 className="h-3.5 w-3.5 shrink-0" />
                              {isSpeaking && (
                                <div className="flex items-end gap-[2px] h-3 px-0.5 select-none shrink-0">
                                  <span className="w-[2px] h-2.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-[sound-wave-bar_0.4s_ease-in-out_infinite_alternate]" style={{ animationDelay: '0.1s' }} />
                                  <span className="w-[2px] h-2.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-[sound-wave-bar_0.4s_ease-in-out_infinite_alternate]" style={{ animationDelay: '0.3s' }} />
                                  <span className="w-[2px] h-2.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-[sound-wave-bar_0.4s_ease-in-out_infinite_alternate]" style={{ animationDelay: '0.2s' }} />
                                </div>
                              )}
                            </button>
                          </div>

                          {/* Option builder inputs depending on type */}
                          <div className="space-y-3 pt-2">
                            {(quiz.questions[simCurrentIdx].question_type === "multiple_choice" || 
                              quiz.questions[simCurrentIdx].question_type === "true_false") && (
                              <div className="grid grid-cols-1 gap-2.5">
                                {quiz.questions[simCurrentIdx].options.map(opt => {
                                  const isSelected = (simAnswers[quiz.questions[simCurrentIdx].id] || []).includes(opt.text);
                                  return (
                                    <button
                                      key={opt.id}
                                      onClick={() => handleSimSelectAnswer(quiz.questions[simCurrentIdx].id, opt.text, false)}
                                      className={`w-full p-4 rounded-xl border text-left font-semibold text-xs transition-all cursor-pointer flex items-center gap-3 ${
                                        isSelected
                                          ? "bg-indigo-500/15 dark:bg-indigo-500/20 border-indigo-500 text-slate-900 dark:text-white shadow-md"
                                          : "bg-slate-100/70 dark:bg-[#121c33]/70 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-[#172442] hover:text-slate-900 dark:hover:text-white"
                                      }`}
                                    >
                                      <div className={`h-4.5 w-4.5 rounded-full border flex items-center justify-center shrink-0 ${
                                        isSelected ? "border-indigo-500" : "border-slate-400 dark:border-slate-600"
                                      }`}>
                                        {isSelected && <div className="h-2 w-2 rounded-full bg-indigo-500" />}
                                      </div>
                                      <span>{opt.text}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {quiz.questions[simCurrentIdx].question_type === "multiple_select" && (
                              <div className="grid grid-cols-1 gap-2.5">
                                {quiz.questions[simCurrentIdx].options.map(opt => {
                                  const isSelected = (simAnswers[quiz.questions[simCurrentIdx].id] || []).includes(opt.text);
                                  return (
                                    <button
                                      key={opt.id}
                                      onClick={() => handleSimSelectAnswer(quiz.questions[simCurrentIdx].id, opt.text, true)}
                                      className={`w-full p-4 rounded-xl border text-left font-semibold text-xs transition-all cursor-pointer flex items-center gap-3 ${
                                        isSelected
                                          ? "bg-indigo-500/15 dark:bg-indigo-500/20 border-indigo-500 text-slate-900 dark:text-white shadow-md"
                                          : "bg-slate-100/70 dark:bg-[#121c33]/70 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-[#172442]"
                                      }`}
                                    >
                                      <div className={`h-4.5 w-4.5 rounded border flex items-center justify-center shrink-0 ${
                                        isSelected ? "border-indigo-500 bg-indigo-500/20" : "border-slate-400 dark:border-slate-600"
                                      }`}>
                                        {isSelected && <Check className="h-3 w-3 text-indigo-500" />}
                                      </div>
                                      <span>{opt.text}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {(quiz.questions[simCurrentIdx].question_type === "fill_in_the_blank" || 
                              quiz.questions[simCurrentIdx].question_type === "short_answer") && (
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Your Answer</label>
                                <Input
                                  type="text"
                                  value={simAnswers[quiz.questions[simCurrentIdx].id]?.[0] || ""}
                                  onChange={(e) => setSimAnswers({ ...simAnswers, [quiz.questions[simCurrentIdx].id]: [e.target.value] })}
                                  placeholder="Type your answer text here..."
                                  className="bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl h-11 text-slate-900 dark:text-white font-medium text-sm focus:border-indigo-500/50"
                                />
                              </div>
                            )}
                          </div>

                          {/* Navigation buttons */}
                          <div className="flex justify-between pt-6 border-t border-slate-200/80 dark:border-slate-800/80">
                            <Button
                              variant="outline"
                              disabled={simCurrentIdx === 0}
                              onClick={() => {
                                setSimCurrentIdx(prev => prev - 1);
                                if (quiz.timer_mode === "per_question" || quiz.timer_mode === "both") {
                                  setSimQuestionTimer(quiz.questions[simCurrentIdx - 1]?.time_limit_seconds || 30);
                                }
                              }}
                              className="rounded-xl border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 px-4 h-10 border flex items-center gap-2 cursor-pointer transition-colors"
                            >
                              <ArrowLeft className="h-4 w-4" />
                              <span>Previous</span>
                            </Button>
                            
                            {simCurrentIdx < quiz.questions.length - 1 ? (
                              <Button
                                onClick={moveToNextQuestionOrSubmit}
                                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 h-10 border-none cursor-pointer flex items-center gap-2 transition-colors"
                              >
                                <span>Next Question</span>
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                onClick={finishSimulation}
                                className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold px-5 h-10 border-none cursor-pointer flex items-center gap-2 shadow-md shadow-emerald-500/20"
                              >
                                <Check className="h-4.5 w-4.5" />
                                <span>Submit Simulation</span>
                              </Button>
                            )}
                          </div>

                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

            </div>
          </motion.div>
        )}

        {/* SUCCESS VIEW */}
        {view === "success" && savedQuiz && (
          <motion.div
            key="success-view"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-slate-50/80 dark:bg-[#0c1427]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-8 md:p-12 text-center max-w-xl mx-auto space-y-8 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute -right-32 -top-32 h-64 w-64 rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />
            <div className="absolute -left-32 -bottom-32 h-64 w-64 rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />

            <div className="space-y-4 relative z-10">
              <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto shadow-lg shadow-emerald-500/5">
                <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400 animate-bounce" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {savedQuiz.status === "published" ? "Assessment Published!" : "Draft Saved!"}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold truncate max-w-md mx-auto">
                  {savedQuiz.title}
                </p>
              </div>
            </div>

            {/* Game PIN Box */}
            <div className="p-6 bg-slate-100/80 dark:bg-[#121c33]/85 border border-slate-200 dark:border-slate-700/60 rounded-2xl space-y-3 relative z-10 max-w-sm mx-auto shadow-inner">
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Access Game PIN</div>
              <div className="text-3xl font-black text-cyan-600 dark:text-cyan-400 font-mono tracking-wider select-all">
                {savedQuiz.quiz_code}
              </div>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(savedQuiz.quiz_code);
                  toast.success("Game PIN copied to clipboard!");
                }}
                className="h-8 px-4 text-[10px] font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/80 dark:hover:bg-slate-700 cursor-pointer transition-colors"
              >
                Copy PIN Code
              </Button>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center relative z-10 max-w-sm mx-auto w-full">
              {savedQuiz.status === "published" && (
                <Button
                  onClick={handleStartLiveSession}
                  disabled={sessionCreating}
                  className="w-full h-11 bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer border-none shadow-lg shadow-indigo-500/20 text-xs transition-all"
                >
                  {sessionCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span>Creating Lobby...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      <span>Start Live Session</span>
                    </>
                  )}
                </Button>
              )}
              <Link href="/dashboard" className="w-full">
                <Button className="w-full h-11 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer text-xs transition-colors">
                  <span>Go to Dashboard</span>
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Better Prompt Preview Modal --- */}
      <AnimatePresence>
        {isPreviewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="w-[calc(100vw-2rem)] sm:max-w-2xl bg-slate-50 dark:bg-[#0a1124] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 sm:p-6 overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 pb-4 mb-4 select-none">
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-500 dark:text-purple-400 shrink-0" />
                    <span>Quiz Generation Prompt Preview</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Review and fine-tune your configuration before sending to AI.</p>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 leading-normal">
                
                {/* Prompt Textarea */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Edit Instructions Prompt</label>
                  <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    rows={6}
                    className="w-full bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 text-slate-900 dark:text-white font-medium text-sm focus:border-purple-500/50 outline-none leading-relaxed"
                  />
                </div>

                {/* Config settings recap */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-100/80 dark:bg-[#121c33]/70 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 text-xs select-none">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Difficulty</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{difficulty}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Question Count</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{questionCount} questions</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Quality Mode</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{questionQuality}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Provider</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{aiProvider}</span>
                  </div>
                </div>

                {/* Estimation Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 select-none">
                  <div className="p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/10 flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                      <Activity className="h-4.5 w-4.5 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Estimated Context Tokens</span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">~{((topic.length / 4) + 200).toFixed(0)} Tokens</h4>
                      <p className="text-[9px] text-slate-500">Calculated based on standard character-to-token ratio.</p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-cyan-500/5 border border-cyan-500/10 flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 shrink-0">
                      <Clock className="h-4.5 w-4.5" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">Estimated Generation Time</span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">~{(questionCount * (questionQuality === "premium" ? 1.5 : 0.8) + 3).toFixed(0)} Seconds</h4>
                      <p className="text-[9px] text-slate-500 font-medium">Based on active model speed metrics & constraints.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 border-t border-slate-200/80 dark:border-slate-800/80 pt-4 mt-4 select-none">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPreviewOpen(false)}
                  className="rounded-xl border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold px-4 cursor-pointer h-10 border transition-colors"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setIsPreviewOpen(false);
                    handleGenerateAI();
                  }}
                  className="rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold px-5 h-10 flex items-center gap-2 border-none cursor-pointer shadow-md shadow-indigo-500/20"
                >
                  <Sparkles className="h-4.5 w-4.5 animate-pulse" />
                  <span>Generate Quiz</span>
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- Mismatch Warning Modal --- */}
      <AnimatePresence>
        {mismatchData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="w-[calc(100vw-2rem)] sm:max-w-md bg-slate-50 dark:bg-[#0a1124] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 sm:p-6 overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 pb-4 mb-4 select-none">
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-500 dark:text-amber-400 shrink-0" />
                    <span>Question Count Mismatch</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">We detected a mismatch between your prompt and settings.</p>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 space-y-4 pr-1 leading-normal py-2 text-slate-700 dark:text-slate-300 text-sm">
                <p>
                  Your prompt requests <span className="font-bold text-slate-900 dark:text-white">{mismatchData.parsedCount}</span> questions, but the Question Count setting is set to <span className="font-bold text-slate-900 dark:text-white">{mismatchData.currentCount}</span>.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Which value would you like to use for generation?
                </p>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 border-t border-slate-200/80 dark:border-slate-800/80 pt-4 mt-4 select-none">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMismatchData(null)}
                  className="rounded-xl border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold px-4 cursor-pointer h-10 border text-xs transition-colors"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    const count = mismatchData.currentCount;
                    setMismatchData(null);
                    await executeGenerateAI(count);
                  }}
                  className="rounded-xl border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold px-4 cursor-pointer h-10 border text-xs transition-colors"
                >
                  Keep {mismatchData.currentCount}
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    const count = mismatchData.parsedCount;
                    setQuestionCount(count);
                    setMismatchData(null);
                    await executeGenerateAI(count);
                  }}
                  className="rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold px-5 h-10 flex items-center gap-2 border-none cursor-pointer text-xs shadow-md shadow-indigo-500/20"
                >
                  Use {mismatchData.parsedCount}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CreateQuizPage() {
  return (
    <ProtectedRoute allowedRoles={["teacher", "admin"]}>
      <Suspense fallback={
        <div className="bg-slate-50/80 dark:bg-[#0c1427]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-12 flex flex-col items-center justify-center min-h-[400px] shadow-2xl">
          <div className="text-slate-800 dark:text-white text-sm font-semibold animate-pulse">Loading Quiz Workspace...</div>
        </div>
      }>
        <CreateQuizContent />
      </Suspense>
    </ProtectedRoute>
  );
}
