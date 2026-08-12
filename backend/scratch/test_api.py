import sys
import os
import asyncio
from fastapi.testclient import TestClient

sys.path.append(os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

from app.main import app
from app.api.deps import get_current_user
from app.models.user import User

# Create a mock user
mock_user = User(
    email="test_teacher@example.com",
    role="teacher",
    is_active=True,
    token_version=1
)

async def mock_get_current_user():
    return mock_user

# Override dependency
app.dependency_overrides[get_current_user] = mock_get_current_user

client = TestClient(app)

def run_test(count):
    print(f"--- Testing count: {count} ---")
    response = client.post(
        "/api/v1/ai/generate",
        data={
            "question_count": count,
            "difficulty": "medium",
            "language": "en",
            "bloom_levels": "Understand,Apply",
            "question_types": "multiple_choice",
            "topic": "Python OOP",
            "provider": "mock"
        }
    )
    if response.status_code != 200:
        print("Error:", response.status_code, response.text)
        return
    questions = response.json()
    print(f"Received count: {len(questions)}")
    for i, q in enumerate(questions):
        print(f"  Q{i+1}: {q.get('text')[:60]}... Type={q.get('question_type')} Bloom={q.get('bloom_level')}")

if __name__ == "__main__":
    run_test(5)
    run_test(10)
    run_test(20)
    run_test(30)
