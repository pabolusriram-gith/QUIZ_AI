import asyncio
from app.database.session import AsyncSessionLocal
from app.models.quiz import Quiz, GameSession, GameSessionStatus
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        # Find a quiz
        result = await db.execute(select(Quiz).limit(1))
        quiz = result.scalar_one_or_none()
        if not quiz:
            print("No quiz found")
            return
            
        print(f"Testing delete on quiz: {quiz.id} - {quiz.title}")
        
        # Create a game session for it
        gs = GameSession(
            quiz_id=quiz.id,
            host_id=quiz.created_by_id,
            game_pin="999999",
            status=GameSessionStatus.WAITING.value
        )
        db.add(gs)
        await db.commit()
        
        print("Game session created. Now trying to delete quiz...")
        try:
            await db.delete(quiz)
            await db.commit()
            print("Deleted successfully!")
        except Exception as e:
            print(f"Error deleting quiz: {e}")

if __name__ == "__main__":
    asyncio.run(main())
