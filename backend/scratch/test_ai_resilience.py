import sys
import asyncio
import uuid
import time
import httpx
from datetime import datetime, timezone

BASE_URL = "http://127.0.0.1:8008"

async def test_ai_resilience():
    print("[*] Starting Phase 3.2 Resilience & Circuit Breaker E2E validation...")

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Reset metrics and health states on server
        res = await client.post(f"{BASE_URL}/api/v1/ai/test-metrics-reset")
        assert res.status_code == 200
        res = await client.post(f"{BASE_URL}/api/v1/ai/test-health-reset")
        assert res.status_code == 200
        print("    States reset successfully on server.")

        # 2. Setup mock teacher token
        teacher_email = f"t_res_{uuid.uuid4().hex[:6]}@example.com"
        password = "secure_password"

        # Register Teacher
        res = await client.post(f"{BASE_URL}/api/v1/auth/register", json={
            "email": teacher_email,
            "password": password,
            "full_name": "Teacher Resilience",
            "role": "teacher"
        })
        assert res.status_code == 201
        
        # Login Teacher
        res = await client.post(f"{BASE_URL}/api/v1/auth/login", data={"username": teacher_email, "password": password})
        assert res.status_code == 200
        token_teacher = res.json()["access_token"]
        headers_teacher = {"Authorization": f"Bearer {token_teacher}"}

        # 3. Verify MockProvider is excluded and works normally
        print("[*] Verifying MockProvider exclusion...")
        enhance_payload = {
            "prompt": "Test Mock Resilience prompt",
            "provider": "mock"
        }
        res = await client.post(f"{BASE_URL}/api/v1/ai/enhance", data=enhance_payload, headers=headers_teacher)
        assert res.status_code == 200
        print("    [PASSED] MockProvider successfully bypassed wrapper checks.")

        # 4. Check initial CLOSED states
        print("[*] Checking initial health states...")
        res = await client.get(f"{BASE_URL}/api/v1/ai/test-health")
        assert res.status_code == 200
        states = res.json()["provider_states"]
        assert states["gemini"]["circuit_state"] == "CLOSED"
        assert states["gemini"]["status"] == "Healthy"
        print("    [PASSED] Initial circuit states are CLOSED / Healthy.")

        # 5. Verify direct call to OPEN circuit is blocked immediately
        print("[*] Verifying that direct calls to OPEN circuits fail immediately...")
        # Force Gemini circuit to OPEN
        res = await client.post(f"{BASE_URL}/api/v1/ai/test-health-update", json={
            "provider": "gemini",
            "updates": {
                "circuit_state": "OPEN",
                "status": "Unavailable",
                "last_failure_time": time.time()
            }
        })
        assert res.status_code == 200
        assert res.json()["state"]["circuit_state"] == "OPEN"

        # Attempt direct enhance request to Gemini (should fail immediately)
        gemini_payload = {
            "prompt": "Test Gemini direct OPEN call",
            "provider": "gemini"
        }
        res = await client.post(f"{BASE_URL}/api/v1/ai/enhance", data=gemini_payload, headers=headers_teacher)
        print(f"    Direct open circuit response: {res.status_code}, body: {res.json()}")
        assert res.status_code == 503 or res.status_code == 500
        print("    [PASSED] Direct call to OPEN circuit was blocked.")

        # 6. Verify AutoProvider skips providers with OPEN circuits
        print("[*] Verifying AutoProvider skips OPEN circuit providers...")
        # Since Gemini is OPEN, AutoProvider should skip Gemini immediately and fall back to the next provider in settings.AUTO_PROVIDER_ORDER.
        # Since settings.AUTO_PROVIDER_ORDER is ["gemini", "groq", "openai"], and Groq is CLOSED:
        # If we run Auto mode, it will skip Gemini and call Groq. But since Groq API keys are not configured, Groq will raise config error.
        # Let's set Groq and OpenAI to OPEN too!
        res = await client.post(f"{BASE_URL}/api/v1/ai/test-health-update", json={
            "provider": "groq",
            "updates": {
                "circuit_state": "OPEN",
                "status": "Unavailable",
                "last_failure_time": time.time()
            }
        })
        assert res.status_code == 200
        res = await client.post(f"{BASE_URL}/api/v1/ai/test-health-update", json={
            "provider": "openai",
            "updates": {
                "circuit_state": "OPEN",
                "status": "Unavailable",
                "last_failure_time": time.time()
            }
        })
        assert res.status_code == 200

        # Now Gemini, Groq, and OpenAI are OPEN. Auto mode should fall back to Mock.
        auto_payload = {
            "prompt": "Test Auto mode fallback skip",
            "provider": "auto"
        }
        res = await client.post(f"{BASE_URL}/api/v1/ai/enhance", data=auto_payload, headers=headers_teacher)
        print(f"    Auto mode fallback response status: {res.status_code}")
        assert res.status_code == 200
        assert "enhanced_prompt" in res.json()
        print("    [PASSED] AutoProvider successfully skipped OPEN providers and fell back to Mock.")

        # 7. Verify cooldown expired transitions circuit to HALF_OPEN
        print("[*] Verifying cooldown expired transition to HALF_OPEN...")
        # Reset health states, then set Gemini to OPEN with last_failure_time set 5 minutes back
        res = await client.post(f"{BASE_URL}/api/v1/ai/test-health-reset")
        assert res.status_code == 200
        res = await client.post(f"{BASE_URL}/api/v1/ai/test-health-update", json={
            "provider": "gemini",
            "updates": {
                "circuit_state": "OPEN",
                "status": "Unavailable",
                "last_failure_time": "back-5-min"
            }
        })
        assert res.status_code == 200

        # Check circuit state now.
        res = await client.get(f"{BASE_URL}/api/v1/ai/test-health")
        assert res.status_code == 200
        states = res.json()["provider_states"]
        assert states["gemini"]["circuit_state"] == "HALF_OPEN"
        assert states["gemini"]["status"] == "Degraded"
        print("    [PASSED] Cooldown expiration transitioned circuit to HALF_OPEN cleanly.")

        # 8. Verify HALF_OPEN single trial request concurrent lock
        print("[*] Verifying HALF_OPEN single trial request concurrent lock...")
        # Put Gemini in HALF_OPEN with is_trial_in_progress = True
        res = await client.post(f"{BASE_URL}/api/v1/ai/test-health-update", json={
            "provider": "gemini",
            "updates": {
                "circuit_state": "HALF_OPEN",
                "status": "Degraded",
                "is_trial_in_progress": True
            }
        })
        assert res.status_code == 200

        # A request to Gemini now should treat it as OPEN because the trial slot is already taken!
        # If we call Gemini directly, it should fail immediately
        res = await client.post(f"{BASE_URL}/api/v1/ai/enhance", data=gemini_payload, headers=headers_teacher)
        assert res.status_code == 503 or res.status_code == 500
        print("    [PASSED] Concurrent trial request was blocked immediately.")

    print("\n[SUCCESS] Phase 3.2 AI Resilience E2E validation passed successfully!")

if __name__ == "__main__":
    asyncio.run(test_ai_resilience())
