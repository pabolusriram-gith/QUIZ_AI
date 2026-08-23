import asyncio
import os
import sys
import uuid
# pyrefly: ignore [missing-import]
import pytest
from httpx import AsyncClient, ASGITransport

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from app.main import app

@pytest.mark.asyncio
async def test_live_quiz_flow_with_anonymous_students():
    """
    Validates complete live quiz participant flow with 1 teacher and 3 anonymous students:
    Enter Game PIN -> Enter Nickname -> Waiting Lobby -> Host Starts -> Assessment -> Submit -> Result
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Register & authenticate a teacher
        teacher_email = f"teacher_{uuid.uuid4().hex[:8]}@example.com"
        teacher_pwd = "TeacherSecurePassword123!"
        reg_res = await client.post(
            "/api/v1/auth/register",
            json={
                "email": teacher_email,
                "password": teacher_pwd,
                "full_name": "Professor Smith",
                "role": "teacher"
            }
        )
        assert reg_res.status_code in [200, 201], f"Teacher reg failed: {reg_res.text}"
        
        login_res = await client.post(
            "/api/v1/auth/login",
            json={
                "email": teacher_email,
                "password": teacher_pwd
            }
        )
        assert login_res.status_code == 200, f"Teacher login failed: {login_res.text}"
        teacher_token = login_res.json()["access_token"]
        teacher_headers = {"Authorization": f"Bearer {teacher_token}"}

        # 2. Create a published quiz with 2 questions
        quiz_res = await client.post(
            "/api/v1/quizzes",
            headers=teacher_headers,
            json={
                "title": "Computer Science Live Trivia",
                "description": "Live interactive trivia",
                "subject": "CS",
                "duration": 10,
                "total_marks": 2,
                "default_marks": 1,
                "status": "published",
                "quiz_code": f"QUIZ{uuid.uuid4().hex[:4].upper()}",
                "questions": [
                    {
                        "text": "What does CPU stand for?",
                        "difficulty": "easy",
                        "topic": "Hardware",
                        "marks": 1,
                        "question_type": "multiple_choice",
                        "time_limit_seconds": 30,
                        "options": [
                            {"text": "Central Processing Unit", "is_correct": True},
                            {"text": "Central Power Unit", "is_correct": False},
                            {"text": "Control Processing Unit", "is_correct": False},
                            {"text": "Core Processor Unit", "is_correct": False}
                        ]
                    },
                    {
                        "text": "Python is a compiled language only.",
                        "difficulty": "easy",
                        "topic": "Programming",
                        "marks": 1,
                        "question_type": "true_false",
                        "time_limit_seconds": 30,
                        "options": [
                            {"text": "True", "is_correct": False},
                            {"text": "False", "is_correct": True}
                        ]
                    }
                ]
            }
        )
        assert quiz_res.status_code in [200, 201], f"Quiz create failed: {quiz_res.text}"
        quiz_id = quiz_res.json()["id"]

        # 3. Teacher creates a live game session
        session_res = await client.post(
            "/api/v1/sessions/create",
            headers=teacher_headers,
            json={
                "quiz_id": quiz_id,
                "max_players": 50
            }
        )
        assert session_res.status_code == 200, f"Session create failed: {session_res.text}"
        game_pin = session_res.json()["game_pin"]
        assert game_pin is not None

        # 4. Multiple anonymous students join with PIN and nickname (no email/registration required)
        students_info = [
            {"nickname": "Alice_Dev"},
            {"nickname": "Bob_Coder"},
            {"nickname": "Charlie_AI"}
        ]
        student_sessions = []

        for s in students_info:
            join_res = await client.post(
                f"/api/v1/sessions/{game_pin}/join",
                json={"nickname": s["nickname"]}
            )
            assert join_res.status_code == 200, f"Join failed for {s['nickname']}: {join_res.text}"
            data = join_res.json()
            assert data["status"] == "joined"
            assert "connection_token" in data
            assert "access_token" in data and data["access_token"] is not None
            assert "user_id" in data and data["user_id"] is not None
            
            student_sessions.append({
                "nickname": s["nickname"],
                "token": data["access_token"],
                "user_id": data["user_id"],
                "headers": {"Authorization": f"Bearer {data['access_token']}"}
            })

        # Ensure all students received distinct user identities
        user_ids = [s["user_id"] for s in student_sessions]
        assert len(set(user_ids)) == 3, f"User IDs must be distinct: {user_ids}"

        # 5. Verify participants in waiting lobby
        parts_res = await client.get(f"/api/v1/sessions/{game_pin}/participants")
        assert parts_res.status_code == 200
        parts = parts_res.json()
        assert len(parts) == 3
        part_nicks = [p["nickname"] for p in parts]
        for s in students_info:
            assert s["nickname"] in part_nicks

        # 6. Teacher starts the live quiz session
        start_res = await client.post(
            f"/api/v1/sessions/{game_pin}/start",
            headers=teacher_headers
        )
        assert start_res.status_code == 200
        assert start_res.json()["status"] == "active"

        # 7. Each student starts their assessment attempt using their guest token
        for s in student_sessions:
            att_res = await client.post(
                f"/api/v1/quizzes/{quiz_id}/attempts",
                headers=s["headers"],
                json={}
            )
            assert att_res.status_code == 200, f"Attempt start failed for {s['nickname']}: {att_res.text}"
            att_data = att_res.json()
            s["attempt_id"] = att_data["id"]

        # Fetch questions to know option IDs
        quiz_detail_res = await client.get(f"/api/v1/quizzes/{quiz_id}", headers=teacher_headers)
        questions = quiz_detail_res.json()["questions"]
        q1 = questions[0]
        q2 = questions[1]
        q1_correct_opt = next(o["id"] for o in q1["options"] if o["is_correct"])
        q2_correct_opt = next(o["id"] for o in q2["options"] if o["is_correct"])
        q1_wrong_opt = next(o["id"] for o in q1["options"] if not o["is_correct"])

        # 8. Students submit their answers
        # Alice answers both correctly (2 pts)
        await client.put(
            f"/api/v1/quizzes/{quiz_id}/attempts/{student_sessions[0]['attempt_id']}/save-progress",
            headers=student_sessions[0]["headers"],
            json={
                "answers": {q1["id"]: [q1_correct_opt], q2["id"]: [q2_correct_opt]},
                "question_analytics": {},
                "time_spent_seconds": 15,
                "tab_switch_count": 0,
                "fullscreen_exit_count": 0,
                "copy_paste_count": 0
            }
        )
        alice_sub = await client.post(
            f"/api/v1/quizzes/{quiz_id}/attempts/{student_sessions[0]['attempt_id']}/submit",
            headers=student_sessions[0]["headers"],
            json={
                "answers": {q1["id"]: [q1_correct_opt], q2["id"]: [q2_correct_opt]},
                "question_analytics": {},
                "time_spent_seconds": 15,
                "tab_switch_count": 0,
                "fullscreen_exit_count": 0,
                "copy_paste_count": 0
            }
        )
        assert alice_sub.status_code == 200

        # Bob answers 1 correct, 1 wrong (1 pt)
        bob_sub = await client.post(
            f"/api/v1/quizzes/{quiz_id}/attempts/{student_sessions[1]['attempt_id']}/submit",
            headers=student_sessions[1]["headers"],
            json={
                "answers": {q1["id"]: [q1_correct_opt], q2["id"]: [q1_wrong_opt]},
                "question_analytics": {},
                "time_spent_seconds": 20,
                "tab_switch_count": 0,
                "fullscreen_exit_count": 0,
                "copy_paste_count": 0
            }
        )
        assert bob_sub.status_code == 200

        # Charlie answers both wrong (0 pts)
        charlie_sub = await client.post(
            f"/api/v1/quizzes/{quiz_id}/attempts/{student_sessions[2]['attempt_id']}/submit",
            headers=student_sessions[2]["headers"],
            json={
                "answers": {q1["id"]: [q1_wrong_opt], q2["id"]: [q1_wrong_opt]},
                "question_analytics": {},
                "time_spent_seconds": 25,
                "tab_switch_count": 0,
                "fullscreen_exit_count": 0,
                "copy_paste_count": 0
            }
        )
        assert charlie_sub.status_code == 200

        # 9. Each student checks their results
        alice_res = await client.get(
            f"/api/v1/quizzes/attempts/{student_sessions[0]['attempt_id']}/results",
            headers=student_sessions[0]["headers"]
        )
        assert alice_res.status_code == 200
        assert alice_res.json()["score"] == 2.0
        assert alice_res.json()["percentage"] == 100.0

        bob_res = await client.get(
            f"/api/v1/quizzes/attempts/{student_sessions[1]['attempt_id']}/results",
            headers=student_sessions[1]["headers"]
        )
        assert bob_res.status_code == 200
        assert bob_res.json()["score"] == 1.0
        assert bob_res.json()["percentage"] == 50.0

        charlie_res = await client.get(
            f"/api/v1/quizzes/attempts/{student_sessions[2]['attempt_id']}/results",
            headers=student_sessions[2]["headers"]
        )
        assert charlie_res.status_code == 200
        assert charlie_res.json()["score"] == 0.0

        # 10. Teacher checks leaderboard / participants in session
        final_parts = await client.get(f"/api/v1/sessions/{game_pin}/participants")
        assert final_parts.status_code == 200
        assert len(final_parts.json()) == 3

        print("\n[SUCCESS] All live quiz participant flows verified for 1 teacher and multiple anonymous students!")
