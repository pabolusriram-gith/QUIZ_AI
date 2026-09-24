import asyncio
import uuid
from app.database.session import AsyncSessionLocal
from app.models.quiz import Quiz
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        # Get a quiz
        result = await db.execute(select(Quiz).limit(1))
        quiz = result.scalar_one_or_none()
        if not quiz:
            print("No quiz found")
            return
            
        print(f"Found quiz: {quiz.id} - {quiz.title}")
        try:
            await db.delete(quiz)
            await db.commit()
            print("Deleted successfully!")
        except Exception as e:
            print(f"Error deleting quiz: {e}")

if __name__ == "__main__":
    asyncio.run(main())
