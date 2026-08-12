import asyncio
import os
import sys

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.database.session import AsyncSessionLocal
from app.models.user import User
from app.api.v1.endpoints.quizzes import get_teacher_dashboard
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        # Fetch the teacher users
        res = await db.execute(select(User).where(User.role == 'teacher'))
        teachers = res.scalars().all()
        
        if not teachers:
            print("No teacher found in the database. Trying admin...")
            res = await db.execute(select(User).where(User.role == 'admin'))
            teachers = res.scalars().all()
            
        for teacher in teachers:
            print(f"\n======================================")
            print(f"Testing for teacher: {teacher.email} (ID: {teacher.id})")
            print(f"======================================")
            try:
                data = await get_teacher_dashboard(current_user=teacher, db=db)
                print("Dashboard result:")
                import pprint
                pprint.pprint(data)
            except Exception as e:
                print("Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
