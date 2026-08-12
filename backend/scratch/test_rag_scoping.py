import sys
import os
import asyncio
import httpx
from sqlalchemy import select

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.session import AsyncSessionLocal
from app.models.user import User
from app.core.security import create_access_token

async def run_tests():
    print("[*] Retrieving teacher from database for authentication...")
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(User.role == "teacher").limit(1))
        teacher = res.scalar_one_or_none()
        if not teacher:
            print("[-] No teacher found.")
            return
        
        token = create_access_token(
            subject=teacher.id,
            role=teacher.role,
            token_version=teacher.token_version
        )
        print(f"[+] Token generated for {teacher.email}")

    headers = {"Authorization": f"Bearer {token}"}
    client = httpx.AsyncClient(timeout=60.0)

    # ==========================================
    # TEST 1: Empty / Insufficient Document Check
    # ==========================================
    print("\n--- TEST 1: Empty/Unreadable Document Ingestion ---")
    files = [("files", ("empty.txt", b"      ", "text/plain"))]
    data = {
        "question_count": "5",
        "difficulty": "medium",
        "language": "en",
        "provider": "mock",
        "question_quality": "balanced",
        "quiz_style": "mixed",
    }
    
    resp = await client.post("http://127.0.0.1:8000/api/v1/ai/generate", headers=headers, data=data, files=files)
    print(f"Status Code: {resp.status_code}")
    print(f"Response Body: {resp.text}")
    assert resp.status_code == 400
    assert "Document text extraction failed" in resp.text
    print("[PASS] Test 1: Empty document successfully blocked.")

    # ==========================================
    # TEST 2: Direct Context Mode (Mock Provider)
    # ==========================================
    print("\n--- TEST 2: Direct Context Mode with Math Content (Mock) ---")
    math_content = (
        "GMRIT Math Club Induction Slides. "
        "The Math Club covers three main subtopics: "
        "1. Calculus (study of limits, derivatives, integrals). "
        "2. Linear Algebra (matrices, linear transformations, eigenvalues). "
        "3. Game Theory (Nash equilibrium, dominant strategies)."
    )
    
    files = [("files", ("math_induction.txt", math_content.encode("utf-8"), "text/plain"))]
    data = {
        "question_count": "3",
        "difficulty": "medium",
        "language": "en",
        "provider": "mock",
        "question_quality": "balanced",
        "quiz_style": "mixed",
    }
    resp = await client.post("http://127.0.0.1:8000/api/v1/ai/generate", headers=headers, data=data, files=files)
    print(f"Status Code: {resp.status_code}")
    print(f"Questions returned count: {len(resp.json()) if resp.status_code == 200 else 0}")
    assert resp.status_code == 200
    print("[PASS] Test 2: Direct Context Mode with Mock completed.")

    # ==========================================
    # TEST 3: Direct Context Mode (Real Gemini/Groq)
    # ==========================================
    print("\n--- TEST 3: Direct Context Mode with Math Content (Real AI Provider - Gemini) ---")
    data = {
        "question_count": "3",
        "difficulty": "medium",
        "language": "en",
        "provider": "gemini", # Using gemini provider from env
        "question_quality": "balanced",
        "quiz_style": "mixed",
    }
    
    resp = await client.post("http://127.0.0.1:8000/api/v1/ai/generate", headers=headers, data=data, files=files)
    print(f"Status Code: {resp.status_code}")
    if resp.status_code == 200:
        questions = resp.json()
        print(f"Questions returned count: {len(questions)}")
        for idx, q in enumerate(questions):
            print(f"  Question {idx+1}: {q.get('text')}")
            print(f"  Topic: {q.get('topic')}")
            print(f"  Explanation: {q.get('explanation')}")
            # Verify the AI did not generate generic Python or database questions
            text_lower = q.get('text', '').lower()
            explanation_lower = q.get('explanation', '').lower()
            assert "python" not in text_lower, "Generated python question from Math Club document!"
            assert "database" not in text_lower, "Generated database question from Math Club document!"
        print("[PASS] Test 3: Real AI respects the Math Club document and does not fallback to Python/DB.")
    else:
        print(f"[-] Real Gemini generation failed: {resp.text}")
        print("[FAIL] Test 3 failed.")

    # ==========================================
    # TEST 4: Insufficient Content Handling (Mock)
    # ==========================================
    print("\n--- TEST 4: Insufficient Content Warning ---")
    # Provide very short content, but ask for 10 questions.
    # Since mock provider fallback is disabled for document context, it should return fewer questions
    # and contain the X-Warning header.
    short_content = "This document only contains one single fact: GMRIT Math Club was founded in 2018."
    files = [("files", ("short.txt", short_content.encode("utf-8"), "text/plain"))]
    data = {
        "question_count": "10",
        "difficulty": "medium",
        "language": "en",
        "provider": "mock",
        "question_quality": "balanced",
        "quiz_style": "mixed",
    }
    resp = await client.post("http://127.0.0.1:8000/api/v1/ai/generate", headers=headers, data=data, files=files)
    print(f"Status Code: {resp.status_code}")
    print(f"Headers: {dict(resp.headers)}")
    warning_header = resp.headers.get("x-warning")
    print(f"X-Warning Header: {warning_header}")
    print(f"Questions returned count: {len(resp.json()) if resp.status_code == 200 else 0}")
    assert resp.status_code == 200
    assert warning_header is not None, "Missing X-Warning header for insufficient content!"
    print("[PASS] Test 4: Insufficient content correctly triggers warning header.")

    # ==========================================
    # TEST 5: RAG Mode (Large Document > 50,000 chars)
    # ==========================================
    print("\n--- TEST 5: RAG Mode for Large Document ---")
    # Generate 55,000 characters of dummy text. At the end, add quantum topology info.
    dummy_text = "Calculus is the mathematical study of continuous change.\n" * 1000
    special_info = "Secret Target Topic: Quantum Topology in Math Club. We discuss quantum knots and invariants."
    large_content = dummy_text + "\n" + special_info
    
    files = [("files", ("large_math.txt", large_content.encode("utf-8"), "text/plain"))]
    data = {
        "question_count": "2",
        "difficulty": "hard",
        "language": "en",
        "provider": "mock",
        "question_quality": "balanced",
        "quiz_style": "mixed",
        "topic": "Quantum Topology",  # Semantic query will find this specific section
    }
    resp = await client.post("http://127.0.0.1:8000/api/v1/ai/generate", headers=headers, data=data, files=files)
    print(f"Status Code: {resp.status_code}")
    print(f"Questions returned count: {len(resp.json()) if resp.status_code == 200 else 0}")
    assert resp.status_code == 200
    print("[PASS] Test 5: RAG Mode completed successfully.")

    await client.close()

if __name__ == "__main__":
    asyncio.run(run_tests())
