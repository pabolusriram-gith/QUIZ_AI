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
    <div className="glass-panel border-white/5 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative w-full max-w-2xl mx-auto animate-fade-in">
      <div className="flex justify-between items-center border-b border-white/5 pb-3">
        <span className="text-[10px] font-extrabold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
          Question {currentIdx + 1} of {totalQs}
        </span>
        
        {/* Timer display */}
        {questionTimeLeft !== null && (
          <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-xl flex items-center gap-1.5 animate-pulse">
            <Clock className="h-3.5 w-3.5" />
            <span>{questionTimeLeft}s Left</span>
          </span>
        )}
      </div>

      <div className="space-y-6">
        <div className="flex justify-between items-start gap-4">
          <div className="flex items-start gap-3">
            <h3 className="text-base md:text-lg font-bold text-white leading-relaxed">{question.text}</h3>
            <button
              type="button"
              onClick={onSpeak}
              className={`inline-flex items-center gap-1.5 align-middle mt-1 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer duration-200 shrink-0 ${
                isSpeaking 
                  ? "bg-indigo-500/20 border-indigo-500/35 text-indigo-400 shadow-md scale-105" 
                  : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white"
              }`}
              title={isSpeaking ? "Stop reading" : "Read question aloud"}
            >
              <Volume2 className="h-3.5 w-3.5 shrink-0" />
              {isSpeaking && (
                <div className="flex items-end gap-[2px] h-3 px-0.5 select-none shrink-0">
                  <span className="w-[1.5px] h-2.5 bg-indigo-400 rounded-full animate-pulse" />
                  <span className="w-[1.5px] h-2 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }} />
                  <span className="w-[1.5px] h-1.5 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }} />
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Locked / Submitted States overlays */}
        {isLocked ? (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 border border-dashed border-white/5 rounded-2xl bg-white/1">
            <div className="h-14 w-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 animate-pulse">
              <Lock className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Question Locked</h3>
              <p className="text-slate-450 text-[11px] max-w-xs font-semibold leading-relaxed">
                Waiting for the teacher to release the question and start the timer...
              </p>
            </div>
          </div>
        ) : isSubmitted ? (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 border border-dashed border-white/5 rounded-2xl bg-white/1">
            <div className="h-14 w-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 animate-bounce">
              <Check className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Answer Submitted</h3>
              <p className="text-slate-450 text-[11px] font-semibold">
                Waiting for the teacher to advance to the next question...
              </p>
              <div className="text-[9px] text-indigo-400 font-bold bg-indigo-500/5 border border-indigo-500/15 px-3 py-1 rounded-full inline-block mt-3 animate-pulse">
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
                          ? "bg-indigo-500/10 border-indigo-500 text-white shadow-md"
                          : "bg-white/3 border-white/5 text-slate-350 hover:bg-white/6 hover:text-white"
                      }`}
                    >
                      <div className={`h-4.5 w-4.5 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? "border-indigo-400 bg-indigo-500/20" : "border-slate-500"
                      }`}>
                        {isSelected && <div className="h-2 w-2 rounded-full bg-indigo-400" />}
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
                          ? "bg-indigo-500/10 border-indigo-500 text-white shadow-md"
                          : "bg-white/3 border-white/5 text-slate-350 hover:bg-white/6 hover:text-white"
                      }`}
                    >
                      <div className={`h-4.5 w-4.5 rounded border flex items-center justify-center shrink-0 ${
                        isSelected ? "border-indigo-400 bg-indigo-500/20" : "border-slate-500"
                      }`}>
                        {isSelected && <Check className="h-3 w-3 text-indigo-400" />}
                      </div>
                      <span>{option.text}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {(question.question_type === "fill_in_the_blank" || question.question_type === "short_answer") && (
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-extrabold text-slate-550 uppercase tracking-wider block">Type Your Answer</label>
                <Input
                  type="text"
                  value={selectedAnswer[0] || ""}
                  onChange={(e) => onTextInput(e.target.value)}
                  placeholder="Type response text here..."
                  className="bg-white/3 border-white/10 rounded-xl h-11 text-white font-medium text-sm focus:border-indigo-500/50"
                />
              </div>
            )}

            {/* Submit Button */}
            <Button
              onClick={onSubmit}
              disabled={selectedAnswer.length === 0 || selectedAnswer[0] === ""}
              className="w-full h-11 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-550 hover:to-cyan-550 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg border-none shadow-indigo-500/15"
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
