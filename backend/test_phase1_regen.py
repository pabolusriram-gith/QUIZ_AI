"""
Phase 1 Reliable Regeneration Tests
=====================================
Proves that:
  1. Changing Difficulty  -> backend produces a new question with the new difficulty enforced
  2. Changing Type        -> backend produces a structurally correct question for the new type
                            (True/False: 2 opts, 1 correct | MCQ: 4 opts, 1 correct | MSQ: 4 opts, 2-3 correct)
  3. Manual Regenerate   -> two calls with different uniqueness_hint values produce different question texts

All tests call the real service layer (not HTTP), using a mock DB session.
ENABLE_MOCK_PROVIDER must be True (it is in .env).

Run with:
    cd backend
    python -m pytest test_phase1_regen.py -v
"""

import asyncio
import json
import os
import re
import sys
import pytest

# -- ensure backend package is importable --------------------------------------
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# Load real .env so DATABASE_URL etc. are set correctly
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass  # dotenv not required if env is already set

# Ensure ENABLE_MOCK_PROVIDER is on (already true in .env, but set as fallback)
os.environ.setdefault("ENABLE_MOCK_PROVIDER", "True")


# -- helpers -------------------------------------------------------------------

def _make_original_question(
    difficulty: str = "medium",
    question_type: str = "multiple_choice",
    topic: str = "Python Programming",
) -> dict:
    """Build a minimal original-question payload."""
    return {
        "text": "Which Python built-in function returns the number of items in an object?",
        "difficulty": difficulty,
        "question_type": question_type,
        "bloom_level": "Remember",
        "topic": topic,
        "learning_objective": f"Identify core functions related to {topic}",
        "marks": 1,
        "marks_mode": "default",
        "explanation": (
            "**Core Concept**: len() returns the count of items.\n"
            "**Incorrect Option Analysis**: print() does output, not counting.\n"
            "**Learner Takeaway**: Always prefer built-ins for elementary operations."
        ),
        "options": [
            {"text": "len()", "is_correct": True, "display_order": 0},
            {"text": "print()", "is_correct": False, "display_order": 1},
            {"text": "count()", "is_correct": False, "display_order": 2},
            {"text": "size()", "is_correct": False, "display_order": 3},
        ],
    }


class _MockDB:
    """Minimal async DB stub -- just enough to satisfy the service layer."""
    async def execute(self, *args, **kwargs):
        class _Result:
            def all(self):
                return []
        return _Result()


# -- import service after env is set -------------------------------------------

from app.services.ai_generator_service import PipelineCoordinator   # noqa: E402


# =============================================================================
# TEST 1 - Difficulty change regenerates with new difficulty enforced
# =============================================================================

@pytest.mark.asyncio
async def test_difficulty_change_regenerates():
    """
    Sends a Medium question with target_difficulty_override=hard.
    The returned question MUST have difficulty == 'hard'.
    """
    original = _make_original_question(difficulty="medium", question_type="multiple_choice")

    # Simulate what ai.py does: apply the override into original_question
    original["difficulty"] = "hard"          # target_difficulty_override applied
    original["uniqueness_hint"] = "test-difficulty-seed-001"

    result = await PipelineCoordinator.regenerate_question(
        db=_MockDB(),
        original_question=original,
        existing_questions=[],
        provider="mock",
        model_name=None,
        quiz_style="mixed",
        question_quality="fast",
        final_context="Topic/Context Prompt: Python Programming\n",
        request_id="test-difficulty-001",
    )

    assert result, "regenerate_question returned empty list"
    q = result[0]

    # -- Primary assertion: difficulty must match the requested override --
    assert q.get("difficulty") == "hard", (
        f"Expected difficulty='hard', got '{q.get('difficulty')}'. "
        f"Question text: {q.get('text', '')[:80]}"
    )

    # -- Secondary: must be a valid question with text --
    assert q.get("text", "").strip(), "Regenerated question has empty text"

    # -- Structural: MCQ must have 4 options, exactly 1 correct --
    options = q.get("options", [])
    assert len(options) == 4, (
        f"MCQ must have 4 options, got {len(options)}: {options}"
    )
    correct_count = sum(1 for o in options if o.get("is_correct"))
    assert correct_count == 1, (
        f"MCQ must have exactly 1 correct option, got {correct_count}"
    )

    print(f"\n[PASS] test_difficulty_change_regenerates")
    print(f"  difficulty: {q.get('difficulty')} OK")
    print(f"  text: {q.get('text', '')[:80]}...")
    print(f"  options: {len(options)} options, {correct_count} correct OK")


# =============================================================================
# TEST 2 - Question Type change regenerates with correct structure
# =============================================================================

@pytest.mark.asyncio
async def test_type_change_to_true_false_regenerates():
    """
    Sends an MCQ question with target_type_override=true_false.
    The returned question MUST:
      - have question_type == 'true_false'
      - have exactly 2 options: 'True' and 'False'
      - have exactly 1 correct option
    """
    original = _make_original_question(difficulty="medium", question_type="multiple_choice")

    # Simulate ai.py override application
    original["question_type"] = "true_false"   # target_type_override applied
    original["uniqueness_hint"] = "test-type-seed-002"

    result = await PipelineCoordinator.regenerate_question(
        db=_MockDB(),
        original_question=original,
        existing_questions=[],
        provider="mock",
        model_name=None,
        quiz_style="mixed",
        question_quality="fast",
        final_context="Topic/Context Prompt: Python Programming\n",
        request_id="test-type-002",
    )

    assert result, "regenerate_question returned empty list"
    q = result[0]

    # -- Primary: type must be true_false --
    assert q.get("question_type") == "true_false", (
        f"Expected question_type='true_false', got '{q.get('question_type')}'"
    )

    # -- Structural: exactly 2 options, texts must be True/False --
    options = q.get("options", [])
    assert len(options) == 2, (
        f"True/False must have exactly 2 options, got {len(options)}: {[o.get('text') for o in options]}"
    )

    option_texts = [o.get("text", "").strip() for o in options]
    assert "True" in option_texts and "False" in option_texts, (
        f"True/False options must be 'True' and 'False', got: {option_texts}"
    )

    correct_count = sum(1 for o in options if o.get("is_correct"))
    assert correct_count == 1, (
        f"True/False must have exactly 1 correct option, got {correct_count}"
    )

    # -- Text: must be a proper question --
    assert q.get("text", "").strip(), "Regenerated question has empty text"

    print(f"\n[PASS] test_type_change_to_true_false_regenerates")
    print(f"  question_type: {q.get('question_type')} OK")
    print(f"  options: {option_texts} OK")
    print(f"  correct_count: {correct_count} OK")
    print(f"  text: {q.get('text', '')[:80]}...")


# =============================================================================
# TEST 3 - Manual Regenerate produces a genuinely different question
# =============================================================================

@pytest.mark.asyncio
async def test_manual_regenerate_produces_different_question():
    """
    Calls regenerate_question twice for the same original question, each time
    with a distinct uniqueness_hint. The two results MUST differ from the original
    (sim <= 0.30 to original) and be different from each other (Jaccard < 0.80).
    """

    def jaccard(s1: str, s2: str) -> float:
        w1 = set(re.findall(r"\b\w+\b", s1.lower()))
        w2 = set(re.findall(r"\b\w+\b", s2.lower()))
        if not w1 or not w2:
            return 0.0
        return len(w1 & w2) / len(w1 | w2)

    original_a = _make_original_question(difficulty="medium", question_type="multiple_choice")
    original_a["uniqueness_hint"] = "test-novelty-seed-ALPHA-111"

    original_b = _make_original_question(difficulty="medium", question_type="multiple_choice")
    original_b["uniqueness_hint"] = "test-novelty-seed-BETA-999"

    result_a = await PipelineCoordinator.regenerate_question(
        db=_MockDB(),
        original_question=original_a,
        existing_questions=[],
        provider="mock",
        model_name=None,
        quiz_style="mixed",
        question_quality="fast",
        final_context="Topic/Context Prompt: Python Programming\n",
        request_id="test-novelty-a",
    )

    text_a = result_a[0].get("text", "") if result_a else ""

    # Second call: treat the first result as "existing" so the backend also avoids it
    result_b = await PipelineCoordinator.regenerate_question(
        db=_MockDB(),
        original_question=original_b,
        existing_questions=[{"text": text_a, "question_type": "multiple_choice"}],
        provider="mock",
        model_name=None,
        quiz_style="mixed",
        question_quality="fast",
        final_context="Topic/Context Prompt: Python Programming\n",
        request_id="test-novelty-b",
    )

    assert result_a, "First call returned empty list"
    assert result_b, "Second call returned empty list"

    text_b = result_b[0].get("text", "")

    # -- Both must be non-empty --
    assert text_a.strip(), "First regenerated question has empty text"
    assert text_b.strip(), "Second regenerated question has empty text"

    # -- They must not be the same as the ORIGINAL question --
    original_text = _make_original_question()["text"]
    sim_a_orig = jaccard(text_a, original_text)
    sim_b_orig = jaccard(text_b, original_text)
    assert sim_a_orig <= 0.30, (
        f"First result is too similar to original ({sim_a_orig:.2%}): '{text_a[:80]}'"
    )
    assert sim_b_orig <= 0.30, (
        f"Second result is too similar to original ({sim_b_orig:.2%}): '{text_b[:80]}'"
    )

    # -- The two results must also differ from each other --
    sim_ab = jaccard(text_a, text_b)
    assert sim_ab < 0.80, (
        f"Two regeneration calls produced too-similar questions ({sim_ab:.2%}).\n"
        f"  Call 1: '{text_a[:80]}'\n"
        f"  Call 2: '{text_b[:80]}'"
    )

    print(f"\n[PASS] test_manual_regenerate_produces_different_question")
    print(f"  Result A: {text_a[:80]}...")
    print(f"  Result B: {text_b[:80]}...")
    print(f"  Jaccard A<->B: {sim_ab:.2%} (< 0.80) OK")
    print(f"  Sim A<->original: {sim_a_orig:.2%} (<= 0.30) OK")
    print(f"  Sim B<->original: {sim_b_orig:.2%} (<= 0.30) OK")


# =============================================================================
# TEST 4 - Question Count checks (5, 10, 20)
# =============================================================================

@pytest.mark.asyncio
async def test_question_count_generation():
    """
    Test that requesting 5, 10, or 20 questions correctly returns exactly that amount of questions.
    """
    for count in [5, 10, 20]:
        questions = await PipelineCoordinator.generate_quiz(
            db=_MockDB(),
            question_count=count,
            difficulty="medium",
            language="en",
            bloom_levels=["Understand"],
            question_types=["multiple_choice"],
            topic="Python Programming",
            course_outcomes=[],
            question_distribution=None,
            question_quality="fast",
            quiz_style="mixed",
            custom_prompt=None,
            provider="mock",
            model_name=None,
            request_id=f"test-count-{count}",
            document_names=None,
            total_extracted_text=""
        )
        assert len(questions) == count, f"Requested {count} questions, but got {len(questions)}"
        print(f"\n[PASS] test_question_count_generation for count={count}: got {len(questions)} questions.")


# =============================================================================
# TEST 5 - Topic Contamination Checks (HTML, CSS, JavaScript)
# =============================================================================

@pytest.mark.asyncio
async def test_regeneration_topic_contamination():
    """
    Verifies that regenerating a question preserves original quiz topic (HTML, CSS, JS)
    and that validation successfully identifies and filters unrelated questions.
    """
    for test_topic in ["HTML", "CSS", "JavaScript"]:
        original = _make_original_question(difficulty="medium", question_type="multiple_choice", topic=test_topic)
        
        # Test regeneration returns question matching test_topic
        result = await PipelineCoordinator.regenerate_question(
            db=_MockDB(),
            original_question=original,
            existing_questions=[],
            provider="mock",
            model_name=None,
            quiz_style="mixed",
            question_quality="fast",
            final_context=f"Topic/Context Prompt: {test_topic}\n",
            request_id=f"test-topic-{test_topic.lower()}",
        )
        
        assert result, f"Regenerate returned empty result for topic {test_topic}"
        q = result[0]
        
        # Validate that the generated question topic preserves the target topic
        assert q.get("topic") == test_topic, f"Expected topic '{test_topic}', got '{q.get('topic')}'"
        
        # Validate keyword relatedness helper
        is_related = PipelineCoordinator._is_related_to_topic(q, test_topic)
        assert is_related is True, f"Question should be related to its target topic '{test_topic}'"
        
        # Validate that checking against a completely different topic fails
        wrong_topic = "CSS" if test_topic == "HTML" else "HTML"
        is_related_wrong = PipelineCoordinator._is_related_to_topic(q, wrong_topic)
        assert is_related_wrong is False, f"Question about '{test_topic}' should not match unrelated topic '{wrong_topic}'"
        
        print(f"\n[PASS] test_regeneration_topic_contamination for topic={test_topic}")

