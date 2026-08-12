import httpx

if __name__ == "__main__":
    client = httpx.Client()
    
    # Register teacher
    email = "teacher_test_multipart@example.com"
    print("Registering...")
    reg_resp = client.post(
        "http://127.0.0.1:8000/api/v1/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "full_name": "Test Teacher",
            "role": "teacher"
        }
    )
    print("Registration response:", reg_resp.status_code, reg_resp.text)
    
    # Login
    print("Logging in...")
    login_resp = client.post(
        "http://127.0.0.1:8000/api/v1/auth/login",
        data={
            "username": email,
            "password": "Password123!"
        }
    )
    print("Login response:", login_resp.status_code)
    token = login_resp.json()["access_token"]
    
    # Generate
    headers = {"Authorization": f"Bearer {token}"}
    files = {
        "question_count": (None, "30"),
        "difficulty": (None, "medium"),
        "language": (None, "en"),
        "bloom_levels": (None, "Understand,Apply"),
        "question_types": (None, "multiple_choice"),
        "topic": (None, "Python OOP"),
        "provider": (None, "mock")
    }
    print("Generating...")
    gen_resp = client.post(
        "http://127.0.0.1:8000/api/v1/ai/generate",
        headers=headers,
        files=files
    )
    print("Generation response status:", gen_resp.status_code)
    questions = gen_resp.json()
    print(f"Received count: {len(questions)}")
