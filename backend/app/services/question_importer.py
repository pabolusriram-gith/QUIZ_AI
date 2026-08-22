import csv
import io
import json
import logging
import re
from typing import List, Dict, Any, Tuple, Optional
from app.services.question_processor import QuestionProcessor

logger = logging.getLogger(__name__)

VALID_QUESTION_TYPES = {
    "multiple_choice",
    "multiple_select",
    "true_false",
    "fill_in_the_blank",
    "short_answer",
}

VALID_DIFFICULTIES = {"easy", "medium", "hard"}
VALID_BLOOM_LEVELS = {"remember", "understand", "apply", "analyze", "evaluate", "create"}


class QuestionImporter:
    """
    Service for parsing, validating, and structuring bulk question imports
    from CSV and JSON files into QuizVerse schema formats.
    """

    @classmethod
    def get_sample_csv(cls) -> str:
        """Returns a standard CSV template for question bank import."""
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "question_text",
            "question_type",
            "option_a",
            "option_b",
            "option_c",
            "option_d",
            "correct_answer",
            "marks",
            "negative_marks",
            "difficulty",
            "topic",
            "subtopic",
            "explanation",
            "hint",
            "bloom_level"
        ])
        writer.writerow([
            "What is the primary function of mitochondria in eukaryotic cells?",
            "multiple_choice",
            "ATP production through cellular respiration",
            "Protein synthesis",
            "DNA replication",
            "Lipid degradation",
            "A",
            "1",
            "0.25",
            "medium",
            "Cell Biology",
            "Organelles",
            "Mitochondria are known as the powerhouses of the cell because they generate most of the chemical energy needed to power the cell's biochemical reactions.",
            "Think about cellular energy currency (ATP).",
            "understand"
        ])
        writer.writerow([
            "Which of the following are primary colors of light in the additive color model? (Select all that apply)",
            "multiple_select",
            "Red",
            "Green",
            "Blue",
            "Yellow",
            "A, B, C",
            "2",
            "0",
            "easy",
            "Physics",
            "Optics",
            "In additive color mixing (RGB), Red, Green, and Blue are the primary components.",
            "RGB model.",
            "remember"
        ])
        writer.writerow([
            "Python strings are immutable data types.",
            "true_false",
            "True",
            "False",
            "",
            "",
            "True",
            "1",
            "0",
            "easy",
            "Computer Science",
            "Python",
            "In Python, once a string object is created, its contents cannot be modified in-place.",
            "Can you do s[0] = 'a' in Python?",
            "remember"
        ])
        writer.writerow([
            "What keyword is used to define a function in Python?",
            "short_answer",
            "",
            "",
            "",
            "",
            "def",
            "1",
            "0",
            "easy",
            "Computer Science",
            "Syntax",
            "The 'def' keyword initiates a function header in Python.",
            "Starts with 'd' and is 3 letters.",
            "remember"
        ])
        return output.getvalue()

    @classmethod
    def get_sample_json(cls) -> List[Dict[str, Any]]:
        """Returns standard JSON template structure for question bank import."""
        return [
            {
                "text": "What is the primary function of mitochondria in eukaryotic cells?",
                "question_type": "multiple_choice",
                "difficulty": "medium",
                "topic": "Cell Biology",
                "subtopic": "Organelles",
                "marks": 1,
                "negative_marks": 0.25,
                "bloom_level": "understand",
                "explanation": "Mitochondria generate most of the cell's supply of ATP.",
                "hint": "Think about ATP production.",
                "options": [
                    {"text": "ATP production through cellular respiration", "is_correct": True, "display_order": 0},
                    {"text": "Protein synthesis", "is_correct": False, "display_order": 1},
                    {"text": "DNA replication", "is_correct": False, "display_order": 2},
                    {"text": "Lipid degradation", "is_correct": False, "display_order": 3}
                ]
            },
            {
                "text": "Python strings are immutable data types.",
                "question_type": "true_false",
                "difficulty": "easy",
                "topic": "Computer Science",
                "subtopic": "Python",
                "marks": 1,
                "negative_marks": 0.0,
                "bloom_level": "remember",
                "explanation": "In Python, strings cannot be mutated after creation.",
                "hint": "Can you change characters in-place?",
                "options": [
                    {"text": "True", "is_correct": True, "display_order": 0},
                    {"text": "False", "is_correct": False, "display_order": 1}
                ]
            },
            {
                "text": "Which of the following are primary colors of light in the additive model?",
                "question_type": "multiple_select",
                "difficulty": "easy",
                "topic": "Physics",
                "subtopic": "Optics",
                "marks": 2,
                "negative_marks": 0.0,
                "bloom_level": "remember",
                "explanation": "Red, Green, and Blue are additive primaries.",
                "hint": "RGB model.",
                "options": [
                    {"text": "Red", "is_correct": True, "display_order": 0},
                    {"text": "Green", "is_correct": True, "display_order": 1},
                    {"text": "Blue", "is_correct": True, "display_order": 2},
                    {"text": "Yellow", "is_correct": False, "display_order": 3}
                ]
            }
        ]

    @classmethod
    def parse_csv(cls, file_bytes: bytes) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Parses CSV data into a list of validated question dicts and list of errors.
        Returns (valid_questions, errors).
        """
        valid_questions: List[Dict[str, Any]] = []
        errors: List[Dict[str, Any]] = []

        try:
            # Decode bytes with fallback encoding
            text_data = ""
            for encoding in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
                try:
                    text_data = file_bytes.decode(encoding)
                    break
                except UnicodeDecodeError:
                    continue

            if not text_data.strip():
                return [], [{"row": 0, "error": "The uploaded CSV file is empty."}]

            reader = csv.DictReader(io.StringIO(text_data))
            if not reader.fieldnames:
                return [], [{"row": 0, "error": "CSV header row is missing or unreadable."}]

            # Normalize header lookup map (lowercase, stripped, remove underscores/spaces)
            header_map = {}
            for col in reader.fieldnames:
                if col:
                    clean_col = col.strip().lower().replace("_", "").replace(" ", "").replace("-", "")
                    header_map[clean_col] = col

            for idx, row in enumerate(reader, start=2):  # Row 1 is header
                try:
                    parsed_q = cls._parse_csv_row(row, header_map, idx)
                    valid_questions.append(parsed_q)
                except ValueError as ve:
                    errors.append({"row": idx, "error": str(ve)})
                except Exception as ex:
                    errors.append({"row": idx, "error": f"Unexpected parsing error: {str(ex)}"})

        except Exception as e:
            errors.append({"row": 0, "error": f"Failed to read CSV structure: {str(e)}"})

        return valid_questions, errors

    @classmethod
    def _get_val(cls, row: Dict[str, str], header_map: Dict[str, str], keys: List[str]) -> str:
        for k in keys:
            clean_k = k.lower().replace("_", "").replace(" ", "").replace("-", "")
            if clean_k in header_map:
                actual_col = header_map[clean_k]
                val = row.get(actual_col, "")
                if val is not None:
                    return str(val).strip()
        return ""

    @classmethod
    def _parse_csv_row(cls, row: Dict[str, str], header_map: Dict[str, str], row_num: int) -> Dict[str, Any]:
        text = cls._get_val(row, header_map, ["question_text", "question", "text", "stem", "prompt"])
        if not text:
            raise ValueError("Question text is empty.")

        q_type = cls._get_val(row, header_map, ["question_type", "type", "qtype"]).lower()
        if not q_type:
            q_type = "multiple_choice"
        elif q_type in {"mcq", "single_choice", "multiple choice"}:
            q_type = "multiple_choice"
        elif q_type in {"msq", "multi_select", "multiple select"}:
            q_type = "multiple_select"
        elif q_type in {"tf", "true_false", "true/false", "boolean"}:
            q_type = "true_false"
        elif q_type in {"fib", "fill_in_the_blank", "fill in the blank", "blank"}:
            q_type = "fill_in_the_blank"
        elif q_type in {"sa", "short_answer", "short answer", "text"}:
            q_type = "short_answer"

        if q_type not in VALID_QUESTION_TYPES:
            raise ValueError(f"Invalid question type '{q_type}'. Allowed types: {', '.join(sorted(VALID_QUESTION_TYPES))}")

        # Difficulty
        diff = cls._get_val(row, header_map, ["difficulty", "level"]).lower()
        if not diff or diff not in VALID_DIFFICULTIES:
            diff = "medium"

        # Topic & Subtopic
        topic = cls._get_val(row, header_map, ["topic", "subject", "category"]) or "General"
        subtopic = cls._get_val(row, header_map, ["subtopic", "tag"]) or None

        # Marks
        marks_str = cls._get_val(row, header_map, ["marks", "points", "score"])
        try:
            marks = max(1, int(float(marks_str))) if marks_str else 1
        except (ValueError, TypeError):
            marks = 1

        # Negative Marks
        neg_str = cls._get_val(row, header_map, ["negative_marks", "neg_marks", "penalty"])
        try:
            neg_marks = max(0.0, float(neg_str)) if neg_str else 0.0
        except (ValueError, TypeError):
            neg_marks = 0.0

        # Explanation & Hint
        explanation = cls._get_val(row, header_map, ["explanation", "rationale", "solution"]) or None
        hint = cls._get_val(row, header_map, ["hint", "clue"]) or None

        # Bloom level
        bloom = cls._get_val(row, header_map, ["bloom_level", "bloom", "taxonomy"]).lower() or None
        if bloom and bloom not in VALID_BLOOM_LEVELS:
            bloom = None

        # Correct answer indicator string
        correct_raw = cls._get_val(row, header_map, ["correct_answer", "correct", "answer", "ans", "solution"])

        options: List[Dict[str, Any]] = []

        if q_type in {"multiple_choice", "multiple_select"}:
            opt_a = cls._get_val(row, header_map, ["option_a", "option 1", "opt_a", "choice_a", "a"])
            opt_b = cls._get_val(row, header_map, ["option_b", "option 2", "opt_b", "choice_b", "b"])
            opt_c = cls._get_val(row, header_map, ["option_c", "option 3", "opt_c", "choice_c", "c"])
            opt_d = cls._get_val(row, header_map, ["option_d", "option 4", "opt_d", "choice_d", "d"])
            opt_e = cls._get_val(row, header_map, ["option_e", "option 5", "opt_e", "choice_e", "e"])

            raw_opts = [o for o in [opt_a, opt_b, opt_c, opt_d, opt_e] if o]
            if len(raw_opts) < 2:
                raise ValueError(f"At least 2 choices required for {q_type}. Found {len(raw_opts)}.")

            if not correct_raw:
                raise ValueError("Missing correct answer specification (e.g. 'A' or '1' or choice text).")

            # Parse which options are correct
            correct_tokens = set(re.split(r"[,;/|\s]+", correct_raw.strip().upper()))
            letter_keys = ["A", "B", "C", "D", "E"]

            for i, opt_text in enumerate(raw_opts):
                letter = letter_keys[i] if i < len(letter_keys) else ""
                idx_str = str(i + 1)
                is_corr = (
                    letter in correct_tokens
                    or idx_str in correct_tokens
                    or opt_text.strip().lower() == correct_raw.strip().lower()
                )
                options.append({
                    "text": opt_text,
                    "is_correct": is_corr,
                    "display_order": i
                })

            if not any(o["is_correct"] for o in options):
                raise ValueError(f"Correct answer '{correct_raw}' did not match any of the provided choices.")

            if q_type == "multiple_choice":
                # Ensure exactly 1 correct answer
                correct_count = sum(1 for o in options if o["is_correct"])
                if correct_count > 1:
                    # Pick only the first if MCQ
                    first_found = False
                    for o in options:
                        if o["is_correct"] and not first_found:
                            first_found = True
                        else:
                            o["is_correct"] = False

        elif q_type == "true_false":
            is_true_correct = correct_raw.strip().lower() in {"true", "t", "1", "yes", "correct", "a"}
            options = [
                {"text": "True", "is_correct": is_true_correct, "display_order": 0},
                {"text": "False", "is_correct": not is_true_correct, "display_order": 1}
            ]

        elif q_type in {"fill_in_the_blank", "short_answer"}:
            if correct_raw:
                options = [{
                    "text": correct_raw.strip(),
                    "is_correct": True,
                    "display_order": 0
                }]

        question_dict = {
            "text": text,
            "question_type": q_type,
            "difficulty": diff,
            "topic": topic,
            "subtopic": subtopic,
            "marks": marks,
            "negative_marks": neg_marks,
            "explanation": explanation,
            "hint": hint,
            "bloom_level": bloom,
            "options": options,
            "ai_generated": False,
            "generated_by_ai": False,
        }

        # Normalize through QuestionProcessor
        processed_q, _ = QuestionProcessor.process_question(
            question_dict,
            marks_mode="custom",
            default_marks=marks
        )

        return processed_q

    @classmethod
    def parse_json(cls, file_bytes: bytes) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Parses JSON array of questions into a list of validated question dicts and list of errors.
        Returns (valid_questions, errors).
        """
        valid_questions: List[Dict[str, Any]] = []
        errors: List[Dict[str, Any]] = []

        try:
            text_data = file_bytes.decode("utf-8")
            data = json.loads(text_data)

            if isinstance(data, dict):
                # Check if it has a 'questions' or 'items' list
                if "questions" in data and isinstance(data["questions"], list):
                    data = data["questions"]
                elif "items" in data and isinstance(data["items"], list):
                    data = data["items"]
                else:
                    data = [data]

            if not isinstance(data, list):
                return [], [{"row": 0, "error": "JSON payload must be an array of question objects."}]

            for idx, item in enumerate(data, start=1):
                if not isinstance(item, dict):
                    errors.append({"row": idx, "error": f"Item {idx} is not a valid question object dictionary."})
                    continue

                try:
                    parsed_q = cls._parse_json_item(item, idx)
                    valid_questions.append(parsed_q)
                except ValueError as ve:
                    errors.append({"row": idx, "error": str(ve)})
                except Exception as ex:
                    errors.append({"row": idx, "error": f"Unexpected error at item {idx}: {str(ex)}"})

        except json.JSONDecodeError as jde:
            errors.append({"row": 0, "error": f"Invalid JSON syntax: {jde.msg} (line {jde.lineno}, col {jde.colno})"})
        except Exception as e:
            errors.append({"row": 0, "error": f"Failed to parse JSON file: {str(e)}"})

        return valid_questions, errors

    @classmethod
    def _parse_json_item(cls, item: Dict[str, Any], idx: int) -> Dict[str, Any]:
        text = str(item.get("text") or item.get("question_text") or item.get("question") or "").strip()
        if not text:
            raise ValueError(f"Question item {idx} has an empty 'text' field.")

        q_type = str(item.get("question_type") or item.get("type") or "multiple_choice").strip().lower()
        if q_type not in VALID_QUESTION_TYPES:
            raise ValueError(f"Question item {idx} has invalid type '{q_type}'. Allowed types: {', '.join(sorted(VALID_QUESTION_TYPES))}")

        diff = str(item.get("difficulty") or "medium").strip().lower()
        if diff not in VALID_DIFFICULTIES:
            diff = "medium"

        topic = str(item.get("topic") or "General").strip()
        subtopic = str(item.get("subtopic")).strip() if item.get("subtopic") else None

        marks = max(1, int(item.get("marks", 1))) if isinstance(item.get("marks"), (int, float)) else 1
        neg_marks = max(0.0, float(item.get("negative_marks", 0.0))) if isinstance(item.get("negative_marks"), (int, float)) else 0.0

        explanation = str(item.get("explanation")).strip() if item.get("explanation") else None
        hint = str(item.get("hint")).strip() if item.get("hint") else None
        bloom = str(item.get("bloom_level")).strip().lower() if item.get("bloom_level") else None
        if bloom and bloom not in VALID_BLOOM_LEVELS:
            bloom = None

        raw_options = item.get("options", [])
        if not isinstance(raw_options, list):
            raw_options = []

        options: List[Dict[str, Any]] = []
        for o_idx, opt in enumerate(raw_options):
            if isinstance(opt, dict):
                opt_text = str(opt.get("text", "")).strip()
                is_correct = bool(opt.get("is_correct", False))
                order = int(opt.get("display_order", o_idx))
                if opt_text:
                    options.append({
                        "text": opt_text,
                        "is_correct": is_correct,
                        "display_order": order
                    })
            elif isinstance(opt, str) and opt.strip():
                options.append({
                    "text": opt.strip(),
                    "is_correct": False,
                    "display_order": o_idx
                })

        if q_type in {"multiple_choice", "multiple_select"} and len(options) < 2:
            raise ValueError(f"Question item {idx} requires at least 2 options for {q_type}.")

        if q_type == "multiple_choice" and not any(o["is_correct"] for o in options):
            raise ValueError(f"Question item {idx} does not have any option marked as is_correct=True.")

        if q_type == "true_false" and len(options) != 2:
            # Generate default True/False if not specified
            options = [
                {"text": "True", "is_correct": True, "display_order": 0},
                {"text": "False", "is_correct": False, "display_order": 1}
            ]

        question_dict = {
            "text": text,
            "question_type": q_type,
            "difficulty": diff,
            "topic": topic,
            "subtopic": subtopic,
            "marks": marks,
            "negative_marks": neg_marks,
            "explanation": explanation,
            "hint": hint,
            "bloom_level": bloom,
            "options": options,
            "ai_generated": False,
            "generated_by_ai": False,
        }

        processed_q, _ = QuestionProcessor.process_question(
            question_dict,
            marks_mode="custom",
            default_marks=marks
        )

        return processed_q
