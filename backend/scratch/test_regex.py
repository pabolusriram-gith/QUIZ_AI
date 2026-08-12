import re

prompt = "Generate exactly 9 questions based on this exact blueprint:\n- Slot 0: Difficulty=easy, Bloom Level=Understand, Type=multiple_choice, Target Objective='Core principles and definitions of test'\n- Slot 1: Difficulty=easy, Bloom Level=Apply, Type=multiple_choice, Target Objective='Conceptual mechanisms and properties of test'\n"

# The regex used in MockProvider:
blueprint_matches = re.findall(r"- Slot (\d+):\s*Difficulty=(\w+),\s*Bloom Level=(\w+),\s*Type=(\w+),\s*Target Objective='(.*)'", prompt)
print(f"Matches: {blueprint_matches}")
