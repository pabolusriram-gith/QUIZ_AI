import asyncio
import httpx
import uuid

BASE_URL = "http://127.0.0.1:8008"

async def main():
    print("[*] Starting Phase 4.2 End-to-End Verification...")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        teacher_email = f"teacher_verify_{uuid.uuid4().hex[:6]}@example.com"
        password = "secure_password"

        # 1. Register a new Teacher
        print(f"[*] Registering teacher account ({teacher_email})...")
        reg_res = await client.post(f"{BASE_URL}/api/v1/auth/register", json={
            "email": teacher_email,
            "password": password,
            "full_name": "Verify Teacher",
            "role": "teacher"
        })
        if reg_res.status_code != 201:
            print(f"[-] Registration failed: {reg_res.status_code} - {reg_res.text}")
            return
            
        # 2. Login Teacher to obtain bearer token
        print("[*] Logging in teacher...")
        login_res = await client.post(
            f"{BASE_URL}/api/v1/auth/login",
            data={"username": teacher_email, "password": password}
        )
        if login_res.status_code != 200:
            print(f"[-] Login failed: {login_res.status_code} - {login_res.text}")
            return
            
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print(f"[+] Logged in successfully. Token: {token[:12]}...")

        # 3. Call AI generate quiz endpoint using mock provider
        print("[*] Triggering quiz generation (mock provider)...")
        generate_payload = {
            "question_count": "2",
            "difficulty": "medium",
            "language": "english",
            "bloom_levels": "Apply",
            "question_types": "multiple_choice",
            "topic": "Python Asyncio",
            "course_outcomes": "",
            "question_distribution": "",
            "question_quality": "fast",
            "quiz_style": "default",
            "custom_prompt": "",
            "provider": "mock",
            "model_name": "mock-verify-model"
        }
        
        gen_res = await client.post(
            f"{BASE_URL}/api/v1/ai/generate",
            data=generate_payload,
            headers=headers
        )
        if gen_res.status_code != 200:
            print(f"[-] Quiz generation failed: {gen_res.status_code} - {gen_res.text}")
            return
            
        questions = gen_res.json()
        print(f"[+] Quiz generated successfully. Received {len(questions)} questions.")
        print(f"    First Question: '{questions[0].get('text')}'")

        # 4. Retrieve Metrics traces with include_traces=True
        print("[*] Retrieving metrics snapshot from /api/v1/ai/metrics...")
        metrics_res = await client.get(
            f"{BASE_URL}/api/v1/ai/metrics?include_traces=True&trace_limit=5",
            headers=headers
        )
        if metrics_res.status_code != 200:
            print(f"[-] Failed to fetch AI metrics: {metrics_res.status_code} - {metrics_res.text}")
            return
            
        metrics_data = metrics_res.json()
        print("[+] Metrics snapshot:")
        print(f"    Successful requests: {metrics_data.get('successful_requests')}")
        print(f"    Mock provider stats: {metrics_data.get('providers', {}).get('mock')}")
        
        traces = metrics_data.get("request_traces", [])
        print(f"    Request traces (limit 5):")
        for trace in traces:
            print(f"      - Request ID: {trace.get('request_id')}")
            print(f"        Provider: {trace.get('provider')}")
            print(f"        Type: {trace.get('request_type')}")
            print(f"        Network MS: {trace.get('network_ms')}")
            print(f"        Processing MS: {trace.get('processing_ms')}")
            print(f"        Total MS: {trace.get('total_ms')}")
            print(f"        Success: {trace.get('success')}")
            print(f"        Timestamp: {trace.get('timestamp')}")

        print("\n[SUCCESS] Phase 4.2 Verification completed successfully!")

if __name__ == "__main__":
    asyncio.run(main())
