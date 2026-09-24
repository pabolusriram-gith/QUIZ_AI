import asyncio
import pprint
from app.database.session import AsyncSessionLocal
from app.models.quiz import Quiz
from app.models.user import User
from sqlalchemy import select

async def run():
    async with AsyncSessionLocal() as db:
        users = (await db.execute(select(User.id, User.email))).all()
        print("Users:")
        pprint.pprint(users)
        
        quizzes = (await db.execute(select(Quiz.id, Quiz.title, Quiz.created_by_id))).all()
        print("Quizzes:")
        pprint.pprint(quizzes)

if __name__ == "__main__":
    asyncio.run(run())
