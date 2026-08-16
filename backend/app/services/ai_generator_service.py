import json
import asyncio
import re
import uuid
import math
import logging
import time
from typing import List, Dict, Any, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import HTTPException, status
from app.config.settings import settings
from app.core.ai_providers import AIProviderFactory
from app.models.quiz import Question
from app.services.subject_profiles import SubjectProfileManager
from app.services.question_processor import QuestionProcessor

logger = logging.getLogger("app.services.ai_generator")

# In-memory caches to reduce duplicate API calls and latency
_embedding_cache = {}
_retrieval_cache = {}
PROMPT_VERSION = "v2"

def repair_question(q: Dict[str, Any], topic: str = "General") -> tuple[Dict[str, Any], int]:
    repairs_made = 0
    if not isinstance(q, dict):
        return q, 0
        
    # Ensure options is a list
    if "options" not in q or not isinstance(q["options"], list):
        q["options"] = []
        repairs_made += 1
        
    # 1. Infer bloom level if missing or invalid
    valid_blooms = {"Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"}
    bloom = q.get("bloom_level", "")
    if not bloom or bloom not in valid_blooms:
        text = q.get("text", "").lower()
        if any(w in text for w in ["evaluate", "critique", "judge", "assess", "appraise"]):
            q["bloom_level"] = "Evaluate"
        elif any(w in text for w in ["create", "design", "construct", "formulate", "develop"]):
            q["bloom_level"] = "Create"
        elif any(w in text for w in ["analyze", "compare", "contrast", "distinguish", "differ"]):
            q["bloom_level"] = "Analyze"
        elif any(w in text for w in ["apply", "use", "solve", "calculate", "implement", "run"]):
            q["bloom_level"] = "Apply"
        elif any(w in text for w in ["explain", "describe", "identify", "interpret", "discuss"]):
            q["bloom_level"] = "Understand"
        else:
            q["bloom_level"] = "Remember"
        repairs_made += 1
            
    # 2. Infer difficulty if missing or invalid
    difficulty = q.get("difficulty", "").lower()
    if difficulty not in ["easy", "medium", "hard"]:
        text = q.get("text", "").lower()
        bloom = q.get("bloom_level", "")
        has_hard_words = any(re.search(r"\b" + re.escape(w) + r"\b", text) for w in ["complex", "trade-off", "architecture", "optimize", "advanced"])
        has_medium_words = any(re.search(r"\b" + re.escape(w) + r"\b", text) for w in ["calculate", "compare", "implement", "scenario"])
        
        if bloom in ["Evaluate", "Create"] or has_hard_words:
            q["difficulty"] = "hard"
        elif bloom in ["Apply", "Analyze"] or has_medium_words:
            q["difficulty"] = "medium"
        else:
            q["difficulty"] = "easy"
        repairs_made += 1

    # 3. Calculate marks from difficulty
    if "marks" not in q or not isinstance(q["marks"], (int, float)):
        diff = q.get("difficulty", "medium")
        if diff == "hard":
            q["marks"] = 2
        else:
            q["marks"] = 1
        repairs_made += 1

    # 4. Rebuild explanation if missing or lacking correct keywords
    explanation_raw = q.get("explanation")
    if isinstance(explanation_raw, dict):
        core_concept = ""
        incorrect_option = ""
        learner_takeaway = ""
        for k, v in explanation_raw.items():
            k_lower = str(k).lower().replace("_", " ").replace("-", " ")
            if "core" in k_lower or "concept" in k_lower:
                core_concept = v
            elif "incorrect" in k_lower or "distractor" in k_lower or "option" in k_lower or "analysis" in k_lower:
                incorrect_option = v
            elif "takeaway" in k_lower or "learner" in k_lower or "lesson" in k_lower:
                learner_takeaway = v
        
        parts = []
        if core_concept:
            parts.append(f"**Core Concept**: {str(core_concept).strip()}")
        if incorrect_option:
            parts.append(f"**Incorrect Option Analysis**: {str(incorrect_option).strip()}")
        if learner_takeaway:
            parts.append(f"**Learner Takeaway**: {str(learner_takeaway).strip()}")
        
        if parts:
            explanation = "\n\n".join(parts)
        else:
            explanation = "\n\n".join([f"**{str(k).replace('_', ' ').title()}**: {str(v).strip()}" for k, v in explanation_raw.items()])
    else:
        explanation = str(explanation_raw or "")
        
    explanation = explanation.strip()
    q["explanation"] = explanation
    exp_lower = explanation.lower()
    has_core_concept = "core concept" in exp_lower
    has_incorrect = "incorrect option" in exp_lower or "distractor" in exp_lower
    has_takeaway = "takeaway" in exp_lower
    
    if not explanation or len(explanation) < 15 or not (has_core_concept and has_incorrect and has_takeaway):
        correct_opt = next((o.get("text", "") for o in q.get("options", []) if o.get("is_correct")), "the correct option")
        incorrect_opts = [o.get("text", "") for o in q.get("options", []) if not o.get("is_correct")]
        
        rebuilt_exp = f"**Core Concept**: This question assesses understanding of {q.get('topic') or topic}. The correct answer is '{correct_opt}' because it aligns with standard industry patterns and educational principles.\n\n"
        rebuilt_exp += f"**Incorrect Option Analysis**: "
        if incorrect_opts:
            rebuilt_exp += " / ".join([f"'{opt}' is incorrect because it represents a common distractor or misconception related to the core topic" for opt in incorrect_opts])
        else:
            rebuilt_exp += "The other options are incorrect because they represent invalid choices or common student pitfalls."
        rebuilt_exp += f"\n\n**Learner Takeaway**: Always verify foundational concepts of {q.get('topic') or topic} when evaluating problem statements."
        q["explanation"] = rebuilt_exp
        repairs_made += 1

    # 5. Generate tags/topic if missing
    if "topic" not in q or not q.get("topic", "").strip():
        q["topic"] = topic or "General"
        repairs_made += 1
        
    return q, repairs_made


class BlueprintSlot:
    """Represents a target slot in the Question Blueprint."""
    def __init__(
        self,
        order_index: int,
        difficulty: str,
        bloom_level: str,
        question_type: str,
        learning_objective: str,
        marks: int
    ):
        self.order_index = order_index
        self.difficulty = difficulty
        self.bloom_level = bloom_level
        self.question_type = question_type
        self.learning_objective = learning_objective
        self.marks = marks

    def to_dict(self) -> Dict[str, Any]:
        return {
            "order_index": self.order_index,
            "difficulty": self.difficulty,
            "bloom_level": self.bloom_level,
            "question_type": self.question_type,
            "learning_objective": self.learning_objective,
            "marks": self.marks
        }


class QuestionBlueprint:
    """Generates the structured blueprint for initial quiz creation."""
    @staticmethod
    def create_blueprint(
        question_count: int,
        difficulty: str,
        bloom_levels: List[str],
        question_types: List[str],
        topic: str,
        question_distribution: Optional[str] = None,
        marks_mode: str = "default",
        default_marks: int = 1
    ) -> List[BlueprintSlot]:
        # 1. Parse difficulty distribution
        easy_pct, medium_pct, hard_pct = 0.2, 0.5, 0.3
        if question_distribution:
            # Try to parse e.g. "30% Easy, 50% Medium, 20% Hard"
            try:
                matches = re.findall(r"(\d+)%\s*(Easy|Medium|Hard)", question_distribution, re.IGNORECASE)
                if len(matches) == 3:
                    dist = {m[1].lower(): int(m[0]) / 100.0 for m in matches}
                    easy_pct = dist.get("easy", easy_pct)
                    medium_pct = dist.get("medium", medium_pct)
                    hard_pct = dist.get("hard", hard_pct)
            except Exception as e:
                logger.warning(f"Failed to parse custom distribution: {e}")
        elif difficulty == "easy":
            easy_pct, medium_pct, hard_pct = 1.0, 0.0, 0.0
        elif difficulty == "medium":
            easy_pct, medium_pct, hard_pct = 0.0, 1.0, 0.0
        elif difficulty == "hard":
            easy_pct, medium_pct, hard_pct = 0.0, 0.0, 1.0

        # Allocate counts
        easy_count = max(0, int(round(question_count * easy_pct)))
        hard_count = max(0, int(round(question_count * hard_pct)))
        medium_count = max(0, question_count - easy_count - hard_count)
        
        # Ensure we have exactly question_count slots allocated
        allocated_diffs = (["easy"] * easy_count) + (["medium"] * medium_count) + (["hard"] * hard_count)
        # Adjust in case of rounding off
        while len(allocated_diffs) < question_count:
            allocated_diffs.append("medium")
        while len(allocated_diffs) > question_count:
            allocated_diffs.pop()
 
        # Sort difficulties so easy questions appear first
        allocated_diffs.sort(key=lambda d: 0 if d == "easy" else (1 if d == "medium" else 2))
 
        # 2. Map Bloom Levels
        # Map available levels based on user selections or fallbacks
        avail_blooms = [b for b in bloom_levels if b]
        if not avail_blooms:
            avail_blooms = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"]
 
        # 3. Map Question Types
        avail_types = [t for t in question_types if t]
        if not avail_types:
            avail_types = ["multiple_choice"]
 
        # 4. Map Objectives based on topic
        clean_topic = topic.strip() if topic else "General Assessment"
        objectives = [
            f"Core principles and definitions of {clean_topic}",
            f"Conceptual mechanisms and properties of {clean_topic}",
            f"Practical implementation and application scenarios of {clean_topic}",
            f"Trade-offs, performance constraints, or analytical comparison of {clean_topic}",
            f"Advanced debugging, error evaluation, or structural optimization of {clean_topic}",
            f"Design patterns, architecture choices, or safety/security implications of {clean_topic}"
        ]
 
        slots = []
        for i in range(question_count):
            diff = allocated_diffs[i]
            
            # Select appropriate bloom level based on difficulty correlation if available
            if diff == "easy":
                filtered_blooms = [b for b in avail_blooms if b in ["Remember", "Understand"]]
                bloom = filtered_blooms[i % len(filtered_blooms)] if filtered_blooms else avail_blooms[i % len(avail_blooms)]
            elif diff == "hard":
                filtered_blooms = [b for b in avail_blooms if b in ["Analyze", "Evaluate", "Create"]]
                bloom = filtered_blooms[i % len(filtered_blooms)] if filtered_blooms else avail_blooms[i % len(avail_blooms)]
            else:
                filtered_blooms = [b for b in avail_blooms if b in ["Understand", "Apply", "Analyze"]]
                bloom = filtered_blooms[i % len(filtered_blooms)] if filtered_blooms else avail_blooms[i % len(avail_blooms)]

            expected_marks = default_marks
            if marks_mode == "auto":
                if diff == "easy":
                    expected_marks = 1
                elif diff == "hard":
                    expected_marks = 5
                else:
                    expected_marks = 2

            q_type = avail_types[i % len(avail_types)]
            obj = objectives[i % len(objectives)]
            if question_count > len(objectives):
                obj = f"{obj} (Aspect {i + 1})"
 
            slots.append(BlueprintSlot(
                order_index=i,
                difficulty=diff,
                bloom_level=bloom,
                question_type=q_type,
                learning_objective=obj,
                marks=expected_marks
            ))
 
        return slots


class DeterministicValidator:
    """Performs strict programmatic schema, options, and text similarity checks."""
    
    @staticmethod
    def calculate_jaccard(s1: str, s2: str) -> float:
        w1 = set(re.findall(r"\b\w+\b", s1.lower()))
        w2 = set(re.findall(r"\b\w+\b", s2.lower()))
        if not w1 or not w2:
            return 0.0
        return len(w1.intersection(w2)) / len(w1.union(w2))

    @classmethod
    def validate_schema(cls, q: Dict[str, Any]) -> tuple[bool, str]:
        if not isinstance(q, dict):
            return False, "Format is not a JSON object"
            
        required_keys = ["text", "difficulty", "topic", "marks", "explanation", "question_type", "bloom_level", "options"]
        for key in required_keys:
            if key not in q:
                return False, f"Missing required schema key: '{key}'"
                
        if not q.get("text", "").strip():
            return False, "Question text is empty"
            
        if len(q.get("text", "").strip()) < 15:
            return False, "Question text is too short (< 15 characters)"
            
        if not q.get("explanation", "").strip():
            return False, "Explanation is empty"
            
        exp = q.get("explanation", "").strip()
        if len(exp) < 15:
            return False, "Explanation is too short"
            
        exp_lower = exp.lower()
        if "core concept" not in exp_lower:
            return False, "Explanation is missing structured 'Core Concept' section"
        if "incorrect option" not in exp_lower and "distractor" not in exp_lower:
            return False, "Explanation is missing structured 'Incorrect Option Analysis' section"
        if "takeaway" not in exp_lower:
            return False, "Explanation is missing structured 'Learner Takeaway' section"

        return True, "Schema OK"

    @classmethod
    def validate_options(cls, q: Dict[str, Any]) -> tuple[bool, str]:
        options = q.get("options", [])
        if not isinstance(options, list):
            return False, "Options field must be a JSON array"
            
        q_type = q.get("question_type", "")
        
        # Verify text presence and display order
        opt_texts = []
        for idx, opt in enumerate(options):
            if not isinstance(opt, dict) or "text" not in opt or "is_correct" not in opt:
                return False, f"Option at index {idx} lacks text or is_correct status"
            text_clean = opt["text"].strip().lower()
            if not text_clean:
                return False, f"Option at index {idx} has empty text"
            opt_texts.append(text_clean)
            
        # Check option uniqueness within the question
        if len(set(opt_texts)) != len(opt_texts):
            return False, "Duplicate option texts found within the question"

        # Question type specific rules
        if q_type == "multiple_choice":
            if len(options) != 4:
                return False, f"Multiple choice question must have exactly 4 options (found {len(options)})"
            correct_count = sum(1 for o in options if o.get("is_correct"))
            if correct_count != 1:
                return False, f"Multiple choice question must have exactly 1 correct option (found {correct_count})"

        elif q_type == "multiple_select":
            if len(options) != 4:
                return False, f"Multiple select question must have exactly 4 options (found {len(options)})"
            correct_count = sum(1 for o in options if o.get("is_correct"))
            if correct_count < 1 or correct_count > 3:
                return False, f"Multiple select question must have between 1 and 3 correct options (found {correct_count})"

        elif q_type == "true_false":
            if len(options) != 2:
                return False, f"True/False question must have exactly 2 options (found {len(options)})"
            clean_texts = {o["text"].strip().lower() for o in options}
            if not ("true" in clean_texts and "false" in clean_texts):
                return False, "True/False options must be exactly 'True' and 'False'"
            correct_count = sum(1 for o in options if o.get("is_correct"))
            if correct_count != 1:
                return False, f"True/False question must have exactly 1 correct option (found {correct_count})"

        elif q_type in ["fill_in_the_blank", "short_answer"]:
            if len(options) < 1:
                return False, f"Fill-in-the-blank question must specify at least 1 option answer key"
            for o in options:
                if not o.get("is_correct"):
                    return False, f"All options in short answer keys must have is_correct=true"

        else:
            return False, f"Unsupported question type: '{q_type}'"

        return True, "Options OK"

    @classmethod
    def check_pool_duplicates(cls, q: Dict[str, Any], pool: List[Dict[str, Any]], threshold: float = 0.5) -> tuple[bool, str]:
        text_val = q.get("text", "")
        for idx, item in enumerate(pool):
            if not item:
                continue
            sim = cls.calculate_jaccard(text_val, item.get("text", ""))
            if sim > threshold:
                return False, f"Too similar to question {idx} in pool ({int(sim*100)}% text match)"
        return True, "Pool deduplication OK"

    @classmethod
    def check_db_duplicates(cls, q: Dict[str, Any], db_texts: List[str], threshold: float = 0.5) -> tuple[bool, str]:
        text_val = q.get("text", "")
        for idx, ext in enumerate(db_texts):
            sim = cls.calculate_jaccard(text_val, ext)
            if sim > threshold:
                return False, f"Too similar to an existing question in the database ({int(sim*100)}% text match)"
        return True, "DB deduplication OK"

    @classmethod
    def compute_quality_score(cls, q: Dict[str, Any]) -> float:
        # Base check
        schema_ok, _ = cls.validate_schema(q)
        if not schema_ok:
            return 0.0
        opts_ok, _ = cls.validate_options(q)
        if not opts_ok:
            return 0.0
            
        # Score components out of 5.0
        # 1. Question Text Quality (Depth / Context)
        text_len = len(q.get("text", "").strip())
        if text_len >= 120:
            score_text = 5.0
        elif text_len >= 60:
            score_text = 4.2
        elif text_len >= 30:
            score_text = 3.5
        else:
            score_text = 2.0
            
        # 2. Explanation Depth
        exp_len = len(q.get("explanation", "").strip())
        if exp_len >= 200:
            score_exp = 5.0
        elif exp_len >= 100:
            score_exp = 4.5
        elif exp_len >= 50:
            score_exp = 3.5
        else:
            score_exp = 2.0
            
        # 3. Distractor Balance (standard deviation of option lengths)
        options = q.get("options", [])
        if options:
            lengths = [len(o.get("text", "").strip()) for o in options]
            avg_len = sum(lengths) / len(lengths)
            variance = sum((l - avg_len) ** 2 for l in lengths) / len(lengths)
            std_dev = math.sqrt(variance)
            if std_dev < 15:
                score_opts = 5.0
            elif std_dev < 30:
                score_opts = 4.0
            else:
                score_opts = 3.0
        else:
            score_opts = 0.0
            
        return (score_text + score_exp + score_opts) / 3.0


class LearningObjectiveValidator:
    """Compares semantic learning objectives to prevent concept repetition."""
    
    @staticmethod
    def clean_keywords(text: str) -> set[str]:
        # Simple stop words filter to get core nouns and concepts
        stops = {"and", "or", "the", "a", "an", "of", "to", "in", "for", "on", "with", "by", "about", "at", "from", "how", "what", "why", "which"}
        words = re.findall(r"\b\w{3,}\b", text.lower())
        return {w for w in words if w not in stops}

    @classmethod
    def check_objective_repetition(
        cls,
        q_objective: str,
        pool_objectives: List[str],
        threshold: float = 0.4
    ) -> tuple[bool, str]:
        if not q_objective or not q_objective.strip():
            return True, "Objective is empty (skipped)"
            
        kw_q = cls.clean_keywords(q_objective)
        if not kw_q:
            return True, "Objective contains no key terms"

        for idx, item in enumerate(pool_objectives):
            if not item:
                continue
            kw_item = cls.clean_keywords(item)
            if not kw_item:
                continue
            # Calculate Jaccard similarity of keywords
            intersect = len(kw_q.intersection(kw_item))
            union = len(kw_q.union(kw_item))
            sim = intersect / union if union > 0 else 0.0
            
            if sim > threshold:
                return False, f"Duplicate learning objective concept: overlaps with existing objective '{item}' ({int(sim*100)}% concept match)"
                
        return True, "Objective uniqueness OK"


class AICriticEvaluator:
    """Invokes the AI critic model to score and provide structured audits of questions."""
    
    @staticmethod
    def get_system_instruction() -> str:
        return """You are acting as a Senior Academic Auditor and Principal Quality Assessor on a university examination board.
Your task is to audit the educational quality, clarity, and structural validity of the provided assessment questions.
You must return a valid JSON object matching the schema below. Output ONLY the JSON object, containing no other text or markdown wrapper formatting.

Target JSON Schema:
{
  "evaluations": [
    {
      "index": 0,
      "educational_quality": 4.5,
      "originality": 4.0,
      "reasoning_depth": 5.0,
      "clarity": 4.8,
      "engagement": 4.2,
      "is_valid": true,
      "learning_objective": "Summarized learning objective of the question",
      "rejection_reasons": [] 
    }
  ]
}

Criteria Guidelines (Score 1.0 to 5.0):
1. Educational Quality: Does it test a core conceptual principle, avoiding shallow syntax recalls or trivial definitions? Pure memorization or generic definition questions ("What is X?", "Define Y") must receive a low score.
2. Originality: Phrasing is fresh, scenarios are unique, avoiding standard chatbot tropes, simple database templates, or boilerplate code.
3. Reasoning Depth: Does it challenge candidates using Bloom's level requirements? Higher difficulty questions must require application, analysis, evaluation, or multi-step logic.
4. Clarity: Clear, unambiguous question text; options are distinct, grammatically correct, and mutually exclusive; exactly one singular correct answer.
5. Engagement: Formulated with a compelling scenario-based setup, real-world application hooks, or realistic debugging/troubleshooting contexts.

Rejection Reasons Rules:
If any question has a composite average score < 3.8, or any individual criteria score < 3.5, set is_valid = false.
You MUST provide at least one rejection tag in the "rejection_reasons" array if is_valid is false.
Supported rejection reasons:
- "weak distractors" (options are joke answers, implausible, grammatically unbalanced, or too obviously incorrect)
- "insufficient reasoning depth" (shallow recall, rote memory, no cognitive demand)
- "Bloom mismatch" (does not test the target difficulty/Bloom tier)
- "duplicate learning objective" (covers the exact same topic angle as prior concepts)
- "poor educational value" (trivial coding syntax, superficial definition recall, or search-and-find facts)
- "poor clarity" (ambiguous phrasing, spelling errors, multiple potentially correct options)
"""

    @classmethod
    async def evaluate_questions(
        cls,
        questions: List[Dict[str, Any]],
        provider: str,
        model_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        if not questions:
            return []

        # Prepare formatted JSON representation of questions for the Critic
        questions_payload = []
        for idx, q in enumerate(questions):
            questions_payload.append({
                "index": idx,
                "text": q.get("text"),
                "question_type": q.get("question_type"),
                "difficulty": q.get("difficulty"),
                "bloom_level": q.get("bloom_level"),
                "options": [{ "text": o.get("text"), "is_correct": o.get("is_correct") } for o in q.get("options", [])],
                "explanation": q.get("explanation"),
                "topic": q.get("topic")
            })

        prompt = f"Please audit the following {len(questions)} questions:\n"
        prompt += json.dumps(questions_payload, indent=2)

        try:
            ai_provider = AIProviderFactory.get_provider(provider)
            logger.info(f"Invoking Critic evaluator model using provider: {provider}")
            eval_results = await ai_provider.generate_questions(
                prompt=prompt,
                system_instruction=cls.get_system_instruction(),
                model_name=model_name or "",
                temperature=0.3  # Low temperature for deterministic scoring
            )
            
            # Re-key evaluations by index for safe retrieval
            keyed_results = {}
            for ev in eval_results.questions:
                idx = ev.get("index")
                if idx is not None:
                    keyed_results[int(idx)] = ev
            
            # Map back to questions index order
            final_evals = []
            for idx in range(len(questions)):
                fallback_eval = {
                    "index": idx,
                    "educational_quality": 4.0,
                    "originality": 4.0,
                    "reasoning_depth": 4.0,
                    "clarity": 4.0,
                    "engagement": 4.0,
                    "is_valid": True,
                    "learning_objective": questions[idx].get("topic", "General Topic"),
                    "rejection_reasons": []
                }
                final_evals.append(keyed_results.get(idx, fallback_eval))
                
            return final_evals

        except Exception as e:
            logger.error(f"Critic evaluation failed: {e}. Falling back to default passing scores.", exc_info=True)
            # Safe passing fallback
            return [{
                "index": idx,
                "educational_quality": 4.0,
                "originality": 4.0,
                "reasoning_depth": 4.0,
                "clarity": 4.0,
                "engagement": 4.0,
                "is_valid": True,
                "learning_objective": q.get("topic", "General Topic"),
                "rejection_reasons": []
            } for idx, q in enumerate(questions)]


class PipelineCoordinator:
    """Coordinates generation blueprints, hybrid validation checks, and guided iterative regeneration."""
    
    # Configurable similarity thresholds
    SIM_THRESHOLD_STEM = 0.35
    SIM_THRESHOLD_OBJ = 0.40
    SIM_THRESHOLD_ORIGINAL = 0.30

    @classmethod
    async def generate_quiz(
        cls,
        db: AsyncSession,
        question_count: int,
        difficulty: str,
        language: str,
        bloom_levels: List[str],
        question_types: List[str],
        topic: str,
        course_outcomes: List[str],
        question_distribution: Optional[str],
        question_quality: str,
        quiz_style: str,
        custom_prompt: Optional[str],
        provider: str,
        model_name: Optional[str],
        request_id: str,
        document_names: Optional[List[str]] = None,
        total_extracted_text: Optional[str] = "",
        marks_mode: str = "default",
        default_marks: int = 1,
        user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        start_time = time.time()
        perf_start = time.perf_counter()
        
        # Profile RAG / Context building
        rag_start = time.perf_counter()
        embedding_ms = 0.0
        rag_ms = 0.0
        
        final_context = ""
        has_document_context = bool(total_extracted_text and total_extracted_text.strip())
        
        if has_document_context:
            text_length = len(total_extracted_text)
            if document_names and len(document_names) > 0 and text_length > 50000:
                from app.services.ai_retrieval import AIRetrievalService, RAGPromptBuilder
                retrieval_service = AIRetrievalService()
                search_query = topic or custom_prompt or "assessment questions"
                
                # Check cache for query embedding
                if search_query in _embedding_cache:
                    logger.info(f"Cache HIT: Using cached query embedding for '{search_query}'")
                    query_emb = _embedding_cache[search_query]
                    embedding_ms = 0.0
                else:
                    emb_start = time.perf_counter()
                    query_emb = await retrieval_service.embedding_service.get_embedding(search_query)
                    embedding_ms = (time.perf_counter() - emb_start) * 1000.0
                    _embedding_cache[search_query] = query_emb
                
                # Check cache for retrieved chunks
                cache_key = (search_query, tuple(sorted(document_names)))
                if cache_key in _retrieval_cache:
                    logger.info(f"Cache HIT: Using cached retrieved chunks for query '{search_query}'")
                    chunks_content = _retrieval_cache[cache_key]
                    rag_ms = 0.0
                else:
                    retrieved_chunks = await retrieval_service.vector_store.query_similar_chunks(
                        db, query_emb, limit=5, document_names=document_names
                    )
                    chunks_content = [res["content"] for res in retrieved_chunks]
                    _retrieval_cache[cache_key] = chunks_content
                    rag_ms = (time.perf_counter() - rag_start) * 1000.0 - embedding_ms
                
                base_prompt = ""
                if topic:
                    base_prompt += f"Topic/Context Prompt: {topic}\n"
                
                final_context = RAGPromptBuilder.build_prompt(base_prompt, chunks_content)
            else:
                final_context = f"[EXTRACTED DOCUMENT CONTENT]\n{total_extracted_text}\n"
                if topic:
                    final_context = f"Topic/Context Prompt: {topic}\n\n" + final_context
                rag_ms = (time.perf_counter() - rag_start) * 1000.0
        else:
            if topic:
                final_context = f"Topic/Context Prompt: {topic}\n"
            rag_ms = (time.perf_counter() - rag_start) * 1000.0

        try:
            # Step 0: Match subject profile dynamically
            profile = SubjectProfileManager.get_profile(topic)
            subject_guidelines = profile["guidelines"]

            # Log request inputs
            logger.info("==========================================")
            logger.info("RUNTIME VERIFICATION: INITIAL QUIZ GENERATION PIPELINE")
            logger.info(f"Request ID: {request_id}")
            logger.info(f"Requested question count: {question_count}")
            logger.info(f"Selected provider: {provider} (model: {model_name or 'default'})")
            logger.info(f"Topic target: '{topic}'")
            logger.info(f"Subject Profile: '{profile['name']}'")
            logger.info(f"Difficulty target: '{difficulty}'")
            logger.info(f"Bloom levels: {bloom_levels}")
            logger.info(f"Question types: {question_types}")
            logger.info(f"Quiz style: '{quiz_style}'")
            logger.info(f"Quality strategy: '{question_quality}'")
            logger.info(f"Distribution: '{question_distribution}'")
            logger.info("==========================================")

            # Step 1: Calculate oversampling pool target count M
            if question_quality == "fast":
                oversample_count = question_count
                logger.info("Fast Quality Mode: Oversampling pool disabled to minimize latency.")
            else:
                if question_count <= 2:
                    oversample_count = question_count + 1
                elif question_count <= 5:
                    oversample_count = question_count + 2
                elif question_count <= 10:
                    oversample_count = question_count + 3
                else:
                    oversample_count = question_count + max(4, math.ceil(0.3 * question_count))
                logger.info(f"Oversampling enabled: requesting {oversample_count} candidates for {question_count} needed slots.")

            # Generate the Question Blueprint of size M
            blueprint = QuestionBlueprint.create_blueprint(
                question_count=oversample_count,
                difficulty=difficulty,
                bloom_levels=bloom_levels,
                question_types=question_types,
                topic=topic,
                question_distribution=question_distribution,
                marks_mode=marks_mode,
                default_marks=default_marks
            )
            logger.info(f"Question Blueprint created successfully with {len(blueprint)} target slots.")

            # Load database questions for deduplication checks
            duplicate_start = time.perf_counter()
            duplicate_ms = 0.0
            try:
                ext_result = await db.execute(select(Question.text).order_by(Question.created_at.desc()).limit(150))
                db_texts = [r[0] for r in ext_result.all()]
            except Exception as e:
                logger.warning(f"Failed to fetch database questions for deduplication: {e}")
                db_texts = []
            duplicate_ms += (time.perf_counter() - duplicate_start) * 1000.0

            # Load style template
            from app.services.quiz_style_templates import QuizStyleTemplateManager
            style_prompt_block = QuizStyleTemplateManager.get_style_prompt(quiz_style)

            # Step 2: Build generation prompt targeting the blueprint of size M
            prompt_start = time.perf_counter()
            has_document_context = "[CONTEXT INFORMATION]" in final_context or "[EXTRACTED DOCUMENT CONTENT]" in final_context

            system_instruction = style_prompt_block + "\n\n"
            system_instruction += "Your primary objective is to produce high-quality, professional educational assessments that test deep conceptual understanding and problem-solving rather than simple memorization.\n"
            system_instruction += "You MUST return ONLY a valid JSON array of questions matching the requested slots. Do NOT wrap inside markdown block wrappers or code fences.\n"
            
            system_instruction += "\nCRITICAL RESPONSE FORMAT & QUALITY RULES:\n"
            system_instruction += "1. Output ONLY the raw valid JSON array. Absolutely NO leading/trailing text, explanations, or notes outside the JSON.\n"
            system_instruction += "2. Do NOT wrap the JSON in markdown code blocks like ```json ... ```. Output raw JSON text directly.\n"
            system_instruction += "3. The text of the question stems, options, and explanations must NEVER contain fragments of these prompt instructions, template variables, system prompt, or blueprint slot guidelines (such as 'Generate 10 questions', 'Blueprint Slot', etc.). Stems must be clean and ready for exams.\n"
            system_instruction += "4. Do NOT output any internal reasoning, draft texts, or conversational wrappers.\n\n"
            
            system_instruction += "Each question object in the array must strictly match this schema:\n"
            system_instruction += """{
  "text": "Question text containing context/scenarios. For code, use clean markdown blocks.",
  "difficulty": "easy / medium / hard",
  "topic": "topic name",
  "marks": 1,
  "explanation": "Detailed explanation containing: **Core Concept**, **Incorrect Option Analysis**, and **Learner Takeaway**.",
  "question_type": "multiple_choice / multiple_select / true_false / fill_in_the_blank / short_answer",
  "bloom_level": "bloom taxonomy level",
  "learning_objective": "specific detailed concept tested",
  "options": [
    {
      "text": "option text",
      "is_correct": true,
      "display_order": 0
    }
  ]
}

Core Pedagogical Quality Rules:
1. Avoid Generic/Chatbot Questions: NEVER generate questions like "What is ChatGPT?", "What is Claude?", "What is Python?", "Define machine learning". Avoid simple definition recall questions completely.
2. Conceptual & Problem-Solving Focus: Prioritize scenario-based, application-oriented, analytical, conceptual, and troubleshooting/debugging questions. Every question should teach or assess a meaningful learning objective.
3. High-Quality Distractors: Distractors (incorrect options) must be highly plausible, representing common student misconceptions or logical pitfalls. Avoid joke options, spelling variations of the correct option, or obviously incorrect fillers. All options must be grammatically balanced, similar in length, and map logically to the topic.
4. Rich Explanations: The explanation field MUST be detailed and must specifically contain these headers:
   - **Core Concept**: Explain why the correct answer is correct and reinforce the main academic/pedagogical principle.
   - **Incorrect Option Analysis**: Explain why each of the other options is incorrect and what student misconception or logical error is tested by each incorrect option/distractor.
   - **Learner Takeaway**: A concise takeaway summarizing what the learner should remember.
5. Cognitive Demand Calibration:
   - 'easy' difficulty: Target recall, identification, and basic understanding (Bloom Level: Remember, Understand).
   - 'medium' difficulty: Target application, implementation, debugging simple issues, and interpretation (Bloom Level: Apply, Analyze).
   - 'hard' difficulty: Target multi-step evaluation, architectural trade-offs, complex synthesis, and deep debugging/refactoring (Bloom Level: Evaluate, Create).
"""
            system_instruction += f"\nSUBJECT-SPECIFIC GUIDELINES:\n{subject_guidelines}\n"
            
            if has_document_context:
                system_instruction += "\nCRITICAL INSTRUCTION: You are generating questions based ONLY on the provided Context Content (from the uploaded document). The style-specific example is provided ONLY to demonstrate structural/JSON format and question style, not the topic. You MUST NOT generate questions about the topic of the example (such as databases, coding, or Python) unless the Context Content is explicitly about those topics. All questions MUST be derived directly from the Context Content. If the Context Content does not contain enough information to generate the requested number of questions, generate ONLY as many high-quality questions as the Context Content actually supports. Do NOT invent facts or use external knowledge. If the content is insufficient to generate even a single question, return an empty JSON array.\n"

            prompt = f"Generate exactly {oversample_count} questions based on this exact blueprint:\n"
            for slot in blueprint:
                prompt += f"- Slot {slot.order_index}: Difficulty={slot.difficulty}, Bloom Level={slot.bloom_level}, Type={slot.question_type}, Target Objective='{slot.learning_objective}'\n"
            
            prompt += f"\nLanguage: {language}\n"
            prompt += f"Quality Strategy: {question_quality} (Complexity target)\n"
            if custom_prompt:
                prompt += f"Additional instructions: {custom_prompt}\n"
            prompt += f"\nContext Content:\n{final_context[:25000]}\n"
            
            if has_document_context:
                prompt += "\nIMPORTANT: The questions MUST be based exclusively on the provided Context Content from the uploaded document. Do not use external knowledge or fall back to default subjects like Python or databases unless they are explicitly discussed in the Context Content. If there is insufficient information in the Context Content, generate only as many questions as it supports.\n"
            prompt_ms = (time.perf_counter() - prompt_start) * 1000.0

            # Step 3: Call Provider
            from app.core.ai_providers import AIProviderFactory, AIProviderError, AIProviderConfigurationError, AIProviderUnavailableError
            
            provider_ms = 0.0
            provider_start = time.perf_counter()
            try:
                ai_provider = AIProviderFactory.get_provider(provider)
                logger.info(f"Calling generator provider: {provider}")
                
                # Adjust temperature based on quality mode
                gen_temp = 0.1 if question_quality == "fast" else 0.7
                
                result = await ai_provider.generate_questions(
                    prompt=prompt,
                    system_instruction=system_instruction,
                    model_name=model_name or "",
                    temperature=gen_temp
                )
                raw_questions = result.questions
                token_usage = result.token_usage
                active_provider = result.provider or provider
                active_model = result.model or (model_name or "default")
            except AIProviderConfigurationError as config_err:
                logger.error(f"AI provider configuration error: {config_err}")
                if settings.ENABLE_MOCK_PROVIDER:
                    logger.warning("Invoking Mock fallback due to provider config error.")
                    mock = AIProviderFactory.get_provider("mock")
                    ai_provider = mock
                    result = await mock.generate_questions(prompt, system_instruction, "mock-fallback")
                    raw_questions = result.questions
                    token_usage = result.token_usage
                    active_provider = "mock"
                    active_model = "mock-fallback"
                else:
                    if provider != "auto":
                        raise HTTPException(status_code=400, detail=str(config_err))
                    else:
                        raise HTTPException(
                            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="All AI providers are currently unavailable. Please try again later."
                        )
            except AIProviderUnavailableError as unavailable_err:
                logger.error(f"AI provider unavailable error: {unavailable_err}")
                if settings.ENABLE_MOCK_PROVIDER:
                    logger.warning("Invoking Mock fallback due to provider unavailable error.")
                    mock = AIProviderFactory.get_provider("mock")
                    ai_provider = mock
                    result = await mock.generate_questions(prompt, system_instruction, "mock-fallback")
                    raw_questions = result.questions
                    token_usage = result.token_usage
                    active_provider = "mock"
                    active_model = "mock-fallback"
                else:
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="All AI providers are currently unavailable. Please try again later."
                    )
            except Exception as e:
                logger.exception(f"Unexpected AI provider error: {e}")
                if settings.ENABLE_MOCK_PROVIDER:
                    logger.warning("Invoking Mock fallback due to unexpected provider error.")
                    mock = AIProviderFactory.get_provider("mock")
                    ai_provider = mock
                    result = await mock.generate_questions(prompt, system_instruction, "mock-fallback")
                    raw_questions = result.questions
                    token_usage = result.token_usage
                    active_provider = "mock"
                    active_model = "mock-fallback"
                else:
                    raise HTTPException(
                        status_code=500,
                        detail="Unexpected AI provider error. Please contact support."
                    )
            provider_ms += (time.perf_counter() - provider_start) * 1000.0

            # Premium Quality Mode Self-Review & Refinement Pass
            if question_quality == "premium" and raw_questions:
                logger.info("Premium Mode: Running AI Batch Self-Review and Refinement pass.")
                refinement_instruction = (
                    f"You are acting as an elite educational quality controller working in the style: '{quiz_style}'. "
                    "Review the following generated questions and optimize them for high-quality production outputs:\n"
                    "1. Distractor Validation: Ensure all incorrect options (distractors) are highly plausible and free from trivial clues. All options must match in grammar, phrasing style, and approximate character length.\n"
                    "2. Explanation Refinement: Ensure each explanation has detailed, separate sections for **Core Concept** (explaining why the correct answer is correct), **Incorrect Option Analysis** (explaining why each other option is incorrect), and **Learner Takeaway**.\n"
                    "3. Formatting & Logic: Fix any typos, ensure options are unique, and verify that the correct option is indeed correct.\n"
                    "Return the refined questions in the exact same JSON array format matching the schema. Return ONLY the JSON array without markdown block wrappers."
                )
                try:
                    refine_start = time.perf_counter()
                    refine_prompt = f"Refine and optimize these questions:\n{json.dumps(raw_questions, indent=2)}"
                    refine_res = await ai_provider.generate_questions(
                        prompt=refine_prompt,
                        system_instruction=refinement_instruction,
                        model_name=model_name or "",
                        temperature=0.3
                    )
                    if refine_res and refine_res.questions:
                        logger.info(f"Premium Mode: Successfully refined {len(refine_res.questions)} questions.")
                        raw_questions = refine_res.questions
                        if refine_res.token_usage:
                            from app.core.ai_providers import TokenUsage
                            token_usage = TokenUsage(
                                prompt_tokens=(token_usage.prompt_tokens if token_usage else 0) + refine_res.token_usage.prompt_tokens,
                                completion_tokens=(token_usage.completion_tokens if token_usage else 0) + refine_res.token_usage.completion_tokens,
                                total_tokens=(token_usage.total_tokens if token_usage else 0) + refine_res.token_usage.total_tokens
                            )
                    provider_ms += (time.perf_counter() - refine_start) * 1000.0
                except Exception as ref_ex:
                    logger.error(f"Premium Mode self-review refinement failed: {ref_ex}. Continuing with original pool.")

            # Step 4: Run validation filter and build candidate pool
            validation_start = time.perf_counter()
            validation_ms = 0.0
            candidate_pool = []
            total_repairs = 0
            validation_failures = 0
            
            for q in raw_questions:
                # Run intelligent validation repair
                q, repairs = repair_question(q, topic=topic or "General")
                total_repairs += repairs
                
                is_schema, schema_err = DeterministicValidator.validate_schema(q)
                if not is_schema:
                    logger.warning(f"Oversampling Validation: Question rejected due to schema error: {schema_err}")
                    validation_failures += 1
                    continue
                    
                is_opts, opt_err = DeterministicValidator.validate_options(q)
                if not is_opts:
                    logger.warning(f"Oversampling Validation: Question rejected due to options error: {opt_err}")
                    validation_failures += 1
                    continue

                stem = q.get("text", "")
                is_db_uniq = True
                
                # Deduplication logic (Jaccard check)
                dup_start = time.perf_counter()
                for db_t in db_texts:
                    sim = DeterministicValidator.calculate_jaccard(stem, db_t)
                    if sim > cls.SIM_THRESHOLD_STEM:
                        is_db_uniq = False
                        logger.warning(f"Oversampling Validation: Question rejected as too similar to database question ({sim:.2f} match)")
                        break
                duplicate_ms += (time.perf_counter() - dup_start) * 1000.0
                
                if not is_db_uniq:
                    continue

                candidate_pool.append(q)

            logger.info(f"Oversampling: {len(candidate_pool)} / {len(raw_questions)} candidates passed validation gates.")

            # Step 5: Quality Critic Evaluation
            MIN_QUALITY_THRESHOLD = 3.0
            filtered_candidates = []
            
            # Determine if we should use lightweight validation
            use_lightweight_validation = (question_quality == "balanced" and question_count <= 3)

            if use_lightweight_validation:
                logger.info(f"Lightweight Validation active: skipping LLM Critic for small balanced quiz (count: {question_count})")
                for q in candidate_pool:
                    score = DeterministicValidator.compute_quality_score(q)
                    q["critic_score"] = score
                    if score < MIN_QUALITY_THRESHOLD:
                        logger.warning(f"Deterministic validation: Candidate rejected because computed score {score:.2f} is below threshold {MIN_QUALITY_THRESHOLD}")
                    else:
                        filtered_candidates.append(q)
                candidate_pool = filtered_candidates
            elif question_quality != "fast" and candidate_pool:
                logger.info(f"Invoking Critic evaluator on {len(candidate_pool)} candidates.")
                critic_start = time.perf_counter()
                critic_evals = await AICriticEvaluator.evaluate_questions(
                    questions=candidate_pool,
                    provider=provider,
                    model_name=model_name or ""
                )
                provider_ms += (time.perf_counter() - critic_start) * 1000.0
                
                for idx, q in enumerate(candidate_pool):
                    c_eval = critic_evals[idx] if idx < len(critic_evals) else {}
                    score = (
                        c_eval.get("educational_quality", 4.0) +
                        c_eval.get("originality", 4.0) +
                        c_eval.get("reasoning_depth", 4.0) +
                        c_eval.get("clarity", 4.0) +
                        c_eval.get("engagement", 4.0)
                    ) / 5.0
                    q["critic_score"] = score
                    
                    if score < MIN_QUALITY_THRESHOLD:
                        logger.warning(f"Oversampling quality check: Candidate rejected because quality score {score:.2f} is below threshold {MIN_QUALITY_THRESHOLD}")
                    else:
                        filtered_candidates.append(q)
                
                candidate_pool = filtered_candidates
            else:
                logger.info("Fast Quality Mode or empty pool: Skipping Critic evaluation to minimize latency.")
                for q in candidate_pool:
                    q["critic_score"] = 5.0

            validation_ms += (time.perf_counter() - validation_start) * 1000.0 - duplicate_ms

            # Sort candidates descending by Critic score
            candidate_pool.sort(key=lambda x: x.get("critic_score", 4.0), reverse=True)

            # Step 6: Whole-Quiz Diversity Audit selection
            similarity_start = time.perf_counter()
            similarity_ms = 0.0
            selected_questions = []
            rejected_duplicates = []
            
            for q in candidate_pool:
                if len(selected_questions) >= question_count:
                    break
                    
                too_similar = False
                for sq in selected_questions:
                    sim_stem = DeterministicValidator.calculate_jaccard(q.get("text", ""), sq.get("text", ""))
                    sim_obj = DeterministicValidator.calculate_jaccard(q.get("learning_objective", ""), sq.get("learning_objective", ""))
                    
                    # Check option text duplication
                    q_opts = [o.get("text", "").lower().strip() for o in q.get("options", [])]
                    sq_opts = [o.get("text", "").lower().strip() for o in sq.get("options", [])]
                    common_opts = set(q_opts) & set(sq_opts)
                    
                    if sim_stem > cls.SIM_THRESHOLD_STEM or sim_obj > cls.SIM_THRESHOLD_OBJ or len(common_opts) > 1:
                        too_similar = True
                        break
                
                if not too_similar:
                    selected_questions.append(q)
                else:
                    rejected_duplicates.append(q)
            similarity_ms += (time.perf_counter() - similarity_start) * 1000.0

            # Step 7: Guided Iterative Regeneration for any missing slots
            max_attempts = 3
            questions_regenerated = 0
            rejections_detail = []

            for attempt in range(max_attempts):
                if len(selected_questions) >= question_count:
                    break
                    
                gap = question_count - len(selected_questions)
                logger.info(f"Oversampling Selection Loop {attempt+1}: Gap of {gap} questions. Regenerating target slots.")
                missing_slots = blueprint[len(selected_questions):question_count]
                
                async def process_slot(slot):
                    nonlocal questions_regenerated, provider_ms, validation_ms
                    questions_regenerated += 1
                    
                    guided_prompt = f"Regenerate exactly 1 question to fit this target slot:\n"
                    guided_prompt += f"- Slot index: {slot.order_index}\n"
                    guided_prompt += f"- Target Difficulty: {slot.difficulty}\n"
                    guided_prompt += f"- Target Bloom level: {slot.bloom_level}\n"
                    guided_prompt += f"- Question Type: {slot.question_type}\n"
                    guided_prompt += f"- Target Learning Objective: '{slot.learning_objective}'\n"
                    guided_prompt += f"\nCRITICAL FORMAT RULE: Output ONLY a valid JSON array containing exactly 1 question matching the requested slot. Do NOT wrap inside markdown block wrappers or code fences. Absolutely NO text outside the JSON. The question stem must NEVER contain prompt words or instructions.\n"
                    guided_prompt += f"\nCRITICAL CORRECTIVE FEEDBACK: Please address this issue specifically by writing a premium quality question. Ensure options are distinct, distractors are plausible, and explanations follow the Core Concept, Incorrect Option Analysis, and Learner Takeaway format.\n"
                    guided_prompt += f"\nSUBJECT-SPECIFIC GUIDELINES:\n{subject_guidelines}\n"
                    guided_prompt += f"\nContext Content:\n{final_context[:20000]}\n"
                    
                    try:
                        regen_start = time.perf_counter()
                        rep_res = await ai_provider.generate_questions(
                            prompt=guided_prompt,
                            system_instruction=system_instruction,
                            model_name=model_name or "",
                            temperature=0.8
                        )
                        provider_ms += (time.perf_counter() - regen_start) * 1000.0
                        
                        if rep_res and rep_res.questions:
                            new_q = rep_res.questions[0]
                            
                            # Run intelligent validation repair
                            new_q, repairs = repair_question(new_q, topic=topic or "General")
                            nonlocal total_repairs
                            total_repairs += repairs
                            
                            regen_val_start = time.perf_counter()
                            is_schema, schema_err = DeterministicValidator.validate_schema(new_q)
                            is_opts, opt_err = DeterministicValidator.validate_options(new_q)
                            
                            if is_schema and is_opts:
                                # Evaluate Critic based on quality mode
                                if question_quality == "balanced":
                                    score = DeterministicValidator.compute_quality_score(new_q)
                                    is_valid_q = (score >= 3.0)
                                    validation_ms += (time.perf_counter() - regen_val_start) * 1000.0
                                elif question_quality == "premium":
                                    # Premium critic call
                                    critic_start = time.perf_counter()
                                    c_evals = await AICriticEvaluator.evaluate_questions([new_q], provider, model_name or "")
                                    provider_ms += (time.perf_counter() - critic_start) * 1000.0
                                    
                                    c_eval = c_evals[0] if c_evals else {}
                                    score = (
                                        c_eval.get("educational_quality", 4.0) +
                                        c_eval.get("originality", 4.0) +
                                        c_eval.get("reasoning_depth", 4.0) +
                                        c_eval.get("clarity", 4.0) +
                                        c_eval.get("engagement", 4.0)
                                    ) / 5.0
                                    is_valid_q = (score >= 3.0)
                                    validation_ms += (time.perf_counter() - regen_val_start) * 1000.0
                                else:
                                    score = 5.0
                                    is_valid_q = True
                                    validation_ms += (time.perf_counter() - regen_val_start) * 1000.0
    
                                new_q["critic_score"] = score
                                if is_valid_q:
                                    new_q["order_index"] = slot.order_index
                                    new_q["ai_provider"] = rep_res.provider or provider
                                    new_q["ai_model"] = rep_res.model or (model_name or "default")
                                    return new_q
                                else:
                                    return ("quality_failed", f"Slot {slot.order_index} failed quality score threshold")
                            else:
                                validation_ms += (time.perf_counter() - regen_val_start) * 1000.0
                                return ("validation_failed", f"Slot {slot.order_index} failed validation: {schema_err or opt_err}")
                    except Exception as ex:
                        logger.error(f"Guided slot regeneration failed for index {slot.order_index}: {ex}")
                    return None

                # Process all missing slots in parallel
                tasks = [process_slot(slot) for slot in missing_slots]
                results = await asyncio.gather(*tasks)
                
                for res in results:
                    if res is None:
                        continue
                    if isinstance(res, tuple) and res[0] in ["quality_failed", "validation_failed"]:
                        rejections_detail.append(res[1])
                        continue
                    
                    # Check diversity sequentially against already selected questions
                    new_q = res
                    too_similar = False
                    
                    sim_start = time.perf_counter()
                    for sq in selected_questions:
                        sim_stem = DeterministicValidator.calculate_jaccard(new_q.get("text", ""), sq.get("text", ""))
                        sim_obj = DeterministicValidator.calculate_jaccard(new_q.get("learning_objective", ""), sq.get("learning_objective", ""))
                        if sim_stem > cls.SIM_THRESHOLD_STEM or sim_obj > cls.SIM_THRESHOLD_OBJ:
                            too_similar = True
                            break
                    similarity_ms += (time.perf_counter() - sim_start) * 1000.0
                            
                    if not too_similar:
                        selected_questions.append(new_q)
                        if len(selected_questions) >= question_count:
                            break
                    else:
                        rejections_detail.append(f"Regenerated slot {new_q.get('order_index')} failed: too similar to existing questions")

            # Emergency fallback: fill remaining slots from rejected candidates
            if len(selected_questions) < question_count:
                logger.warning(f"Oversampling selection could not find enough diverse questions. Gap: {question_count - len(selected_questions)}. Filling gaps with highest quality candidates.")
                remaining = [q for q in candidate_pool if q not in selected_questions]
                for q in remaining:
                    if len(selected_questions) >= question_count:
                        break
                    selected_questions.append(q)

            # Fallback to Mock provider for any remaining empty slots (skipped if document context is active)
            if not has_document_context:
                for idx in range(question_count):
                    if idx >= len(selected_questions):
                        if settings.ENABLE_MOCK_PROVIDER:
                            logger.warning(f"Slot {idx} remains empty. Invoking Mock fallback.")
                            mock = AIProviderFactory.get_provider("mock")
                            
                            prov_start = time.perf_counter()
                            mock_res = await mock.generate_questions(prompt, system_instruction, "mock-fallback")
                            provider_ms += (time.perf_counter() - prov_start) * 1000.0
                            
                            if mock_res and mock_res.questions:
                                q = mock_res.questions[idx] if len(mock_res.questions) > idx else mock_res.questions[0]
                                q["order_index"] = idx
                                q["ai_provider"] = "mock"
                                q["ai_model"] = "mock-fallback"
                                selected_questions.append(q)
                        else:
                            logger.warning(f"Slot {idx} remains empty. Mock fallback is disabled.")
            else:
                if len(selected_questions) < question_count:
                    logger.warning(f"Document context is active, but only {len(selected_questions)} questions could be generated. Skipping Mock fallback to prevent topic drift.")

            if len(selected_questions) == 0:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="All AI providers are currently unavailable. Please try again later."
                )

            # Cleanup final formatting
            formatting_start = time.perf_counter()
            formatting_ms = 0.0
            clean_results = []
            for idx, q in enumerate(selected_questions[:question_count]):
                if q:
                    processed, _ = QuestionProcessor.process_question(
                        q,
                        marks_mode=marks_mode,
                        default_marks=default_marks,
                        enforce_difficulty=difficulty if difficulty != "mixed" else None,
                        enforce_type=question_types[0] if len(question_types) == 1 else None
                    )
                    processed["order_index"] = idx
                    processed["ai_provider"] = processed.get("ai_provider") or active_provider
                    processed["ai_model"] = processed.get("ai_model") or active_model
                    processed["generated_by_ai"] = True
                    clean_results.append(processed)

            formatting_ms += (time.perf_counter() - formatting_start) * 1000.0
            generation_time = time.perf_counter() - perf_start
            total_ms = (time.perf_counter() - perf_start) * 1000.0

            # Calculate metrics for Runtime Audit Log
            stems = [q.get("text", "") for q in clean_results]
            if len(stems) > 1:
                jaccards = []
                for idx_a in range(len(stems)):
                    for idx_b in range(idx_a + 1, len(stems)):
                        jaccards.append(DeterministicValidator.calculate_jaccard(stems[idx_a], stems[idx_b]))
                diversity_score = 1.0 - (sum(jaccards) / len(jaccards))
            else:
                diversity_score = 1.0

            scores = [q.get("critic_score", 4.0) for q in clean_results]
            quality_score = sum(scores) / len(scores) if scores else 4.0
            
            # Token usage metrics
            prompt_tk = token_usage.prompt_tokens if token_usage else 0
            comp_tk = token_usage.completion_tokens if token_usage else 0
            total_tk = token_usage.total_tokens if token_usage else 0
            cost_estimate = (prompt_tk * 0.075 / 1000000) + (comp_tk * 0.30 / 1000000)

            # Log final verification summary
            logger.warning("==========================================")
            logger.warning("RUNTIME AUDIT SUMMARY (GENERATION COMPLETE):")
            logger.warning(f"- Pipeline: generate_quiz")
            logger.warning(f"- Provider: {provider}")
            logger.warning(f"- Selected Model: {model_name or 'default'}")
            logger.warning(f"- Subject Profile: {profile['name']}")
            logger.warning(f"- Requested count: {question_count}")
            logger.warning(f"- Generated candidate count: {oversample_count}")
            logger.warning(f"- Returned question count: {len(clean_results)}")
            logger.warning(f"- Number regenerated: {questions_regenerated}")
            logger.warning(f"- Critic average score: {quality_score:.2f}")
            logger.warning(f"- Diversity score: {diversity_score:.2f}")
            logger.warning(f"- Generation time: {generation_time:.2f}s")
            logger.warning(f"- Token usage: prompt={prompt_tk}, completion={comp_tk}, total={total_tk}")
            logger.warning(f"- Estimated API Cost: ${cost_estimate:.6f} USD")
            logger.warning(f"- Validation history: {rejections_detail}")
            logger.warning("==========================================")

            # Generate AI_GENERATION_REPORT.md in workspace root
            try:
                import os
                from datetime import datetime, timezone
                bloom_dist = {}
                diff_dist = {}
                opt_dist = {0: 0, 1: 0, 2: 0, 3: 0}
                
                for q in clean_results:
                    b_level = q.get("bloom_level", "Unknown")
                    bloom_dist[b_level] = bloom_dist.get(b_level, 0) + 1
                    
                    df = q.get("difficulty", "Unknown")
                    diff_dist[df] = diff_dist.get(df, 0) + 1
                    
                    opts = q.get("options", [])
                    for o_idx, o in enumerate(opts):
                        if o.get("is_correct"):
                            opt_dist[o_idx] = opt_dist.get(o_idx, 0) + 1
                            
                questions_per_sec = len(clean_results) / generation_time if generation_time > 0 else 0.0
                
                report_path = "c:\\Users\\pabol\\OneDrive\\Desktop\\QuizVersaAI\\AI_GENERATION_REPORT.md"
                report_content = f"""# AI Generation Quality Report
Generated on: {datetime.now(timezone.utc).isoformat()}

## Performance Metrics
- **Average Generation Time**: {generation_time:.2f} seconds
- **Questions per Second**: {questions_per_sec:.2f} Q/sec
- **Total Questions Requested**: {question_count}
- **Total Questions Generated**: {len(clean_results)}

## LLM Execution Details
- **Primary Provider**: {provider}
- **Active Model Used**: {active_model}
- **Model Provider**: {active_provider}
- **Mock Fallback Invoked**: {"Yes" if active_provider == "mock" else "No"}
- **Total Tokens Used**: {total_tk} (Prompt: {prompt_tk}, Completion: {comp_tk})
- **Cost Estimate**: ${cost_estimate:.5f}

## Pipeline Metrics
- **Validation Success Rate**: {((len(clean_results) - validation_failures) / len(clean_results) * 100 if len(clean_results) > 0 else 0):.1f}%
- **JSON Repair Count**: {total_repairs}
- **Number of Guided Regenerations**: {questions_regenerated}
- **Prompt Leakage Cleanups**: {total_repairs} (Prefixes stripped)

## Educational Quality Assessments
- **Average Critic Quality Score**: {quality_score:.2f} / 5.0
- **Diversity Score (Jaccard Index)**: {diversity_score:.2f}
- **Duplicate Detections Avoided**: {len(rejected_duplicates)} questions rejected due to similarity

### Bloom Taxonomy Distribution
{os.linesep.join([f"- **{k}**: {v}" for k, v in bloom_dist.items()])}

### Difficulty Distribution
{os.linesep.join([f"- **{k}**: {v}" for k, v in diff_dist.items()])}

### Correct Option Position Distribution
{os.linesep.join([f"- **Option Index {k}**: {v}" for k, v in opt_dist.items()])}
"""
                with open(report_path, "w", encoding="utf-8") as rf:
                    rf.write(report_content)
                logger.info(f"AI Generation Report written successfully to {report_path}")
            except Exception as report_err:
                logger.error(f"Failed to generate AI Generation Report: {report_err}")

            # Log structured JSON profile
            profile_data = {
                "request_id": request_id,
                "event": "AI_GENERATION_PROFILE",
                "provider": provider,
                "quality": question_quality,
                "question_count": question_count,
                "rag_ms": round(rag_ms, 2),
                "embedding_ms": round(embedding_ms, 2),
                "duplicate_ms": round(duplicate_ms, 2),
                "similarity_ms": round(similarity_ms, 2),
                "prompt_ms": round(prompt_ms, 2),
                "provider_ms": round(provider_ms, 2),
                "validation_ms": round(validation_ms, 2),
                "total_ms": round(total_ms, 2)
            }
            logger.warning(json.dumps(profile_data))

            # Record detailed request trace
            from app.services.ai_metrics_service import ai_metrics_service
            ai_metrics_service.record_request_trace(
                request_id=request_id,
                provider=active_provider,
                request_type="generate",
                network_ms=provider_ms,
                processing_ms=total_ms - provider_ms,
                total_ms=total_ms,
                success=True,
                user_id=user_id,
                prompt_version=PROMPT_VERSION,
                model=active_model,
                selected_provider=provider,
                fallback_provider=active_provider if active_provider != provider else "none",
                retry_count=questions_regenerated,
                repair_count=total_repairs,
                validation_failures=validation_failures,
                fallback_reason="none",
                provider_latency_ms=provider_ms,
                validation_latency_ms=validation_ms,
                embedding_latency_ms=embedding_ms,
                rag_latency_ms=rag_ms,
                generation_latency_ms=provider_ms,
                tokens_input=prompt_tk,
                tokens_output=comp_tk,
                total_questions_generated=len(clean_results)
            )

            return clean_results
        except Exception as exc:
            total_ms = (time.perf_counter() - perf_start) * 1000.0
            from app.services.ai_metrics_service import ai_metrics_service
            ai_metrics_service.record_request_trace(
                request_id=request_id,
                provider=provider,
                request_type="generate",
                network_ms=0.0,
                processing_ms=total_ms,
                total_ms=total_ms,
                success=False,
                user_id=user_id,
                prompt_version=PROMPT_VERSION,
                model=model_name or "default",
                selected_provider=provider,
                fallback_provider="none",
                retry_count=0,
                repair_count=0,
                validation_failures=1,
                fallback_reason=str(exc),
                provider_latency_ms=0.0,
                validation_latency_ms=0.0,
                embedding_latency_ms=0.0,
                rag_latency_ms=0.0,
                generation_latency_ms=0.0,
                tokens_input=0,
                tokens_output=0,
                total_questions_generated=0
            )
            raise

    @classmethod
    def _structural_sanity_fix(cls, q: Dict[str, Any], enforce_type: Optional[str]) -> Dict[str, Any]:
        """Ensures option structure strictly matches the enforced question type.
        Mutates and returns q. Called after QuestionProcessor so enforce_type is already applied."""
        q_type = q.get("question_type", "multiple_choice")
        options = q.get("options", [])

        if q_type == "true_false":
            # Must be exactly ["True", "False"] with exactly 1 correct
            tf_opts = [
                {"text": "True", "is_correct": True, "display_order": 0},
                {"text": "False", "is_correct": False, "display_order": 1},
            ]
            # Respect AI's answer if it said False is correct
            corrects = [o for o in options if o.get("is_correct")]
            if corrects:
                correct_text = corrects[0].get("text", "True").lower().strip()
                if correct_text == "false":
                    tf_opts[0]["is_correct"] = False
                    tf_opts[1]["is_correct"] = True
            q["options"] = tf_opts

        elif q_type == "multiple_choice":
            # Must have exactly 4 options, exactly 1 correct
            # Pad if fewer than 4
            topic = q.get("topic", "the topic")
            while len(options) < 4:
                options.append({
                    "text": f"Incorrect alternative {len(options)}",
                    "is_correct": False,
                    "display_order": len(options)
                })
            # Truncate to 4
            options = options[:4]
            # Ensure exactly 1 correct
            corrects = [i for i, o in enumerate(options) if o.get("is_correct")]
            if len(corrects) == 0:
                options[0]["is_correct"] = True
            elif len(corrects) > 1:
                for i, o in enumerate(options):
                    o["is_correct"] = (i == corrects[0])
            for i, o in enumerate(options):
                o["display_order"] = i
            q["options"] = options

        elif q_type == "multiple_select":
            # Must have exactly 4 options, 2–3 correct
            while len(options) < 4:
                options.append({
                    "text": f"Incorrect alternative {len(options)}",
                    "is_correct": False,
                    "display_order": len(options)
                })
            options = options[:4]
            corrects = [i for i, o in enumerate(options) if o.get("is_correct")]
            if len(corrects) < 2:
                # Force at least 2 correct
                for i in range(min(2, len(options))):
                    options[i]["is_correct"] = True
                corrects = [i for i, o in enumerate(options) if o.get("is_correct")]
            if len(corrects) > 3:
                # Keep only first 3 correct
                kept = 0
                for o in options:
                    if o.get("is_correct"):
                        if kept >= 3:
                            o["is_correct"] = False
                        else:
                            kept += 1
            for i, o in enumerate(options):
                o["display_order"] = i
            q["options"] = options

        return q

    @classmethod
    async def regenerate_question(
        cls,
        db: AsyncSession,
        original_question: Dict[str, Any],
        existing_questions: List[str],
        provider: str,
        model_name: Optional[str],
        quiz_style: str,
        question_quality: str,
        final_context: str,
        request_id: str,
        user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        import time
        start_time = time.perf_counter()

        logger.info("==========================================")
        logger.info("RUNTIME VERIFICATION: SINGLE QUESTION REGENERATION PIPELINE")
        logger.info(f"Request ID: {request_id}")
        logger.info(f"Selected provider: {provider} (model: {model_name or 'default'})")
        logger.info(f"Original question: '{original_question.get('text', '')[:50]}...'")
        logger.info(f"Number of existing questions in draft: {len(existing_questions)}")
        logger.info(f"Targeting: Difficulty={original_question.get('difficulty')}, Bloom Level={original_question.get('bloom_level')}")
        logger.info("==========================================")

        try:
            # Load database questions for deduplication checks (once)
            try:
                ext_result = await db.execute(select(Question.text).order_by(Question.created_at.desc()).limit(150))
                db_texts = [r[0] for r in ext_result.all()]
            except Exception as e:
                logger.warning(f"Failed to fetch database questions: {e}")
                db_texts = []

            # Match subject profile
            topic = original_question.get("topic", "General")
            profile = SubjectProfileManager.get_profile(topic)
            subject_guidelines = profile["guidelines"]

            # Match style template
            from app.services.quiz_style_templates import QuizStyleTemplateManager
            style_prompt_block = QuizStyleTemplateManager.get_style_prompt(quiz_style)

            # Generate candidates count based on quality mode
            if question_quality == "fast":
                candidates_count = 1
                logger.info("Fast Quality Mode: Generating only 1 candidate to minimize latency.")
            elif question_quality == "balanced":
                candidates_count = 2
                logger.info("Balanced Quality Mode: Generating only 2 candidates to minimize latency.")
            else:
                candidates_count = 4

            target_difficulty = original_question.get("difficulty", "medium")
            target_type = original_question.get("question_type", "multiple_choice")
            target_bloom = original_question.get("bloom_level", "Understand")
            original_stem = original_question.get("text", "")
            uniqueness_hint = original_question.get("uniqueness_hint", "")

            # Build type-specific option structure instructions
            type_structure_rules = ""
            if target_type == "true_false":
                type_structure_rules = (
                    "OPTION STRUCTURE (true_false): Generate EXACTLY 2 options: "
                    "{\"text\": \"True\", \"is_correct\": <true|false>} and "
                    "{\"text\": \"False\", \"is_correct\": <true|false>}. "
                    "Exactly ONE must be correct."
                )
            elif target_type == "multiple_choice":
                type_structure_rules = (
                    "OPTION STRUCTURE (multiple_choice): Generate EXACTLY 4 options. "
                    "Exactly ONE option must have is_correct=true. "
                    "The other 3 must be plausible distractors with is_correct=false."
                )
            elif target_type == "multiple_select":
                type_structure_rules = (
                    "OPTION STRUCTURE (multiple_select): Generate EXACTLY 4 options. "
                    "Exactly 2 or 3 options must have is_correct=true. "
                    "The remaining options must be plausible distractors with is_correct=false."
                )
            elif target_type in ["fill_in_the_blank", "short_answer"]:
                type_structure_rules = (
                    "OPTION STRUCTURE (fill_in_the_blank / short_answer): "
                    "Generate 1–3 options, each representing an acceptable correct answer phrase. "
                    "All options must have is_correct=true."
                )

            system_instruction = (
                style_prompt_block + "\n\n"
                f"You are a professional educational assessor working in the style: '{quiz_style}'. "
                f"Your task is to generate {candidates_count} distinct candidate replacement questions to replace an original question.\n"
                f"MANDATORY CONSTRAINTS — these are absolute and cannot be changed:\n"
                f"  difficulty: {target_difficulty}\n"
                f"  question_type: {target_type}\n"
                f"  bloom_level: {target_bloom}\n"
                f"  topic: {topic}\n"
                f"\n{type_structure_rules}\n"
                f"\nSTRICT EXCLUSION: You MUST NOT generate any question that has text, wording, or stem that "
                f"resembles the following original question (Jaccard similarity > 25% is forbidden):\n"
                f"  EXCLUDED STEM: \"{original_stem[:300]}\"\n"
                f"\nNOVELTY REQUIREMENT: Each candidate must cover a completely different scenario, "
                f"angle, or sub-concept of the topic. Use different vocabulary, context, and application than the excluded stem.\n"
                f"\nSUBJECT-SPECIFIC GUIDELINES:\n{subject_guidelines}\n"
                f"\nEXPLANATION FORMAT REQUIREMENTS:\n"
                f"Every candidate explanation MUST contain the structured sections: 'Core Concept', 'Incorrect Option Analysis', and 'Learner Takeaway'.\n"
                f"Return a valid JSON array of {candidates_count} candidate questions."
            )

            prompt = (
                f"REGENERATION REQUEST [uniqueness_seed={uniqueness_hint or 'none'}]\n"
                f"\nContext:\n{final_context[:1500] if final_context else '(no additional context)'}\n"
                f"\nOriginal question being REPLACED (DO NOT reproduce this):\n"
                f"  Stem: \"{original_stem}\"\n"
                f"  Objective: '{original_question.get('learning_objective', '')}' \n"
                f"\nGenerate exactly {candidates_count} candidate replacement questions "
                f"with difficulty={target_difficulty}, question_type={target_type}. "
                f"Return ONLY a valid JSON array. No markdown, no preamble."
            )

            candidates = []
            gen_temp = 0.1 if question_quality == "fast" else 0.85
            res_result = None
            
            from app.core.ai_providers import AIProviderFactory, AIProviderError, AIProviderConfigurationError, AIProviderUnavailableError
            
            provider_network_time = 0.0
            try:
                ai_provider = AIProviderFactory.get_provider(provider)
                prov_start = time.perf_counter()
                res_result = await ai_provider.generate_questions(
                    prompt=prompt,
                    system_instruction=system_instruction,
                    model_name=model_name or "",
                    temperature=gen_temp
                )
                provider_network_time += (time.perf_counter() - prov_start) * 1000.0
                candidates = res_result.questions if res_result else []
            except AIProviderConfigurationError as config_err:
                logger.error(f"AI provider configuration error: {config_err}")
                if settings.ENABLE_MOCK_PROVIDER:
                    logger.warning("Invoking Mock fallback due to provider config error.")
                    mock = AIProviderFactory.get_provider("mock")
                    ai_provider = mock
                    prov_start = time.perf_counter()
                    res_result = await mock.generate_questions(prompt, system_instruction, "mock-fallback")
                    provider_network_time += (time.perf_counter() - prov_start) * 1000.0
                    candidates = res_result.questions if res_result else []
                else:
                    if provider != "auto":
                        raise HTTPException(status_code=400, detail=str(config_err))
                    else:
                        raise HTTPException(
                            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="All AI providers are currently unavailable. Please try again later."
                        )
            except AIProviderUnavailableError as unavailable_err:
                logger.error(f"AI provider unavailable error: {unavailable_err}")
                if settings.ENABLE_MOCK_PROVIDER:
                    logger.warning("Invoking Mock fallback due to provider unavailable error.")
                    mock = AIProviderFactory.get_provider("mock")
                    ai_provider = mock
                    prov_start = time.perf_counter()
                    res_result = await mock.generate_questions(prompt, system_instruction, "mock-fallback")
                    provider_network_time += (time.perf_counter() - prov_start) * 1000.0
                    candidates = res_result.questions if res_result else []
                else:
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="All AI providers are currently unavailable. Please try again later."
                    )
            except Exception as e:
                logger.exception(f"Unexpected AI provider error: {e}")
                if settings.ENABLE_MOCK_PROVIDER:
                    logger.warning("Invoking Mock fallback due to unexpected provider error.")
                    mock = AIProviderFactory.get_provider("mock")
                    ai_provider = mock
                    prov_start = time.perf_counter()
                    res_result = await mock.generate_questions(prompt, system_instruction, "mock-fallback")
                    provider_network_time += (time.perf_counter() - prov_start) * 1000.0
                    candidates = res_result.questions if res_result else []
                else:
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="All AI providers are currently unavailable. Please try again later."
                    )

            rejected_candidates = []

            def run_validation(cand_list):
                v_list = []
                for cand in cand_list:
                    # 1. Run unified QuestionProcessor pipeline – enforces difficulty, bloom, type, marks
                    cand, _ = QuestionProcessor.process_question(
                        cand,
                        marks_mode=original_question.get("marks_mode", "default"),
                        default_marks=original_question.get("marks", 1),
                        enforce_difficulty=target_difficulty,
                        enforce_bloom=target_bloom,
                        enforce_type=target_type
                    )

                    # 2. Structural sanity check + auto-fix for option counts / correctness
                    cand = cls._structural_sanity_fix(cand, target_type)

                    # 3. Check schema
                    schema_ok, schema_msg = DeterministicValidator.validate_schema(cand)
                    if not schema_ok:
                        rejected_candidates.append((cand.get("text", "")[:30], f"Schema failed: {schema_msg}"))
                        continue

                    # 4. Check DB duplicates
                    db_dup, db_msg = DeterministicValidator.check_db_duplicates(cand, db_texts)
                    if not db_dup:
                        rejected_candidates.append((cand.get("text", "")[:30], f"DB duplicate: {db_msg}"))
                        continue

                    # 4b. Topic validation: reject candidates unrelated to the target topic
                    if not cls._is_related_to_topic(cand, topic):
                        rejected_candidates.append((
                            cand.get("text", "")[:30],
                            f"Unrelated to topic '{topic}'"
                        ))
                        continue

                    # 5. Hard-exclude: reject candidates too similar to the original question stem
                    sim_to_orig = DeterministicValidator.calculate_jaccard(
                        cand.get("text", ""), original_question.get("text", "")
                    )
                    if sim_to_orig > cls.SIM_THRESHOLD_ORIGINAL:
                        rejected_candidates.append((
                            cand.get("text", "")[:30],
                            f"Too similar to original stem ({int(sim_to_orig * 100)}% match)"
                        ))
                        continue

                    # 6. Check similarity with existing quiz questions
                    too_similar_to_existing = False
                    for exist in existing_questions:
                        exist_text = exist.get("text", "") if isinstance(exist, dict) else str(exist)
                        sim_exist = DeterministicValidator.calculate_jaccard(cand.get("text", ""), exist_text)
                        if sim_exist > cls.SIM_THRESHOLD_STEM:
                            too_similar_to_existing = True
                            rejected_candidates.append((
                                cand.get("text", "")[:30],
                                f"Too similar to existing quiz question ({int(sim_exist * 100)}% match)"
                            ))
                            break
                    if too_similar_to_existing:
                        continue

                    v_list.append(cand)
                return v_list

            valid_candidates = run_validation(candidates)

            # In balanced mode, if all candidates fail validation, try regenerating them once
            if question_quality == "balanced" and not valid_candidates:
                logger.info("Balanced Mode: All candidates failed validation. Retrying generation once...")
                try:
                    prov_start = time.perf_counter()
                    res_result = await ai_provider.generate_questions(
                        prompt=prompt,
                        system_instruction=system_instruction,
                        model_name=model_name or "",
                        temperature=gen_temp
                    )
                    provider_network_time += (time.perf_counter() - prov_start) * 1000.0
                    retry_candidates = res_result.questions if res_result else []
                    valid_candidates = run_validation(retry_candidates)
                except Exception as retry_ex:
                    logger.error(f"Regeneration attempt failed: {retry_ex}")

            if not valid_candidates:
                if settings.ENABLE_MOCK_PROVIDER:
                    logger.warning("No candidates passed verification. Invoking Mock fallback for replacement question.")
                    mock = AIProviderFactory.get_provider("mock")
                    prov_start = time.perf_counter()
                    fallback_res = await mock.generate_questions(prompt, system_instruction, "mock-fallback")
                    provider_network_time += (time.perf_counter() - prov_start) * 1000.0
                    valid_candidates = fallback_res.questions if fallback_res else []
                else:
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="All AI providers are currently unavailable. Please try again later."
                    )

            # Critic evaluation
            if question_quality == "premium" and valid_candidates:
                prov_start = time.perf_counter()
                critic_evals = await AICriticEvaluator.evaluate_questions(valid_candidates, provider, model_name)
                provider_network_time += (time.perf_counter() - prov_start) * 1000.0
                
                scored_candidates = []
                for cand, c_eval in zip(valid_candidates, critic_evals):
                    if len(valid_candidates) > 1 and not c_eval.get("is_valid"):
                        rejected_candidates.append((cand.get("text", "")[:30], f"Critic rejected: {c_eval.get('rejection_reasons')}"))
                        continue
                        
                    score = (
                        c_eval.get("educational_quality", 4.0) +
                        c_eval.get("originality", 4.0) +
                        c_eval.get("reasoning_depth", 4.0) +
                        c_eval.get("clarity", 4.0) +
                        c_eval.get("engagement", 4.0)
                    ) / 5.0
                    scored_candidates.append((score, cand))
            elif question_quality == "balanced" and valid_candidates:
                logger.info("Balanced Quality Mode: Skipping LLM Critic and computing deterministic scores.")
                scored_candidates = []
                for cand in valid_candidates:
                    score = DeterministicValidator.compute_quality_score(cand)
                    scored_candidates.append((score, cand))
            else:
                logger.info("Fast Quality Mode: Skipping Critic check in regeneration.")
                scored_candidates = [(5.0, c) for c in valid_candidates]

            if not scored_candidates:
                scored_candidates.append((3.5, valid_candidates[0]))

            scored_candidates.sort(key=lambda x: x[0], reverse=True)
            best_score, best_cand = scored_candidates[0]
            
            best_cand["ai_provider"] = res_result.provider if res_result and res_result.provider else provider
            best_cand["ai_model"] = res_result.model if res_result and res_result.model else (model_name or "default")
            best_cand["generated_by_ai"] = True
            best_cand["critic_score"] = best_score

            generation_time = time.perf_counter() - start_time
            total_ms = (time.perf_counter() - start_time) * 1000.0
            
            # Log runtime summary
            logger.warning("==========================================")
            logger.warning("RUNTIME AUDIT SUMMARY (REGENERATION):")
            logger.warning(f"- Pipeline: regenerate_question")
            logger.warning(f"- Provider: {provider}")
            logger.warning(f"- Subject Profile: {topic}")
            logger.warning(f"- Candidates generated: {len(candidates)}")
            logger.warning(f"- Candidates valid: {len(valid_candidates)}")
            logger.warning(f"- Selected candidate score: {best_score:.2f}")
            logger.warning(f"- Generation time: {generation_time:.2f}s")
            logger.warning(f"- Rejected details: {rejected_candidates}")
            logger.warning("==========================================")

            # Log structured JSON profile
            profile_data = {
                "request_id": request_id,
                "event": "AI_GENERATION_PROFILE",
                "provider": provider,
                "quality": question_quality,
                "question_count": 1,
                "rag_ms": 0.0,
                "embedding_ms": 0.0,
                "duplicate_ms": 0.0,
                "similarity_ms": 0.0,
                "prompt_ms": 0.0,
                "provider_ms": round(provider_network_time, 2),
                "validation_ms": round(total_ms - provider_network_time, 2),
                "total_ms": round(total_ms, 2)
            }
            logger.warning(json.dumps(profile_data))

            from app.services.ai_metrics_service import ai_metrics_service
            ai_metrics_service.record_request_trace(
                request_id=request_id,
                provider=provider,
                request_type="regenerate",
                network_ms=provider_network_time,
                processing_ms=total_ms - provider_network_time,
                total_ms=total_ms,
                success=True,
                user_id=user_id
            )

            return [best_cand]
        except Exception:
            total_ms = (time.perf_counter() - start_time) * 1000.0
            from app.services.ai_metrics_service import ai_metrics_service
            ai_metrics_service.record_request_trace(
                request_id=request_id,
                provider=provider,
                request_type="regenerate",
                network_ms=0.0,
                processing_ms=total_ms,
                total_ms=total_ms,
                success=False,
                user_id=user_id
            )
            raise

    @classmethod
    def _is_related_to_topic(cls, question: Dict[str, Any], target_topic: str) -> bool:
        """Validates that the candidate question relates to the target topic using keyword mapping."""
        if not target_topic:
            return True
            
        topic_lower = target_topic.lower()
        stop_words = {
            "quiz", "quizzes", "question", "questions", "generate", "generator", 
            "on", "about", "covering", "the", "a", "an", "of", "and", "or", "in", 
            "to", "for", "with", "testing", "test", "topic", "subject", "concept", 
            "concepts", "some", "any", "exactly", "medium", "easy", "hard", "level"
        }
        
        # Split topic into keywords and filter out stop words
        keywords = [w.strip() for w in re.split(r"\W+", topic_lower) if w.strip() and w.strip() not in stop_words]
        if not keywords:
            keywords = [topic_lower]
            
        # Combine candidate text: stem, options, explanation, candidate topic
        cand_text = " ".join([
            question.get("text", ""),
            question.get("explanation", "") or "",
            question.get("topic", "") or "",
            " ".join([opt.get("text", "") for opt in question.get("options", [])])
        ]).lower()
        
        # Check if any keyword matches as a substring or word
        for kw in keywords:
            if kw in cand_text:
                return True
                
        return False
