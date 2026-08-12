import re
import uuid
import hashlib
import random
import logging
from typing import Dict, Any, List, Tuple

logger = logging.getLogger(__name__)

def deterministic_cleanup_stem(text: str) -> str:
    """Strips common LLM chatbot instruction prefixes and leaks from question stems."""
    text = text.strip()
    prefixes = [
        "generate a multiple choice question about",
        "generate a multiple select question about",
        "generate a true/false question about",
        "generate a fill in the blank question about",
        "generate a short answer question about",
        "generate a question about",
        "generate an mcq about",
        "generate an mcq question about",
        "generate a question regarding",
        "generate question",
        "generate",
        "based on the provided context,",
        "based on the context,",
        "based on the provided document,",
        "based on the document,",
        "based on the provided text,",
        "based on the text,",
        "based on the prompt,",
        "based on",
        "using the provided context,",
        "using the context,",
        "using the provided text,",
        "using the text,",
        "using the prompt,",
        "using the",
        "according to the provided context,",
        "according to the context,",
        "according to the provided text,",
        "according to the text,",
        "according to the document,",
        "according to the prompt,",
        "according to",
        "you are a professional educational assessor",
        "you are",
    ]
    
    lower_text = text.lower()
    changed = True
    while changed:
        changed = False
        for prefix in prefixes:
            if lower_text.startswith(prefix):
                text = text[len(prefix):].strip()
                # Strip leading commas, colons, hyphens, or brackets
                if text.startswith(",") or text.startswith(":") or text.startswith("-") or text.startswith("]"):
                    text = text[1:].strip()
                lower_text = text.lower()
                changed = True
                break
    return text

def calculate_jaccard(s1: str, s2: str) -> float:
    """Calculates Jaccard word similarity between two string stems."""
    w1 = set(re.findall(r"\b\w+\b", s1.lower()))
    w2 = set(re.findall(r"\b\w+\b", s2.lower()))
    if not w1 or not w2:
        return 0.0
    return len(w1.intersection(w2)) / len(w1.union(w2))

class QuestionProcessor:
    """Unified Processing Pipeline for validating, repairing, shuffing, and assigning marks for all questions."""

    @classmethod
    def process_question(
        cls,
        q: Dict[str, Any],
        marks_mode: str = "default",
        default_marks: int = 1,
        enforce_difficulty: str = None,
        enforce_bloom: str = None,
        enforce_type: str = None
    ) -> Tuple[Dict[str, Any], int]:
        """
        Runs a question through the shared processing stages:
        Normalize -> Clean Prefix Leaks -> Apply Constraints -> Apply Marks -> Deterministic Shuffling -> Validation Check.
        """
        repairs_made = 0
        if not isinstance(q, dict):
            return q, 0

        # 1. Normalize
        # Ensure options is a list
        if "options" not in q or not isinstance(q["options"], list):
            q["options"] = []
            repairs_made += 1

        # Check and initialize ai_original_json for AI questions before we apply modifications
        is_ai = q.get("ai_generated") or q.get("generated_by_ai")
        if is_ai and not q.get("ai_original_json"):
            import json
            orig_data = {
                "text": q.get("text", ""),
                "difficulty": q.get("difficulty", "medium"),
                "explanation": q.get("explanation", ""),
                "question_type": q.get("question_type", "multiple_choice"),
                "bloom_level": q.get("bloom_level", "Understand"),
                "options": [{"text": opt.get("text", ""), "is_correct": opt.get("is_correct", False)} for opt in q.get("options", [])]
            }
            q["ai_original_json"] = json.dumps(orig_data)
            repairs_made += 1

        # 2. Clean prefix leaks in stems
        original_text = q.get("text", "")
        clean_text = deterministic_cleanup_stem(original_text)
        if clean_text != original_text:
            q["text"] = clean_text
            repairs_made += 1

        # 3. Apply explicit constraints (if provided)
        if enforce_difficulty and enforce_difficulty.lower() in ["easy", "medium", "hard"]:
            if q.get("difficulty") != enforce_difficulty.lower():
                q["difficulty"] = enforce_difficulty.lower()
                repairs_made += 1
                
        if enforce_bloom:
            if q.get("bloom_level") != enforce_bloom:
                q["bloom_level"] = enforce_bloom
                repairs_made += 1

        if enforce_type:
            if q.get("question_type") != enforce_type:
                q["question_type"] = enforce_type
                repairs_made += 1

        # Fallback inferences if fields missing
        difficulty = q.get("difficulty", "medium").lower()
        if difficulty not in ["easy", "medium", "hard"]:
            q["difficulty"] = "medium"
            difficulty = "medium"
            repairs_made += 1

        bloom = q.get("bloom_level", "Understand")
        if not bloom:
            q["bloom_level"] = "Understand"
            repairs_made += 1

        q_type = q.get("question_type", "multiple_choice")
        if not q_type:
            q["question_type"] = "multiple_choice"
            q_type = "multiple_choice"
            repairs_made += 1

        # 4. Repair missing explanation structure (Core Concept / Incorrect Option / Takeaway)
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
        has_core = "core concept" in exp_lower
        has_incorrect = "incorrect option" in exp_lower or "distractor" in exp_lower
        has_takeaway = "takeaway" in exp_lower
        
        if not explanation or len(explanation) < 15 or not (has_core and has_incorrect and has_takeaway):
            correct_opt = next((o.get("text", "") for o in q.get("options", []) if o.get("is_correct")), "the correct option")
            rebuilt_exp = f"**Core Concept**: This question assesses understanding of {q.get('topic') or 'the subject material'}.\n\n"
            rebuilt_exp += f"**Incorrect Option Analysis**: The other options are incorrect because they represent invalid choices or common student pitfalls.\n\n"
            rebuilt_exp += f"**Learner Takeaway**: Verify standard principles of the topic when solving."
            q["explanation"] = rebuilt_exp
            repairs_made += 1

        # 5. Apply Marks (Auto vs Default)
        expected_marks = default_marks
        if marks_mode == "auto":
            if difficulty == "easy":
                expected_marks = 1
            elif difficulty == "hard":
                expected_marks = 5
            else:  # medium
                expected_marks = 2
                
        if q.get("marks") != expected_marks:
            q["marks"] = expected_marks
            repairs_made += 1

        # 6. Deterministic Option Shuffling (only shuffle multiple_choice / multiple_select)
        options = q.get("options", [])
        if len(options) > 1 and q_type in ["multiple_choice", "multiple_select"]:
            # Copy options to avoid side-effects
            opts_copy = [dict(opt) for opt in options]
            
            # Use stable shuffle_seed generated/stored on the question
            shuffle_seed = q.get("shuffle_seed")
            if not shuffle_seed:
                shuffle_seed = random.randint(1, 2147483647)
                q["shuffle_seed"] = shuffle_seed
                repairs_made += 1
            
            seed_val = int(shuffle_seed)
            r = random.Random(seed_val)
            r.shuffle(opts_copy)
            
            # Re-index display_order
            for idx, opt in enumerate(opts_copy):
                opt["display_order"] = idx
            q["options"] = opts_copy
            repairs_made += 1

        return q, repairs_made

    @classmethod
    def check_duplicate_questions(cls, questions: List[Dict[str, Any]], threshold: float = 0.85) -> List[int]:
        """
        Scans a list of processed questions. Returns a list of indices representing duplicate questions
        that should be regenerated.
        """
        duplicate_indices = []
        for i in range(len(questions)):
            if i in duplicate_indices:
                continue
            stem_i = questions[i].get("text", "")
            for j in range(i + 1, len(questions)):
                if j in duplicate_indices:
                    continue
                stem_j = questions[j].get("text", "")
                if calculate_jaccard(stem_i, stem_j) > threshold:
                    duplicate_indices.append(j)
                    logger.warning(f"Duplicate question detected: indices ({i}, {j}) have similarity > {threshold * 100}%")
        return duplicate_indices
