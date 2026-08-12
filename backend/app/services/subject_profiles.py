import os
import json
import logging
from typing import Dict, Any

logger = logging.getLogger("app.services.subject_profiles")

class SubjectProfileManager:
    DEFAULT_PROFILES = [
        {
            "name": "General Reasoning",
            "guidelines": "Present scenario-based, logical-deduction questions. Avoid simple recall or rote definitions; require multi-step reasoning, theory comparison, or troubleshooting."
        }
    ]

    @classmethod
    def get_profile(cls, topic: str) -> Dict[str, Any]:
        dir_path = os.path.dirname(os.path.abspath(__file__))
        config_path = os.path.join(dir_path, "subject_profiles.json")
        
        profiles = []
        if os.path.exists(config_path):
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    profiles = json.load(f)
            except Exception as e:
                logger.error(f"Failed to load subject_profiles.json: {e}")
                
        if not profiles:
            # Dynamic default fallback if JSON is missing or unreadable
            profiles = [
                {
                    "name": "Computer Science & Software Engineering",
                    "keywords": ["coding", "programming", "python", "javascript", "c++", "java", "html", "css", "database", "sql", "git", "api", "algorithm", "complexity", "operating systems", "dsa", "dbms"],
                    "guidelines": "Include realistic code snippets, debug traces, execution outputs, database schemas, or system architecture trade-offs. Focus questions on runtime/space complexity, correct state tracking, debugging logic, edge cases, and design patterns."
                },
                {
                    "name": "Quantitative & Applied Sciences",
                    "keywords": ["math", "physics", "chemistry", "algebra", "calculus", "statistics", "equations", "mechanics", "thermodynamics"],
                    "guidelines": "Formulate questions requiring multi-step mathematical solving, quantitative analysis, derivation steps, or physics calculations. Distractors should represent common computational errors or algebraic sign mistakes."
                }
            ]

        topic_lower = topic.lower() if topic else ""
        for prof in profiles:
            keywords = prof.get("keywords", [])
            for kw in keywords:
                if kw in topic_lower:
                    logger.info(f"Matched subject profile: {prof['name']}")
                    return {
                        "name": prof["name"],
                        "guidelines": prof["guidelines"]
                    }
                    
        logger.info("No subject profile matched. Falling back to General Reasoning.")
        return cls.DEFAULT_PROFILES[0]
