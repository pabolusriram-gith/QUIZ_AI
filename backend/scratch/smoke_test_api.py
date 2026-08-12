import time
import httpx
import sys

API_URL = "http://127.0.0.1:8000/api/v1"

def run_smoke_test():
    print("[*] Starting E2E HTTP API smoke test...")
    print(f"[*] Hitting backend server at: {API_URL}")
    
    timestamp = int(time.time())
    test_email = f"smoke_teacher_{timestamp}@example.com"
    test_password = "secure_test_password"
    
    with httpx.Client(timeout=30.0) as client:
        # 1. Check health
        print("[*] Checking backend health (/health)...")
        try:
            res = client.get("http://127.0.0.1:8000/health")
            print(f"    Health Status: {res.status_code}")
            assert res.status_code == 200, f"Backend is offline or returned error: {res.text}"
        except httpx.ConnectError:
            print("\n[ERROR] Could not connect to the backend server. Please make sure uvicorn is running on port 8000!")
            sys.exit(1)
            
        # 2. Register User
        print(f"[*] Testing user registration for: {test_email} (/auth/register)...")
        reg_payload = {
            "email": test_email,
            "password": test_password,
            "full_name": f"Smoke Teacher {timestamp}",
            "role": "teacher"
        }
        res = client.post(f"{API_URL}/auth/register", json=reg_payload)
        print(f"    Register Status: {res.status_code}")
        assert res.status_code == 201, f"Failed registration: {res.text}"
        print("    [PASSED] User registration successful.")
        
        # 3. Login User
        print("[*] Testing user login (/auth/login)...")
        login_payload = {
            "username": test_email,
            "password": test_password
        }
        res = client.post(f"{API_URL}/auth/login", data=login_payload)
        print(f"    Login Status: {res.status_code}")
        assert res.status_code == 200, f"Failed login: {res.text}"
        login_data = res.json()
        token = login_data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("    [PASSED] Login successful, JWT token obtained.")
        
        # 4. Fetch Profile
        print("[*] Testing profile retrieval (/users/me)...")
        res = client.get(f"{API_URL}/users/me", headers=headers)
        print(f"    Profile Status: {res.status_code}")
        assert res.status_code == 200, f"Failed to fetch profile: {res.text}"
        profile = res.json()
        assert profile["email"] == test_email
        print(f"    [PASSED] Profile retrieved successfully for: {profile['full_name']}")
        
        # 5. AI Quiz Generation
        print("[*] Testing AI Quiz Generation (/ai/generate)...")
        ai_data = {
            "question_count": "2",
            "difficulty": "medium",
            "language": "en",
            "bloom_levels": "Understand,Apply",
            "question_types": "multiple_choice,true_false",
            "topic": "Python OOP",
            "provider": "mock",
            "question_quality": "balanced",
            "quiz_style": "mixed"
        }
        res = client.post(f"{API_URL}/ai/generate", data=ai_data, headers=headers)
        print(f"    AI Generate Status: {res.status_code}")
        assert res.status_code == 200, f"Failed AI Quiz generation: {res.text}"
        ai_questions = res.json()
        assert len(ai_questions) > 0, "AI returned 0 questions"
        print(f"    [PASSED] AI generation successful. Generated {len(ai_questions)} questions.")
        for i, q in enumerate(ai_questions):
            print(f"      Q{i+1}: {q.get('text')[:60]}... (Type: {q.get('question_type')})")
            
        # 6. Save Draft Quiz
        print("[*] Testing Manual / AI Unified Draft Quiz Saving (/quizzes)...")
        draft_code = f"SMK-DRF-{timestamp}"
        draft_payload = {
            "title": "Smoke Test Draft Quiz",
            "description": "Verification of draft creation flow",
            "subject": "Computer Science",
            "duration": 15,
            "randomize_questions": False,
            "randomize_options": False,
            "anti_cheating_enabled": False,
            "ai_feedback_enabled": True,
            "department": "Engineering",
            "semester": "Fall 2026",
            "total_marks": 20,
            "pass_percentage": 50.0,
            "visibility": "private",
            "status": "draft",
            "language": "en",
            "fullscreen_required": False,
            "adaptive_mode": False,
            "allow_review": True,
            "quiz_code": draft_code,
            "max_attempts": 1,
            "timer_mode": "overall",
            "overall_time_limit_seconds": 900,
            "auto_submit_on_expiry": True,
            "show_score": True,
            "show_answers": True,
            "show_explanations": True,
            "show_solutions": True,
            "show_marks": True,
            "shuffle_questions": False,
            "shuffle_options": False,
            "questions": [
                {
                    "text": q["text"],
                    "difficulty": q["difficulty"],
                    "topic": q["topic"],
                    "marks": 10,
                    "explanation": q.get("explanation", "Mock explanation"),
                    "question_type": q["question_type"],
                    "bloom_level": q.get("bloom_level", "Understand"),
                    "options": [
                        {
                            "text": opt["text"],
                            "is_correct": opt["is_correct"],
                            "display_order": idx
                        } for idx, opt in enumerate(q["options"])
                    ]
                } for q in ai_questions
            ]
        }
        res = client.post(f"{API_URL}/quizzes", json=draft_payload, headers=headers)
        print(f"    Create Draft Status: {res.status_code}")
        assert res.status_code == 201, f"Failed draft quiz creation: {res.text}"
        draft_quiz = res.json()
        draft_id = draft_quiz["id"]
        assert draft_quiz["status"] == "draft"
        assert draft_quiz["quiz_code"] == draft_code
        print(f"    [PASSED] Draft quiz created successfully. Quiz ID: {draft_id}")
        
        # 7. Publish Quiz
        print("[*] Testing Quiz Publishing (/quizzes)...")
        pub_code = f"SMK-PUB-{timestamp}"
        pub_payload = dict(draft_payload)
        pub_payload["title"] = "Smoke Test Published Quiz"
        pub_payload["status"] = "published"
        pub_payload["quiz_code"] = pub_code
        
        res = client.post(f"{API_URL}/quizzes", json=pub_payload, headers=headers)
        print(f"    Publish Quiz Status: {res.status_code}")
        assert res.status_code == 201, f"Failed published quiz creation: {res.text}"
        pub_quiz = res.json()
        pub_id = pub_quiz["id"]
        assert pub_quiz["status"] == "published"
        assert pub_quiz["quiz_code"] == pub_code
        print(f"    [PASSED] Published quiz created successfully. PIN Code: {pub_quiz['quiz_code']}")
        
        # 8. Query Quizzes List to verify creation
        print("[*] Testing querying quizzes list (/quizzes)...")
        res = client.get(f"{API_URL}/quizzes", headers=headers)
        print(f"    Query Quizzes Status: {res.status_code}")
        assert res.status_code == 200, f"Failed to query quizzes: {res.text}"
        quizzes_list = res.json().get("items", [])
        codes = [q["quiz_code"] for q in quizzes_list]
        assert draft_code in codes, "Draft quiz not found in queried list"
        assert pub_code in codes, "Published quiz not found in queried list"
        print(f"    [PASSED] Verified that both quizzes exist in lists. Total items: {len(quizzes_list)}")
        
        # 9. Clean up created quizzes
        print("[*] Performing API-driven cleanup of created quizzes...")
        res = client.delete(f"{API_URL}/quizzes/{draft_id}", headers=headers)
        print(f"    Delete Draft Status: {res.status_code}")
        assert res.status_code == 204, f"Failed to delete draft quiz: {res.text}"
        res = client.delete(f"{API_URL}/quizzes/{pub_id}", headers=headers)
        print(f"    Delete Published Status: {res.status_code}")
        assert res.status_code == 204, f"Failed to delete published quiz: {res.text}"
        print("    [PASSED] Quiz API cleanup completed.")
        
    print("\n[SUCCESS] E2E HTTP API smoke test completed successfully!")
    print("All tested flows (Health, Register, Login, Profile, AI Generation, Save Draft, Publish Quiz, and Delete Quiz) passed verification.")

if __name__ == "__main__":
    run_smoke_test()
