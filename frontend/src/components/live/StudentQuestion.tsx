import React from "react";
import { HelpCircle, Check, Lock, Volume2, Award, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface QuestionOption {
  id: string;
  text: string;
}

interface QuestionData {
  id: string;
  text: string;
  question_type: string;
  points?: number;
  options: QuestionOption[];
}

interface StudentQuestionProps {
  question: QuestionData;
  randomizedOptionIds: string[];
  selectedAnswer: string[];
  isSubmitted: boolean;
  timerStarted: boolean;
  questionTimeLeft: number | null;
  currentIdx: number;
  totalQs: number;
  answeredCount: number;
  totalPlayers: number;
  isSpeaking: boolean;
  onSelectAnswer: (optionId: string, isMulti: boolean) => void;
  onTextInput: (text: string) => void;
  onSubmit: () => void;
  onSpeak: () => void;
}

export default function StudentQuestion({
  question,
  randomizedOptionIds,
  selectedAnswer,
  isSubmitted,
  timerStarted,
  questionTimeLeft,
  currentIdx,
  totalQs,
  answeredCount,
  totalPlayers,
  isSpeaking,
  onSelectAnswer,
  onTextInput,
  onSubmit,
  onSpeak
}: StudentQuestionProps) {
  if (!question) return null;

  const isLocked = !timerStarted;
  const isLockScreen = isLocked || isSubmitted;

  return (
    <div className="bg-slate-50/80 dark:bg-[#0c1427]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl relative w-full max-w-2xl mx-auto animate-fade-in">
      <div className="flex justify-between items-center border-b border-slate-200/80 dark:border-slate-800/80 pb-3">
        <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
          Question {currentIdx + 1} of {totalQs}
        </span>
        
        {/* Timer display */}
        {questionTimeLeft !== null && (
          <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/25 px-3 py-1 rounded-xl flex items-center gap-1.5 animate-pulse">
            <Clock className="h-3.5 w-3.5" />
            <span>{questionTimeLeft}s Left</span>
          </span>
        )}
      </div>

      <div className="space-y-6">
        <div className="flex justify-between items-start gap-4">
          <div className="flex items-start gap-3">
            <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white leading-relaxed">{question.text}</h3>
            <button
              type="button"
              onClick={onSpeak}
              className={`inline-flex items-center gap-1.5 align-middle mt-1 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer duration-200 shrink-0 ${
                isSpeaking 
                  ? "bg-indigo-500/20 border-indigo-500/35 text-indigo-600 dark:text-indigo-400 shadow-md scale-105" 
                  : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
              }`}
              title={isSpeaking ? "Stop reading" : "Read question aloud"}
            >
              <Volume2 className="h-3.5 w-3.5 shrink-0" />
              {isSpeaking && (
                <div className="flex items-end gap-[2px] h-3 px-0.5 select-none shrink-0">
                  <span className="w-[1.5px] h-2.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-pulse" />
                  <span className="w-[1.5px] h-2 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }} />
                  <span className="w-[1.5px] h-1.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }} />
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Locked / Submitted States overlays */}
        {isLocked ? (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-100/50 dark:bg-slate-900/30">
            <div className="h-14 w-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 animate-pulse">
              <Lock className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Question Locked</h3>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] max-w-xs font-semibold leading-relaxed">
                Waiting for the teacher to release the question and start the timer...
              </p>
            </div>
          </div>
        ) : isSubmitted ? (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-100/50 dark:bg-slate-900/30">
            <div className="h-14 w-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 animate-bounce">
              <Check className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Answer Submitted</h3>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
                Waiting for the teacher to advance to the next question...
              </p>
              <div className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full inline-block mt-3 animate-pulse">
                {answeredCount} / {totalPlayers} Students Answered
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Options layout */}
            {(question.question_type === "multiple_choice" || question.question_type === "true_false") && (
              <div className="grid grid-cols-1 gap-3">
                {randomizedOptionIds?.map((optId: string) => {
                  const option = question.options.find((o: any) => o.id === optId);
                  if (!option) return null;
                  const isSelected = selectedAnswer.includes(optId);
                  
                  return (
                    <button
                      key={optId}
                      onClick={() => onSelectAnswer(optId, false)}
                      className={`w-full p-4 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer flex items-center gap-3 ${
                        isSelected
                          ? "bg-indigo-500/15 dark:bg-indigo-500/20 border-indigo-500/50 text-slate-900 dark:text-white shadow-sm ring-1 ring-indigo-500/30"
                          : "bg-slate-100/70 dark:bg-[#121c33]/70 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-[#182645] hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      <div className={`h-4.5 w-4.5 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? "border-indigo-500 bg-indigo-500/20" : "border-slate-400 dark:border-slate-600"
                      }`}>
                        {isSelected && <div className="h-2 w-2 rounded-full bg-indigo-500" />}
                      </div>
                      <span>{option.text}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {question.question_type === "multiple_select" && (
              <div className="grid grid-cols-1 gap-3">
                {randomizedOptionIds?.map((optId: string) => {
                  const option = question.options.find((o: any) => o.id === optId);
                  if (!option) return null;
                  const isSelected = selectedAnswer.includes(optId);
                  
                  return (
                    <button
                      key={optId}
                      onClick={() => onSelectAnswer(optId, true)}
                      className={`w-full p-4 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer flex items-center gap-3 ${
                        isSelected
                          ? "bg-indigo-500/15 dark:bg-indigo-500/20 border-indigo-500/50 text-slate-900 dark:text-white shadow-sm ring-1 ring-indigo-500/30"
                          : "bg-slate-100/70 dark:bg-[#121c33]/70 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-[#182645] hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      <div className={`h-4.5 w-4.5 rounded border flex items-center justify-center shrink-0 ${
                        isSelected ? "border-indigo-500 bg-indigo-500/20" : "border-slate-400 dark:border-slate-600"
                      }`}>
                        {isSelected && <Check className="h-3 w-3 text-indigo-500" />}
                      </div>
                      <span>{option.text}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {(question.question_type === "fill_in_the_blank" || question.question_type === "short_answer") && (
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Type Your Answer</label>
                <Input
                  type="text"
                  value={selectedAnswer[0] || ""}
                  onChange={(e) => onTextInput(e.target.value)}
                  placeholder="Type response text here..."
                  className="bg-slate-100/70 dark:bg-[#121c33]/75 border border-slate-200 dark:border-slate-700/60 rounded-xl h-11 text-slate-900 dark:text-white font-medium text-sm focus:border-indigo-500/50"
                />
              </div>
            )}

            {/* Submit Button */}
            <Button
              onClick={onSubmit}
              disabled={selectedAnswer.length === 0 || selectedAnswer[0] === ""}
              className="w-full h-11 bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-500/20 border-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="h-4.5 w-4.5" />
              <span>Submit Answer</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
export const MemoizedStudentQuestion = React.memo(StudentQuestion);
