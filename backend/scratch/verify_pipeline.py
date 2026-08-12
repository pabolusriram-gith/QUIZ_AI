import sys
import os
import asyncio

# Setup python path to include backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.ai_providers import clean_json_response, is_rate_limit_or_quota_failure, execute_resilient_raw_call, AIProviderUnavailableError
from app.services.ai_generator_service import repair_question
from app.services.ai_health_service import ai_health_service

async def test_json_repair():
    print("--- Test 1: JSON Repair ---")
    dirty_json = """
    Here is your JSON response:
    ```json
    [
        {
            "text": "Identify the primary advantage of deploying a stack.",
            "difficulty": "medium",
            "topic": "Datastructures",
            "marks": 1,
            "explanation": "Core Concept: Stack operates in LIFO. Incorrect Option Analysis: Queue operates in FIFO. Learner Takeaway: Stack is LIFO.",
            "question_type": "multiple_choice",
            "bloom_level": "Understand",
            "options": [
                {"text": "LIFO access", "is_correct": true},
                {"text": "FIFO access", "is_correct": false},
                {"text": "Random access", "is_correct": false},
                {"text": "Tree hierarchy", "is_correct": false}
            ],
        }
    ]
    ```
    I hope this helps!
    """
    try:
        res = clean_json_response(dirty_json)
        print("SUCCESS: Dirty JSON repaired and parsed successfully!")
        print("Repaired count:", len(res))
    except Exception as e:
        print("FAIL: JSON repair failed:", e)

def test_validation_repair():
    print("\n--- Test 2: Validation Repair ---")
    dirty_question = {
        "text": "Calculate the complexity of binary search on a sorted list.",
        # Missing difficulty
        # Missing bloom_level
        # Missing marks
        "explanation": "No structured headers here.",
        # Missing topic
        "options": [
            {"text": "O(log n)", "is_correct": True},
            {"text": "O(n)", "is_correct": False}
        ]
    }
    repaired, count = repair_question(dirty_question, topic="Algorithms")
    print(f"Repairs made: {count}")
    print("Repaired object:")
    import pprint
    pprint.pprint(repaired)
    
    assert repaired["difficulty"] == "medium", "Failed to infer difficulty"
    assert repaired["bloom_level"] == "Apply", "Failed to infer bloom level"
    assert repaired["marks"] == 1, "Failed to calculate marks"
    assert repaired["topic"] == "Algorithms", "Failed to set default topic"
    assert "**Core Concept**" in repaired["explanation"], "Failed to rebuild explanation"
    print("SUCCESS: Validation repairs verified!")

async def test_rate_limit_failover():
    print("\n--- Test 3: Rate Limit Immediate Failover ---")
    # Reset health service state
    ai_health_service.provider_states["openai"]["circuit_state"] = "CLOSED"
    ai_health_service.provider_states["openai"]["failure_count"] = 0
    
    from openai import RateLimitError
    from httpx import Request, Response
    
    # Create a mock rate limit error
    request = Request("POST", "https://api.openai.com/v1/chat/completions")
    response = Response(status_code=429, request=request)
    mock_err = RateLimitError("Rate limit exceeded", response=response, body=None)
    
    async def mock_fail_call():
        raise mock_err
        
    print("Checking if mock error is rate limit or quota failure:", is_rate_limit_or_quota_failure(mock_err))
    
    # First call should trip circuit and raise AIProviderUnavailableError immediately
    try:
        await execute_resilient_raw_call("openai", mock_fail_call)
    except AIProviderUnavailableError as e:
        print("First call caught expected exception:", e)
        
    state = ai_health_service.get_circuit_state("openai")
    print("Circuit state after rate limit failure (should be OPEN):", state)
    
    # Second call should immediately raise AIProviderUnavailableError without trying
    try:
        await execute_resilient_raw_call("openai", mock_fail_call)
    except AIProviderUnavailableError as e:
        print("Second call immediately rejected as expected:", e)
        
    print("SUCCESS: Immediate rate-limit failover verified!")

async def main():
    await test_json_repair()
    test_validation_repair()
    await test_rate_limit_failover()

if __name__ == "__main__":
    asyncio.run(main())
