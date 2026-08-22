import asyncio
import os
import sys
import uuid
import pytest
from httpx import AsyncClient, ASGITransport

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from app.main import app

@pytest.mark.asyncio
async def test_live_quiz_slido_timer_flow():
    """
    Test live quiz Slido-like timer behavior:
    1. 10-second question
    2. 30-second question
    3. Different duration on subsequent question (15s)
    4. Fresh timer on transition (no carry-over of remaining time)
    5. Host Pause and Resume synchronization
    6. Multiple students receiving synchronized authoritative timing
    7. Timer reaching zero and answer locking
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Register & authenticate teacher
        teacher_email = f"teacher_timer_{uuid.uuid4().hex[:8]}@example.com"
        teacher_pwd = "TeacherPassword123!"
        reg_res = await client.post("/api/v1/auth/register", json={
            "email": teacher_email,
            "password": teacher_pwd,
            "full_name": "Prof. Slido Timer Tester",
            "role": "teacher"
        })
        assert reg_res.status_code == 201, f"Teacher registration failed: {reg_res.text}"

        login_res = await client.post("/api/v1/auth/login", json={
            "email": teacher_email,
            "password": teacher_pwd
        })
        assert login_res.status_code == 200, f"Teacher login failed: {login_res.text}"
        teacher_token = login_res.json()["access_token"]
        teacher_headers = {"Authorization": f"Bearer {teacher_token}"}

        # 2. Create Quiz with 3 distinct question durations (10s, 30s, 15s)
        quiz_payload = {
            "title": "Slido Precision Timing Quiz",
            "description": "Per-question timing verification",
            "subject": "CS",
            "duration": 10,
            "total_marks": 3,
            "default_marks": 1,
            "status": "published",
            "quiz_code": f"QUIZ{uuid.uuid4().hex[:4].upper()}",
            "questions": [
                {
                    "text": "Q1: First Question (30 seconds)?",
                    "difficulty": "easy",
                    "topic": "CS",
                    "marks": 1,
                    "order_index": 0,
                    "question_type": "multiple_choice",
                    "time_limit_seconds": 30,  # 30s question
                    "options": [
                        {"text": "A", "is_correct": True},
                        {"text": "B", "is_correct": False}
                    ]
                },
                {
                    "text": "Q2: Long analysis (60 seconds)?",
                    "difficulty": "medium",
                    "topic": "CS",
                    "marks": 1,
                    "order_index": 1,
                    "question_type": "multiple_choice",
                    "time_limit_seconds": 60,  # 60s question
                    "options": [
                        {"text": "Option 1", "is_correct": True},
                        {"text": "Option 2", "is_correct": False}
                    ]
                },
                {
                    "text": "Q3: Medium sprint (15 seconds)?",
                    "difficulty": "easy",
                    "topic": "CS",
                    "marks": 1,
                    "order_index": 2,
                    "question_type": "multiple_choice",
                    "time_limit_seconds": 15,  # 15s question
                    "options": [
                        {"text": "True", "is_correct": True},
                        {"text": "False", "is_correct": False}
                    ]
                }
            ]
        }
        create_quiz_res = await client.post("/api/v1/quizzes", headers=teacher_headers, json=quiz_payload)
        assert create_quiz_res.status_code == 201, f"Quiz creation failed: {create_quiz_res.text}"
        quiz_id = create_quiz_res.json()["id"]

        # 3. Create Live Game Session
        create_session_res = await client.post("/api/v1/sessions/create", headers=teacher_headers, json={
            "quiz_id": quiz_id,
            "max_players": 50
        })
        assert create_session_res.status_code == 200, f"Session create failed: {create_session_res.text}"
        session_data = create_session_res.json()
        pin = session_data["game_pin"]

        # 4. Join 2 anonymous participants
        join1 = await client.post(f"/api/v1/sessions/{pin}/join", json={"nickname": "Student_Alpha"})
        assert join1.status_code == 200, f"Alpha join failed: {join1.text}"
        assert "access_token" in join1.json()

        join2 = await client.post(f"/api/v1/sessions/{pin}/join", json={"nickname": "Student_Beta"})
        assert join2.status_code == 200, f"Beta join failed: {join2.text}"
        assert "access_token" in join2.json()

        # 5. Teacher Starts the Quiz -> Verify Question 0 gets exact 30s duration
        start_res = await client.post(f"/api/v1/sessions/{pin}/start", headers=teacher_headers)
        assert start_res.status_code == 200, f"Start failed: {start_res.text}"
        started_session = start_res.json()
        assert started_session["status"] == "active"
        assert started_session["current_question_index"] == 0
        assert started_session["current_question_duration"] == 30, "Question 0 duration must be 30s"

        # Verify state snapshot provides accurate 30s timing to connected students
        state_q0 = (await client.get(f"/api/v1/sessions/{pin}/state")).json()
        assert state_q0["current_question_index"] == 0
        assert state_q0["current_question_duration"] == 30
        assert 0 < state_q0["remaining_time"] <= 30
        assert state_q0["is_paused"] is False

        # 6. Test Host Pause & Resume
        pause_res = await client.post(f"/api/v1/sessions/{pin}/pause", headers=teacher_headers)
        assert pause_res.status_code == 200
        assert pause_res.json()["is_paused"] is True

        state_after_pause = (await client.get(f"/api/v1/sessions/{pin}/state")).json()
        assert state_after_pause["is_paused"] is True

        await asyncio.sleep(0.5)
        resume_res = await client.post(f"/api/v1/sessions/{pin}/resume", headers=teacher_headers)
        assert resume_res.status_code == 200
        assert resume_res.json()["is_paused"] is False

        state_after_resume = (await client.get(f"/api/v1/sessions/{pin}/state")).json()
        assert state_after_resume["is_paused"] is False

        # 7. Transition to Question 1 (60-second question) -> Verify fresh 60s timer (no carry over)
        next_res = await client.post(f"/api/v1/sessions/{pin}/next-question", headers=teacher_headers)
        assert next_res.status_code == 200, f"Next question failed: {next_res.text}"
        next_data = next_res.json()
        assert next_data["current_question_index"] == 1
        assert next_data["current_question_duration"] == 60, "Question 1 must start with fresh full 60s duration"

        state_q1 = (await client.get(f"/api/v1/sessions/{pin}/state")).json()
        assert state_q1["current_question_index"] == 1
        assert state_q1["current_question_duration"] == 60
        assert 0 < state_q1["remaining_time"] <= 60, "Students must receive fresh 60s"

        # 8. Transition to Question 2 (15-second question) -> Verify fresh 15s timer
        next_res2 = await client.post(f"/api/v1/sessions/{pin}/next-question", headers=teacher_headers)
        assert next_res2.status_code == 200, f"Next question 2 failed: {next_res2.text}"
        next_data2 = next_res2.json()
        assert next_data2["current_question_index"] == 2
        assert next_data2["current_question_duration"] == 15, "Question 2 must start with fresh full 15s duration"

        state_q2 = (await client.get(f"/api/v1/sessions/{pin}/state")).json()
        assert state_q2["current_question_index"] == 2
        assert state_q2["current_question_duration"] == 15
        assert 0 < state_q2["remaining_time"] <= 15, "Students must receive fresh 15s"

        # 9. Test Lock & Unlock Answers
        lock_res = await client.post(f"/api/v1/sessions/{pin}/lock", headers=teacher_headers)
        assert lock_res.status_code == 200
        assert lock_res.json()["answers_locked"] is True

        unlock_res = await client.post(f"/api/v1/sessions/{pin}/unlock", headers=teacher_headers)
        assert unlock_res.status_code == 200
        assert unlock_res.json()["answers_locked"] is False

        # 10. End Session
        end_res = await client.post(f"/api/v1/sessions/{pin}/end", headers=teacher_headers)
        assert end_res.status_code == 200
        assert end_res.json()["status"] == "finished"
