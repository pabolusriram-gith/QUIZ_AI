import os
import sys
import uuid
import json
import pytest
from httpx import AsyncClient, ASGITransport

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from app.main import app
from app.services.question_importer import QuestionImporter
from app.core.rate_limit import _in_memory_limits


def test_question_importer_csv_unit():
    """Unit test for QuestionImporter CSV parsing with valid and invalid rows."""
    csv_data = """question_text,question_type,option_a,option_b,option_c,option_d,correct_answer,marks,difficulty,topic,explanation
What is the capital of France?,multiple_choice,Paris,London,Berlin,Madrid,A,1,easy,Geography,Paris is the capital of France.
Is Earth flat?,true_false,True,False,,,False,1,easy,Science,Earth is an oblate spheroid.
Select prime numbers.,multiple_select,2,3,4,6,A, B,2,medium,Math,2 and 3 are prime numbers.
What is the chemical symbol for Gold?,short_answer,,,,Au,1,medium,Chemistry,Au is Aurum.
,multiple_choice,A,B,,,A,1,easy,Empty Stem,This row should fail validation.
Valid stem but missing correct answer,multiple_choice,Option 1,Option 2,,,Z,1,easy,Invalid Ans,This row should fail.
"""
    valid_qs, errors = QuestionImporter.parse_csv(csv_data.encode("utf-8"))
    assert len(valid_qs) == 4, f"Expected 4 valid questions, got {len(valid_qs)}"
    assert len(errors) == 2, f"Expected 2 error rows, got {len(errors)}"
    assert errors[0]["row"] == 6
    assert "empty" in errors[0]["error"].lower()
    assert errors[1]["row"] == 7
    assert "did not match" in errors[1]["error"].lower()


def test_question_importer_json_unit():
    """Unit test for QuestionImporter JSON parsing."""
    json_data = [
        {
            "text": "What is Python?",
            "question_type": "multiple_choice",
            "difficulty": "easy",
            "topic": "Programming",
            "marks": 1,
            "options": [
                {"text": "A programming language", "is_correct": True},
                {"text": "A type of snake only", "is_correct": False}
            ]
        },
        {
            "text": "Invalid question with no options",
            "question_type": "multiple_choice",
            "options": []
        }
    ]
    valid_qs, errors = QuestionImporter.parse_json(json.dumps(json_data).encode("utf-8"))
    assert len(valid_qs) == 1
    assert len(errors) == 1
    assert errors[0]["row"] == 2


@pytest.mark.asyncio
async def test_question_bank_import_full_flow():
    """
    Integration test:
    1. Register Teacher & create a destination Quiz.
    2. Download sample CSV and JSON templates.
    3. Validate preview-only endpoint for CSV and JSON.
    4. Execute CSV import and verify atomic insert into Quiz.
    5. Execute JSON import and verify questions in Question Bank list.
    6. Verify row validation errors do not break valid rows.
    7. Verify unauthorized / cross-teacher import access is rejected (403).
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Register Teacher A
        _in_memory_limits.clear()
        teacher_a_email = f"teachera_{uuid.uuid4().hex[:8]}@example.com"
        teacher_pwd = "TeacherPassword123!"
        reg_res = await client.post(
            "/api/v1/auth/register",
            json={
                "email": teacher_a_email,
                "password": teacher_pwd,
                "full_name": "Teacher A",
                "role": "teacher"
            }
        )
        assert reg_res.status_code in [200, 201]

        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": teacher_a_email, "password": teacher_pwd}
        )
        assert login_res.status_code == 200
        token_a = login_res.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # 2. Create destination Quiz
        quiz_res = await client.post(
            "/api/v1/quizzes",
            headers=headers_a,
            json={
                "title": "Destination Quiz for Import",
                "description": "Target quiz container",
                "subject": "General Science",
                "duration": 15,
                "total_marks": 1,
                "default_marks": 1,
                "quiz_code": f"QIMP{uuid.uuid4().hex[:4].upper()}",
                "questions": [
                    {
                        "text": "Initial seed question in target quiz?",
                        "question_type": "multiple_choice",
                        "difficulty": "easy",
                        "topic": "Intro",
                        "marks": 1,
                        "options": [
                            {"text": "Seed Option 1", "is_correct": True},
                            {"text": "Seed Option 2", "is_correct": False}
                        ]
                    }
                ]
            }
        )
        assert quiz_res.status_code == 201, f"Create quiz failed: {quiz_res.text}"
        quiz_data = quiz_res.json()
        target_quiz_id = quiz_data["id"]

        # 3. Test Template Downloads
        csv_tpl_res = await client.get("/api/v1/quizzes/questions/template/csv", headers=headers_a)
        assert csv_tpl_res.status_code == 200
        assert "question_text" in csv_tpl_res.text
        assert "text/csv" in csv_tpl_res.headers.get("content-type", "")

        json_tpl_res = await client.get("/api/v1/quizzes/questions/template/json", headers=headers_a)
        assert json_tpl_res.status_code == 200
        assert "application/json" in json_tpl_res.headers.get("content-type", "")
        tpl_json = json_tpl_res.json()
        assert isinstance(tpl_json, list) and len(tpl_json) > 0

        # 4. Test Preview Only with CSV (3 valid questions, 1 invalid question)
        csv_upload_content = """question_text,question_type,option_a,option_b,option_c,option_d,correct_answer,marks,difficulty,topic,explanation
What is the largest organ in the human body?,multiple_choice,Skin,Liver,Brain,Heart,A,1,easy,Biology,Skin is the largest organ.
Water boils at 100 degrees Celsius at standard pressure.,true_false,True,False,,,True,1,easy,Chemistry,Standard boiling point of water.
Which are renewable energy sources?,multiple_select,Solar,Wind,Coal,Geothermal,"A, B, D",2,medium,Environmental Science,Solar wind and geothermal are renewable.
Invalid row with no choices,multiple_choice,,,,,,1,easy,Biology,None
"""
        preview_res = await client.post(
            "/api/v1/quizzes/questions/import",
            headers=headers_a,
            data={"quiz_id": target_quiz_id, "preview_only": "true"},
            files={"file": ("questions.csv", csv_upload_content.encode("utf-8"), "text/csv")}
        )
        assert preview_res.status_code == 200, f"Preview failed: {preview_res.text}"
        preview_data = preview_res.json()
        assert preview_data["status"] == "preview"
        assert preview_data["valid_count"] == 3
        assert preview_data["error_count"] == 1
        assert len(preview_data["preview_questions"]) == 3

        # 5. Execute Real CSV Import into Target Quiz
        import_csv_res = await client.post(
            "/api/v1/quizzes/questions/import",
            headers=headers_a,
            data={"quiz_id": target_quiz_id, "preview_only": "false"},
            files={"file": ("questions.csv", csv_upload_content.encode("utf-8"), "text/csv")}
        )
        assert import_csv_res.status_code == 200, f"Import CSV failed: {import_csv_res.text}"
        import_csv_data = import_csv_res.json()
        assert import_csv_data["status"] == "success"
        assert import_csv_data["total_imported"] == 3
        assert import_csv_data["error_count"] == 1

        # 6. Execute JSON Import into Target Quiz
        json_upload_content = json.dumps([
            {
                "text": "What does CPU stand for in computer hardware?",
                "question_type": "multiple_choice",
                "difficulty": "easy",
                "topic": "Computer Science",
                "marks": 1,
                "explanation": "Central Processing Unit",
                "options": [
                    {"text": "Central Processing Unit", "is_correct": True},
                    {"text": "Computer Personal Unit", "is_correct": False},
                    {"text": "Central Power Utility", "is_correct": False}
                ]
            }
        ])

        import_json_res = await client.post(
            "/api/v1/quizzes/questions/import",
            headers=headers_a,
            data={"quiz_id": target_quiz_id, "preview_only": "false"},
            files={"file": ("questions.json", json_upload_content.encode("utf-8"), "application/json")}
        )
        assert import_json_res.status_code == 200, f"Import JSON failed: {import_json_res.text}"
        import_json_data = import_json_res.json()
        assert import_json_data["total_imported"] == 1

        # 7. Verify all imported questions appear in Question Bank list
        qbank_res = await client.get("/api/v1/quizzes/questions", headers=headers_a)
        assert qbank_res.status_code == 200
        qbank_items = qbank_res.json()["items"]
        # 1 seed + 3 from CSV + 1 from JSON = 5 total
        assert qbank_res.json()["total"] == 5

        question_texts = [q["text"] for q in qbank_items]
        assert "What is the largest organ in the human body?" in question_texts
        assert "What does CPU stand for in computer hardware?" in question_texts
        assert "Water boils at 100 degrees Celsius at standard pressure." in question_texts

        # 8. Verify Cross-Teacher Security (Teacher B cannot import into Teacher A's quiz)
        _in_memory_limits.clear()
        teacher_b_email = f"teacherb_{uuid.uuid4().hex[:8]}@example.com"
        reg_b_res = await client.post(
            "/api/v1/auth/register",
            json={"email": teacher_b_email, "password": teacher_pwd, "full_name": "Teacher B", "role": "teacher"}
        )
        assert reg_b_res.status_code in [200, 201]
        login_b_res = await client.post("/api/v1/auth/login", json={"email": teacher_b_email, "password": teacher_pwd})
        token_b = login_b_res.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        cross_res = await client.post(
            "/api/v1/quizzes/questions/import",
            headers=headers_b,
            data={"quiz_id": target_quiz_id, "preview_only": "false"},
            files={"file": ("hack.json", json_upload_content.encode("utf-8"), "application/json")}
        )
        assert cross_res.status_code == 403, f"Expected 403 Forbidden for cross-teacher import, got: {cross_res.status_code}"
