import math
import re
from typing import List, Dict, Any, Optional

class DeterministicValidator:
    @staticmethod
    def calculate_jaccard(s1: str, s2: str) -> float:
        w1 = set(re.findall(r"\b\w+\b", s1.lower()))
        w2 = set(re.findall(r"\b\w+\b", s2.lower()))
        if not w1 or not w2:
            return 0.0
        return len(w1.intersection(w2)) / len(w1.union(w2))

# Mock questions list from MockProvider
topic = "Python OOP"
questions = []
for idx in range(14):
    text = ""
    options = [
        {"text": f"Implement a structured layer with optimized caching for {topic}.", "is_correct": True, "display_order": 0},
        {"text": f"Bypass all caching and run operations sequentially on the main thread.", "is_correct": False, "display_order": 1},
        {"text": f"Deploy a secondary unmonitored container with manual scaling.", "is_correct": False, "display_order": 2},
        {"text": f"Deprecate the entire abstraction and manage raw memory using pointers.", "is_correct": False, "display_order": 3}
    ]
    if idx == 0:
        text = f"Scenario: A team is implementing a system based on {topic}. They need to select the approach that guarantees optimal performance and stability. Which of the following is the best strategy?"
    elif idx == 1:
        text = f"Which architectural pattern provides the highest concurrency level when using {topic} for high-throughput messaging?"
    elif idx == 2:
        text = f"An engineer is debugging a latency issue in a {topic} service. Which configuration adjustment is most likely to resolve it?"
    elif idx == 3:
        text = f"Compare the performance overhead of synchronous calls versus asynchronous event handling in a {topic} application."
    else:
        text = f"Identify the primary advantage of deploying a {topic} solution in decentralized cloud networks."
    
    questions.append({
        "index": idx,
        "text": text,
        "options": options,
        "learning_objective": f"Explain aspect {idx + 1} of {topic}"
    })

# filter out indices 0, 5, 10
candidate_pool = [q for i, q in enumerate(questions) if i not in [0, 5, 10]]

selected_questions = []
rejected_duplicates = []

SIM_THRESHOLD_STEM = 0.35
SIM_THRESHOLD_OBJ = 0.40

for q in candidate_pool:
    too_similar = False
    for sq in selected_questions:
        sim_stem = DeterministicValidator.calculate_jaccard(q.get("text", ""), sq.get("text", ""))
        sim_obj = DeterministicValidator.calculate_jaccard(q.get("learning_objective", ""), sq.get("learning_objective", ""))
        
        q_opts = [o.get("text", "").lower().strip() for o in q.get("options", [])]
        sq_opts = [o.get("text", "").lower().strip() for o in sq.get("options", [])]
        common_opts = set(q_opts) & set(sq_opts)
        
        print(f"Comparing candidate {q['index']} with selected {sq['index']}:")
        print(f"  sim_stem: {sim_stem:.3f}")
        print(f"  sim_obj: {sim_obj:.3f}")
        print(f"  common_opts count: {len(common_opts)}")
        
        if sim_stem > SIM_THRESHOLD_STEM or sim_obj > SIM_THRESHOLD_OBJ or len(common_opts) > 1:
            too_similar = True
            print("  -> REJECTED as too similar")
            break
    
    if not too_similar:
        print(f"  -> ACCEPTED {q['index']}")
        selected_questions.append(q)
    else:
        rejected_duplicates.append(q)

print(f"\nFinal selected count: {len(selected_questions)}")
print(f"Selected indices: {[q['index'] for q in selected_questions]}")
