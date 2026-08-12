# QuizVerse AI – AI Question Quality Report

This report records quality auditing, taxonomic alignment, and correctness checks performed on questions generated or repaired in the pipeline.

---

## 1. Taxonomic Alignment & Recovery Auditing

The pipeline coordinator automatically repairs questions lacking metadata keys. The following results illustrate repair success on missing parameters:

| Verb Under Test | Inferred Bloom Level | Inferred Difficulty | Correct Marks | Topic Tag | Explanation Format Rebuilt | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Evaluate verb mapping | Repaired | Repaired | Repaired | Repaired | YES | **PASS** |
| Create verb mapping | Repaired | Repaired | Repaired | Repaired | YES | **PASS** |
| Apply verb mapping | Repaired | Repaired | Repaired | Repaired | YES | **PASS** |

---

## 2. Correctness & Formatting Rules Compliance

- **Answer Option Completeness Check**: **PASS** (repaired questions enforce exactly 4 options for MCQ/MSQ, 2 for True/False).
- **Distractor Plausibility Check**: **PASS** (distractor formatting cleaned, balanced length, Smart quotes standard replaced).
- **Rich Explanation Header Audit**: **PASS** (Core Concept, Incorrect Option Analysis, and Learner Takeaway sections present).
- **Duplicate Stem Detection**: **PASS** (Jaccard similarity threshold set to `0.35` for stems and `0.40` for learning objectives).
