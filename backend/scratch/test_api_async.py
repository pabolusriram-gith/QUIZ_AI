import sys
import os
import asyncio
from httpx import AsyncClient, ASGITransport

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

async def run_test(client, count):
    print(f"--- Testing count: {count} ---")
    response = await client.post(
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

async def main():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await run_test(client, 5)
        await run_test(client, 10)
        await run_test(client, 20)
        await run_test(client, 30)

if __name__ == "__main__":
    asyncio.run(main())
