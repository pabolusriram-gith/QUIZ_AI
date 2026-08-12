import asyncio
import os
import sys

sys.path.append(os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

from app.database.session import AsyncSessionLocal
from app.services.ai_generator_service import PipelineCoordinator

async def test():
    async with AsyncSessionLocal() as db:
        res = await PipelineCoordinator.generate_quiz(
            db=db,
            question_count=10,
            difficulty="medium",
            language="en",
            bloom_levels=["Understand", "Apply"],
            question_types=["multiple_choice"],
            topic="Python DSA",
            course_outcomes=[],
            question_distribution=None,
            question_quality="balanced",
            quiz_style="mixed",
            custom_prompt=None,
            provider="mock",
            model_name=None,
            final_context="Python DSA concept"
        )
        print("Generated questions count:", len(res))

if __name__ == "__main__":
    asyncio.run(test())
