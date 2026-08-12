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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";

interface QuestionOption { id: string; text: string; is_correct: boolean; display_order: number; }
interface Question {
  id: string; quiz_id: string; quiz_title: string; quiz_subject: string;
  text: string; difficulty: "easy"|"medium"|"hard"; topic: string; marks: number;
  explanation: string|null; question_type: string; bloom_level: string|null;
  subtopic: string|null; estimated_time: number|null; negative_marks: number;
  hint: string|null; ai_generated: boolean; generated_by_ai: boolean;
  order_index: number; created_at: string|null; updated_at: string|null;
  options: QuestionOption[];
}
interface PaginatedResponse { total: number; skip: number; limit: number; items: Question[]; }

const DIFFICULTY_OPTIONS = ["easy","medium","hard"] as const;
const TYPE_OPTIONS = [
  {value:"multiple_choice",label:"Multiple Choice"},
  {value:"multiple_select",label:"Multiple Select"},
  {value:"true_false",label:"True / False"},
  {value:"fill_in_the_blank",label:"Fill in the Blank"},
  {value:"short_answer",label:"Short Answer"},
];
const PAGE_SIZE = 10;
const difficultyConfig: Record<string,{label:string;cls:string}> = {
  easy:{label:"Easy",cls:"bg-emerald-500/10 text-emerald-400 border-emerald-500/20"},
  medium:{label:"Medium",cls:"bg-amber-500/10 text-amber-400 border-amber-500/20"},
  hard:{label:"Hard",cls:"bg-rose-500/10 text-rose-400 border-rose-500/20"},
};
const typeLabel = (t: string) => TYPE_OPTIONS.find(o=>o.value===t)?.label??t;

// ---- Edit Modal ----
interface EditModalProps { question: Question; onClose: () => void; onSaved: (u: Question) => void; }
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
    question.options.length > 0 ? [...question.options]
      : [{id:"new-0",text:"",is_correct:false,display_order:0},{id:"new-1",text:"",is_correct:false,display_order:1}]
  );
  const [saving, setSaving] = useState(false);
  const needsOptions = ["multiple_choice","multiple_select","true_false"].includes(questionType);

  const addOption = () => setOptions(p => [...p,{id:`new-${Date.now()}`,text:"",is_correct:false,display_order:p.length}]);
  const removeOption = (idx:number) => setOptions(p=>p.filter((_,i)=>i!==idx));
  const updateOption = (idx:number, field:keyof QuestionOption, value:string|boolean) =>
    setOptions(p=>p.map((o,i)=>i===idx?{...o,[field]:value}:o));
  const toggleCorrect = (idx:number) => {
    if (questionType==="multiple_choice") setOptions(p=>p.map((o,i)=>({...o,is_correct:i===idx})));
    else setOptions(p=>p.map((o,i)=>i===idx?{...o,is_correct:!o.is_correct}:o));
  };

  const handleSave = async () => {
    if (!text.trim()) return toast.error("Question text is required.");
    if (!topic.trim()) return toast.error("Topic is required.");
    if (marks < 0) return toast.error("Marks must be 0 or more.");
    if (needsOptions) {
      const filled = options.filter(o=>o.text.trim());
      if (filled.length < 2) return toast.error("At least 2 options required.");
      if (!filled.some(o=>o.is_correct)) return toast.error("Mark at least one correct answer.");
    }
    setSaving(true);
    try {
      const payload: Record<string,unknown> = {
        text, difficulty, topic, marks, negative_marks:negativeMarks,
        explanation:explanation||null, hint:hint||null,
        bloom_level:bloomLevel||null, question_type:questionType,
      };
      if (needsOptions) {
        payload.options = options.filter(o=>o.text.trim()).map((o,i)=>({
          id: o.id.startsWith("new-")?undefined:o.id,
          text:o.text, is_correct:o.is_correct, display_order:i,
        }));
      }
      const res = await api.patch(`/quizzes/${question.quiz_id}/questions/${question.id}`, payload);
      toast.success("Question updated!");
      onSaved({...question,...res.data,quiz_title:question.quiz_title,quiz_subject:question.quiz_subject});
    } catch (err:unknown) {
      toast.error((err as {response?:{data?:{detail?:string}}})?.response?.data?.detail ?? "Failed to update.");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{opacity:0,scale:0.95,y:10}} animate={{opacity:1,scale:1,y:0}}
        exit={{opacity:0,scale:0.95,y:10}} transition={{duration:0.2}}
        className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/8 bg-[#060d1c] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#060d1c] border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Edit2 className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-display">Edit Question</h3>
              <p className="text-[10px] text-slate-500 font-medium">{question.quiz_title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Question Text <span className="text-rose-400">*</span></label>
            <textarea value={text} onChange={e=>setText(e.target.value)} rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-white/4 border border-white/8 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition resize-none"
              placeholder="Enter the question text..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Type</label>
              <select value={questionType} onChange={e=>setQuestionType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/4 border border-white/8 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition cursor-pointer">
                {TYPE_OPTIONS.map(t=><option key={t.value} value={t.value} className="bg-[#060d1c]">{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Difficulty</label>
              <select value={difficulty} onChange={e=>setDifficulty(e.target.value as "easy"|"medium"|"hard")}
                className="w-full px-3 py-2.5 rounded-xl bg-white/4 border border-white/8 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition cursor-pointer">
                {DIFFICULTY_OPTIONS.map(d=><option key={d} value={d} className="bg-[#060d1c] capitalize">{d.charAt(0).toUpperCase()+d.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Topic <span className="text-rose-400">*</span></label>
              <Input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="e.g. Arrays"
                className="bg-white/4 border-white/8 text-white placeholder:text-slate-600 focus:border-indigo-500/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Marks</label>
              <Input type="number" min={0} value={marks} onChange={e=>setMarks(Number(e.target.value))}
                className="bg-white/4 border-white/8 text-white focus:border-indigo-500/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Neg. Marks</label>
              <Input type="number" min={0} step={0.25} value={negativeMarks} onChange={e=>setNegativeMarks(Number(e.target.value))}
                className="bg-white/4 border-white/8 text-white focus:border-indigo-500/50" />
            </div>
          </div>
          {needsOptions && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Options</label>
                {questionType!=="true_false" && (
                  <button type="button" onClick={addOption}
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer transition-colors">
                    <Plus className="h-3.5 w-3.5" />Add Option
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {options.map((opt,idx)=>(
                  <div key={opt.id} className="flex items-center gap-2">
                    <button type="button" onClick={()=>toggleCorrect(idx)}
                      className={`h-6 w-6 shrink-0 rounded-full border flex items-center justify-center cursor-pointer transition-all ${opt.is_correct?"bg-emerald-500/20 border-emerald-500/60 text-emerald-400":"bg-white/4 border-white/10 text-slate-600 hover:border-emerald-500/30"}`}>
                      <Check className="h-3 w-3" />
                    </button>
                    <Input value={opt.text} onChange={e=>updateOption(idx,"text",e.target.value)}
                      placeholder={`Option ${idx+1}`}
                      className="flex-1 bg-white/4 border-white/8 text-white placeholder:text-slate-600 focus:border-indigo-500/50 h-9 text-sm" />
                    {questionType!=="true_false" && options.length>2 && (
                      <button type="button" onClick={()=>removeOption(idx)}
                        className="h-6 w-6 shrink-0 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-500">
                {questionType==="multiple_choice"?"Click the circle to mark the single correct answer.":"Click circles to mark all correct answers."}
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Explanation</label>
              <textarea value={explanation} onChange={e=>setExplanation(e.target.value)} rows={2}
                className="w-full px-3 py-2 rounded-xl bg-white/4 border border-white/8 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition resize-none"
                placeholder="Optional explanation..." />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Hint</label>
              <textarea value={hint} onChange={e=>setHint(e.target.value)} rows={2}
                className="w-full px-3 py-2 rounded-xl bg-white/4 border border-white/8 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition resize-none"
                placeholder="Optional hint..." />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{"Bloom's Taxonomy Level"}</label>
            <select value={bloomLevel} onChange={e=>setBloomLevel(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/4 border border-white/8 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition cursor-pointer">
              <option value="" className="bg-[#060d1c]">Not specified</option>
              {["Remember","Understand","Apply","Analyze","Evaluate","Create"].map(l=>(
                <option key={l} value={l.toLowerCase()} className="bg-[#060d1c]">{l}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 bg-[#060d1c] border-t border-white/8">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/5 border border-white/8 transition-colors cursor-pointer">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-2">
            {saving?<><span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>:<><CheckCircle2 className="h-3.5 w-3.5" />Save Changes</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ---- Delete Modal ----
interface DeleteModalProps { question: Question; onClose: () => void; onDeleted: (id:string) => void; }
function DeleteModal({ question, onClose, onDeleted }: DeleteModalProps) {
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/quizzes/${question.quiz_id}/questions/${question.id}`);
      toast.success("Question deleted.");
      onDeleted(question.id);
    } catch { toast.error("Failed to delete question."); }
    finally { setDeleting(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{opacity:0,scale:0.95,y:8}} animate={{opacity:1,scale:1,y:0}}
        exit={{opacity:0,scale:0.95}} transition={{duration:0.18}}
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/8 bg-[#060d1c] p-6 shadow-2xl">
        <div className="flex items-start gap-4 mb-5">
          <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-rose-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white font-display">Delete Question?</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">This will permanently remove the question and all its options. This cannot be undone.</p>
            <p className="text-xs text-slate-500 mt-2 line-clamp-2 italic">&ldquo;{question.text}&rdquo;</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/5 border border-white/8 transition-colors cursor-pointer">Cancel</button>
          <button onClick={handleDelete} disabled={deleting}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-2">
            {deleting?<><span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Deleting...</>:<><Trash2 className="h-3.5 w-3.5" />Delete</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ---- Main Page ----
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
  const [editQuestion, setEditQuestion] = useState<Question|null>(null);
  const [deleteQuestion, setDeleteQuestion] = useState<Question|null>(null);
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const totalPages = Math.max(1, Math.ceil(total/PAGE_SIZE));
  const debounceRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(()=>{
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(()=>{ setDebouncedSearch(search); setPage(1); }, 400);
    return ()=>{ if(debounceRef.current) clearTimeout(debounceRef.current); };
  },[search]);

  useEffect(()=>{ setPage(1); },[filterDifficulty,filterType]);

  const fetchQuestions = useCallback(async()=>{
    setLoading(true);
    try {
      const params: Record<string,string|number> = { skip:(page-1)*PAGE_SIZE, limit:PAGE_SIZE };
      if (debouncedSearch) params.search = debouncedSearch;
      if (filterDifficulty) params.difficulty = filterDifficulty;
      if (filterType) params.question_type = filterType;
      const res = await api.get<PaginatedResponse>("/quizzes/questions",{params});
      setQuestions(res.data.items);
      setTotal(res.data.total);
    } catch (err:unknown) {
      toast.error((err as {response?:{data?:{detail?:string}}})?.response?.data?.detail ?? "Failed to load questions.");
    } finally { setLoading(false); }
  },[page,debouncedSearch,filterDifficulty,filterType]);

  useEffect(()=>{ fetchQuestions(); },[fetchQuestions]);

  const handleSaved = (updated:Question) => { setQuestions(p=>p.map(q=>q.id===updated.id?updated:q)); setEditQuestion(null); };
  const handleDeleted = (id:string) => { setQuestions(p=>p.filter(q=>q.id!==id)); setTotal(t=>t-1); setDeleteQuestion(null); };
  const resetFilters = () => { setSearch(""); setDebouncedSearch(""); setFilterDifficulty(""); setFilterType(""); setPage(1); };
  const hasActiveFilters = !!(search||filterDifficulty||filterType);
  const aiCount = questions.filter(q=>q.ai_generated||q.generated_by_ai).length;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader title="Question Bank" description={`Manage all ${total.toLocaleString()} question${total!==1?"s":""} across your quizzes.`} />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Total Questions" value={total} icon={<Layers className="h-5 w-5 text-indigo-400" />} glowColor="indigo" />
        <StatCard title="Easy Questions" value={questions.filter(q=>q.difficulty==="easy").length} icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />} glowColor="emerald" />
        <StatCard title="Hard Questions" value={questions.filter(q=>q.difficulty==="hard").length} icon={<Info className="h-5 w-5 text-rose-400" />} glowColor="rose" />
        <StatCard title="AI Generated" value={aiCount} icon={<Sparkles className="h-5 w-5 text-cyan-400" />} glowColor="cyan" />
      </div>

      {/* Search & Filters */}
      <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.3,delay:0.05}}
        className="glass-panel rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
            <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search questions by text or topic..."
              className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-white/4 border border-white/8 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition" />
            {search && (
              <button onClick={()=>setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-500 hover:text-white cursor-pointer">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={()=>setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${showFilters||hasActiveFilters?"bg-indigo-500/10 border-indigo-500/30 text-indigo-400":"bg-white/4 border-white/8 text-slate-400 hover:text-white hover:bg-white/8"}`}>
              <Filter className="h-3.5 w-3.5" />Filters
              {hasActiveFilters && (
                <span className="h-4 w-4 rounded-full bg-indigo-500 text-[9px] font-bold text-white flex items-center justify-center">
                  {[filterDifficulty,filterType,debouncedSearch].filter(Boolean).length}
                </span>
              )}
              <ChevronDown className={`h-3 w-3 transition-transform ${showFilters?"rotate-180":""}`} />
            </button>
            {hasActiveFilters && (
              <button onClick={resetFilters} className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-semibold bg-white/4 border border-white/8 text-slate-400 hover:text-white hover:bg-white/8 transition-colors cursor-pointer">
                <RotateCcw className="h-3.5 w-3.5" />Reset
              </button>
            )}
          </div>
        </div>
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} transition={{duration:0.2}} className="overflow-hidden">
              <div className="pt-3 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Difficulty</label>
                  <div className="flex gap-2 flex-wrap">
                    {["", ...DIFFICULTY_OPTIONS].map(d=>(
                      <button key={d} onClick={()=>setFilterDifficulty(d)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          filterDifficulty===d
                            ? d===""?"bg-indigo-500/15 border-indigo-500/40 text-indigo-300"
                              :d==="easy"?"bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                              :d==="medium"?"bg-amber-500/15 border-amber-500/40 text-amber-300"
                              :"bg-rose-500/15 border-rose-500/40 text-rose-300"
                            :"bg-white/4 border-white/8 text-slate-400 hover:text-white hover:bg-white/8"}`}>
                        {d===""?"All":d.charAt(0).toUpperCase()+d.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Question Type</label>
                  <select value={filterType} onChange={e=>setFilterType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/4 border border-white/8 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition cursor-pointer">
                    <option value="" className="bg-[#060d1c]">All Types</option>
                    {TYPE_OPTIONS.map(t=><option key={t.value} value={t.value} className="bg-[#060d1c]">{t.label}</option>)}
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Table */}
      <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:0.35,delay:0.1}}
        className="glass-panel rounded-2xl overflow-hidden">
        <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_150px_120px_110px_90px_80px] gap-4 px-5 py-3 border-b border-white/5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          <span>Question</span><span>Quiz</span><span>Topic</span><span>Type</span><span>Difficulty</span><span className="text-right">Actions</span>
        </div>
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Loading questions...</p>
          </div>
        ) : questions.length===0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-white/4 flex items-center justify-center">
              <BookOpen className="h-7 w-7 text-slate-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-white">No questions found</p>
              <p className="text-xs text-slate-500 mt-1">{hasActiveFilters?"Try adjusting your search or filters.":"Create a quiz with questions to populate your question bank."}</p>
            </div>
            {hasActiveFilters && (
              <button onClick={resetFilters} className="px-4 py-2 rounded-xl text-xs font-semibold text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/10 transition-colors cursor-pointer">Clear Filters</button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {questions.map((q,idx)=>{
              const isExpanded = expandedId===q.id;
              const diff = difficultyConfig[q.difficulty]??difficultyConfig.medium;
              return (
                <motion.div key={q.id} initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} transition={{duration:0.2,delay:idx*0.02}}>
                  <div className="group sm:grid sm:grid-cols-[minmax(0,1fr)_150px_120px_110px_90px_80px] gap-4 px-5 py-4 hover:bg-white/2 transition-colors cursor-pointer"
                    onClick={()=>setExpandedId(isExpanded?null:q.id)}>
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="h-7 w-7 rounded-lg bg-white/4 border border-white/8 flex items-center justify-center shrink-0 mt-0.5">
                        {(q.ai_generated||q.generated_by_ai)?<Sparkles className="h-3.5 w-3.5 text-cyan-400"/>:<Tag className="h-3.5 w-3.5 text-slate-500"/>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-slate-100">{q.text}</p>
                        <div className="sm:hidden flex flex-wrap gap-2 mt-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${diff.cls}`}>{diff.label}</span>
                          <span className="text-[10px] text-slate-500">{typeLabel(q.question_type)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center"><span className="text-xs text-slate-400 truncate" title={q.quiz_title}>{q.quiz_title}</span></div>
                    <div className="hidden sm:flex items-center"><span className="text-xs text-slate-400 truncate">{q.topic||"—"}</span></div>
                    <div className="hidden sm:flex items-center"><span className="text-[10px] font-semibold text-slate-500">{typeLabel(q.question_type)}</span></div>
                    <div className="hidden sm:flex items-center"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${diff.cls}`}>{diff.label}</span></div>
                    <div className="hidden sm:flex items-center justify-end gap-1" onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>setEditQuestion(q)} className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer" title="Edit">
                        <Edit2 className="h-3.5 w-3.5"/>
                      </button>
                      <button onClick={()=>setDeleteQuestion(q)} className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer" title="Delete">
                        <Trash2 className="h-3.5 w-3.5"/>
                      </button>
                    </div>
                  </div>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} transition={{duration:0.2}} className="overflow-hidden bg-white/1 border-t border-white/5">
                        <div className="px-5 py-4 space-y-4">
                          {q.options&&q.options.length>0 && (
                            <div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Options</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {q.options.map(opt=>(
                                  <div key={opt.id} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${opt.is_correct?"bg-emerald-500/8 border-emerald-500/20 text-emerald-400":"bg-white/3 border-white/6 text-slate-400"}`}>
                                    <span className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${opt.is_correct?"border-emerald-500/60 bg-emerald-500/20":"border-white/15"}`}>
                                      {opt.is_correct&&<Check className="h-2.5 w-2.5 text-emerald-400"/>}
                                    </span>
                                    {opt.text}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
                            <span><span className="text-slate-400 font-semibold">{q.marks}</span> marks</span>
                            {q.negative_marks>0 && <span><span className="text-rose-400 font-semibold">-{q.negative_marks}</span> negative</span>}
                            {q.bloom_level && <span>Bloom: <span className="text-slate-400 capitalize font-semibold">{q.bloom_level}</span></span>}
                            {q.estimated_time && <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>{q.estimated_time}s</span>}
                            {(q.ai_generated||q.generated_by_ai) && <span className="flex items-center gap-1 text-cyan-500"><Sparkles className="h-3 w-3"/>AI Generated</span>}
                          </div>
                          {q.explanation && (
                            <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Explanation</p>
                              <p className="text-xs text-slate-400 leading-relaxed">{q.explanation}</p>
                            </div>
                          )}
                          {q.hint && (
                            <div className="p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
                              <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-1">Hint</p>
                              <p className="text-xs text-slate-400 leading-relaxed">{q.hint}</p>
                            </div>
                          )}
                          <div className="flex items-center gap-2 sm:hidden pt-1">
                            <button onClick={e=>{e.stopPropagation();setEditQuestion(q);}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/15 transition cursor-pointer">
                              <Edit2 className="h-3.5 w-3.5"/>Edit
                            </button>
                            <button onClick={e=>{e.stopPropagation();setDeleteQuestion(q);}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/15 transition cursor-pointer">
                              <Trash2 className="h-3.5 w-3.5"/>Delete
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
        {!loading && total>0 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-white/5">
            <p className="text-xs text-slate-500 font-medium">
              Showing <span className="text-white font-semibold">{(page-1)*PAGE_SIZE+1}&#8211;{Math.min(page*PAGE_SIZE,total)}</span> of <span className="text-white font-semibold">{total}</span> questions
            </p>
            <div className="flex items-center gap-1.5">
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer border border-white/8">
                <ChevronLeft className="h-4 w-4"/>
              </button>
              {Array.from({length:totalPages},(_,i)=>i+1)
                .filter(p=>{ if(totalPages<=7)return true; if(p===1||p===totalPages)return true; if(Math.abs(p-page)<=1)return true; return false; })
                .reduce<(number|"...")[]>((acc,p,i,arr)=>{
                  if(i>0){const prev=arr[i-1];if(typeof prev==="number"&&p-prev>1)acc.push("...");}
                  acc.push(p); return acc;
                },[])
                .map((item,i)=>item==="..."
                  ?<span key={`e${i}`} className="text-xs text-slate-600 px-1">...</span>
                  :<button key={item} onClick={()=>setPage(item as number)}
                    className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${page===item?"bg-indigo-600 border-indigo-600 text-white":"border-white/8 text-slate-400 hover:text-white hover:bg-white/5"}`}>
                    {item}
                  </button>
                )}
              <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer border border-white/8">
                <ChevronRight className="h-4 w-4"/>
              </button>
            </div>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {editQuestion && <EditModal key="edit" question={editQuestion} onClose={()=>setEditQuestion(null)} onSaved={handleSaved}/>}
        {deleteQuestion && <DeleteModal key="del" question={deleteQuestion} onClose={()=>setDeleteQuestion(null)} onDeleted={handleDeleted}/>}
      </AnimatePresence>
    </div>
  );
}
