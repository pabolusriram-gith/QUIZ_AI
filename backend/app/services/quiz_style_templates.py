# Dedicated Quiz Style Prompt Templates for QuizVerse AI
from typing import Dict, Any

class QuizStyleTemplateManager:
    TEMPLATES = {
        "mixed": {
            "name": "Mixed (Standard)",
            "persona": "A versatile, balanced general educator testing both core theoretical concepts and direct applications.",
            "tone": "Clear, professional, neutral, and academically direct.",
            "question_format": "A balanced distribution of straight context questions, conceptual analysis, and simple code snippets (if technical).",
            "difficulty_rules": "Direct scaling. Easy questions assess recall, medium questions assess application, and hard questions assess synthesis and design.",
            "reasoning_rules": "Tests both general recall and logical application in a balanced manner.",
            "example": """{
  "text": "A software team needs to select a collection data structure. The requirements dictate that elements must maintain their insertion order, and elements must be lookup-able by key in O(1) average time complexity. Which data structure should they implement?",
  "options": [
    {"text": "LinkedHashMap", "is_correct": true, "display_order": 0},
    {"text": "ArrayList", "is_correct": false, "display_order": 1},
    {"text": "HashSet", "is_correct": false, "display_order": 2},
    {"text": "LinkedList", "is_correct": false, "display_order": 3}
  ]
}"""
        },
        "exam": {
            "name": "Exam Mode",
            "persona": "A formal university registrar and senior academic examiner representing an official board of examiners.",
            "tone": "Highly academic, precise, strict, objective, and formal. Free from conversational preamble.",
            "question_format": "Structured formal assessments. Avoid scenario assumptions unless specified in the text. Questions must use precise terminology and standard academic classification.",
            "difficulty_rules": "Rigorous grading. Easy tests clear definitions. Medium tests logical deduction of academic laws/theorems. Hard tests deep synthesis of multiple theories.",
            "reasoning_rules": "Evaluates exact comprehension of concepts, theoretical boundaries, logic rules, and structural reasoning.",
            "example": """{
  "text": "Which of the following assertions correctly identifies the primary distinction between relational database systems and non-relational database systems with respect to the transaction execution model?",
  "options": [
    {"text": "Relational database systems natively enforce strict ACID guarantees at the storage engine level, whereas non-relational database systems often implement eventual consistency to achieve partition tolerance.", "is_correct": true, "display_order": 0},
    {"text": "Non-relational database systems natively enforce strict ACID guarantees, whereas relational database systems are constrained to eventual consistency.", "is_correct": false, "display_order": 1},
    {"text": "Both relational and non-relational database systems implement identical transaction models, differing only in storage schema representations.", "is_correct": false, "display_order": 2},
    {"text": "ACID transactional compliance is determined solely by the operating system file system rather than the database type.", "is_correct": false, "display_order": 3}
  ]
}"""
        },
        "interview": {
            "name": "Interview Mode",
            "persona": "A pragmatic Tech Lead or Engineering Director interviewing senior candidates for a high-performance system engineering team.",
            "tone": "Action-oriented, practical, conversational, code-heavy, and focused on systems design trade-offs.",
            "question_format": "Questions must be framed around practical debugging, code optimization, system load failures, index optimizations, or API bottlenecks.",
            "difficulty_rules": "Tests practical troubleshooting and operational wisdom. Easy tests syntax/concept usage. Medium tests optimization of O(N^2) algorithms. Hard tests distributed systems bottleneck mitigation under load.",
            "reasoning_rules": "Demands performance evaluation, trade-off analysis, runtime complexity tracing, and concrete troubleshooting logic.",
            "example": """{
  "text": "During a performance review, you observe that a user profile service makes a separate SQL query for each follower in a list of size N (the N+1 query problem). Which of the following strategies is the most effective approach to mitigate this issue?",
  "options": [
    {"text": "Configure eager loading or prefetching to fetch the user profiles and their corresponding followers in a single database round-trip.", "is_correct": true, "display_order": 0},
    {"text": "Increase the database server connection pool limits to handle the concurrent queries in parallel threads.", "is_correct": false, "display_order": 1},
    {"text": "Move the user database query code into a client-side JavaScript callback loop.", "is_correct": false, "display_order": 2},
    {"text": "De-normalize the user follower database and store the full profile records in local volatile memory.", "is_correct": false, "display_order": 3}
  ]
}"""
        },
        "competitive": {
            "name": "Competitive Exam (UPSC/GATE)",
            "persona": "A member of a national assessment committee designing filter-level examination papers for top competitive candidates.",
            "tone": "Extremely dense, challenging, precise, multi-layered, and analytically rigorous.",
            "question_format": "Multi-statement assertions (e.g. evaluating I, II, and III statements), logic grids, mathematical/derivation calculations, or deep architectural properties.",
            "difficulty_rules": "Elite standard. Designed to differentiate the top 1% of candidates. Distractors must represent complex logical errors, sign mistakes, or common misconceptions.",
            "reasoning_rules": "Requires multi-stage logic, constraint integration, mathematical calculation, or deep conceptual validation.",
            "example": """{
  "text": "Consider the following assertions regarding memory management schemes:\nI. Translation Lookaside Buffer (TLB) misses must always lead to a page fault exception.\nII. Increasing physical frame count can occasionally yield higher page fault counts under FIFO replacement (Belady's Anomaly).\nIII. Swapping out dirty pages requires writing to disk, whereas clean pages can be discarded immediately.\nWhich of the assertions is/are CORRECT?",
  "options": [
    {"text": "II and III only", "is_correct": true, "display_order": 0},
    {"text": "I and II only", "is_correct": false, "display_order": 1},
    {"text": "I and III only", "is_correct": false, "display_order": 2},
    {"text": "I, II, and III", "is_correct": false, "display_order": 3}
  ]
}"""
        },
        "college": {
            "name": "College Test",
            "persona": "An academic university professor compiling midterm/final assessments for students studying a core curriculum course.",
            "tone": "Instructive, pedagogical, structured, clear, and classroom-focused.",
            "question_format": "Verifies comprehension of core algorithms, classic textbook examples, equations, and lecture concepts.",
            "difficulty_rules": "Medium standard. Matches typical undergraduate/graduate lecture assignments. Evaluates comprehension, applying standard formulas, and simple analytical steps.",
            "reasoning_rules": "Tests ability to map lecture definitions to standard problem-solving scenarios.",
            "example": """{
  "text": "Under the SOLID design principles, which design principle states that code modules should be open for extension but closed for modification?",
  "options": [
    {"text": "Open-Closed Principle (OCP)", "is_correct": true, "display_order": 0},
    {"text": "Single Responsibility Principle (SRP)", "is_correct": false, "display_order": 1},
    {"text": "Liskov Substitution Principle (LSP)", "is_correct": false, "display_order": 2},
    {"text": "Dependency Inversion Principle (DIP)", "is_correct": false, "display_order": 3}
  ]
}"""
        },
        "scenario": {
            "name": "Scenario Based",
            "persona": "An external solutions consultant analyzing system architecture failures and technical problem cases.",
            "tone": "Situational, pragmatic, contextual, direct, and risk-oriented.",
            "question_format": "Every question starts by establishing a real-world scenario (e.g. 'You are deployed to a project...'). Options represent actions to solve the scenario.",
            "difficulty_rules": "Evaluates logical troubleshooting, selecting correct recovery strategies, and balancing trade-offs under constraints.",
            "reasoning_rules": "Requires diagnostic analysis of the scenario variables to select the optimal resolution path.",
            "example": """{
  "text": "You are migrating a legacy payment system to a microservices architecture. Due to transient network errors, your system occasionally delivers the same payment event twice. Which architectural property must your payment consumer microservice enforce to prevent duplicate database transactions?",
  "options": [
    {"text": "Idempotence", "is_correct": true, "display_order": 0},
    {"text": "Strict linearizability", "is_correct": false, "display_order": 1},
    {"text": "Atomicity isolation", "is_correct": false, "display_order": 2},
    {"text": "Write-ahead logging", "is_correct": false, "display_order": 3}
  ]
}"""
        },
        "case_study": {
            "name": "Case Study",
            "persona": "A lead business architect or chief systems analyst assessing comprehensive corporate case reports.",
            "tone": "Narrative, analytical, long-form, complex, and strategic.",
            "question_format": "A paragraph describing a corporate project, detailing its historical context, traffic metrics, budget limits, server constraints, and objectives.",
            "difficulty_rules": "High complexity. Requires analyzing multiple details across the case narrative to synthesize the correct architectural or strategic response.",
            "reasoning_rules": "Demands checking conflicting requirements (e.g. low budget vs. high availability) to select the correct design strategy.",
            "example": """{
  "text": "Case Study: Acme Retail wants to upgrade their monolithic order processor. Peak load reaches 10,000 orders/minute. The backend relational database locks up during sales due to write conflicts. Their budget is limited, which prevents them from purchasing expensive high-tier databases. Which architecture choice solves their lockup issue cost-effectively?",
  "options": [
    {"text": "Introduce an asynchronous queue (e.g., RabbitMQ or SQS) to buffer incoming order events and persist them at a stable rate.", "is_correct": true, "display_order": 0},
    {"text": "Migrate the order database immediately to a multi-region distributed NoSQL database cluster.", "is_correct": false, "display_order": 1},
    {"text": "Deploy database read replicas and redirect order-writing transactions directly to the replication nodes.", "is_correct": false, "display_order": 2},
    {"text": "Increase the connection thread pool size of the monolithic processor by a factor of 10.", "is_correct": false, "display_order": 3}
  ]
}"""
        },
        "puzzle": {
            "name": "Puzzle",
            "persona": "A lateral-thinking riddle master and logic game builder.",
            "tone": "Intriguing, clever, riddle-like, unconventional, and mind-bending.",
            "question_format": "Questions are framed as pattern sequences, word plays, logic puzzles, or mathematical paradoxes.",
            "difficulty_rules": "Requires lateral thinking. The answer should feel intuitive once the logical shortcut is discovered, but difficult to solve by raw calculation.",
            "reasoning_rules": "Evaluates logical agility, patterns, out-of-the-box thinking, and finding hidden logic shortcuts.",
            "example": """{
  "text": "A technical clock loses exactly 10 minutes every single hour. It is synchronized correctly at 12:00 PM today. The clock currently reads 5:00 PM on its display. What is the actual, correct time in the real world?",
  "options": [
    {"text": "6:00 PM", "is_correct": true, "display_order": 0},
    {"text": "5:50 PM", "is_correct": false, "display_order": 1},
    {"text": "6:10 PM", "is_correct": false, "display_order": 2},
    {"text": "5:00 PM", "is_correct": false, "display_order": 3}
  ]
}"""
        },
        "logical_reasoning": {
            "name": "Logical Reasoning",
            "persona": "A cognitive assessor specializing in formal deductive logic and analytical reasoning patterns.",
            "tone": "Purely logical, dry, structured, objective, and analytical.",
            "question_format": "Uses syllogisms, logic conditions (If/Then), sequence rules, cause-and-effect patterns, and truth table logic.",
            "difficulty_rules": "Scales based on the number of logic layers and logical negations. Distractors must represent common logical fallacies.",
            "reasoning_rules": "Tests formal deduction rules, logical consistency, identifying logical fallacies, and structural assertions.",
            "example": """{
  "text": "Given the following premises:\n1. All software engineers are analytical thinkers.\n2. Some software engineers are classical musicians.\nWhich of the following assertions logically follows from the premises?",
  "options": [
    {"text": "Some analytical thinkers are classical musicians.", "is_correct": true, "display_order": 0},
    {"text": "All analytical thinkers are classical musicians.", "is_correct": false, "display_order": 1},
    {"text": "No analytical thinkers are software engineers.", "is_correct": false, "display_order": 2},
    {"text": "Some classical musicians are not analytical thinkers.", "is_correct": false, "display_order": 3}
  ]
}"""
        }
    }

    @classmethod
    def get_style_prompt(cls, style: str) -> str:
        s = style.lower().strip()
        if s not in cls.TEMPLATES:
            s = "mixed"
        
        t = cls.TEMPLATES[s]
        
        prompt_block = f"""--- DEDICATED QUIZ STYLE SPECIFICATION: {t['name'].upper()} ---
Adopt this professional persona and style constraint strictly during generation:
1. PERSONA: {t['persona']}
2. TONE: {t['tone']}
3. QUESTION FORMAT: {t['question_format']}
4. DIFFICULTY RULES: {t['difficulty_rules']}
5. REASONING RULES: {t['reasoning_rules']}
6. STYLE-SPECIFIC QUESTION EXAMPLE:
{t['example']}
------------------------------------------------------------"""
        return prompt_block
