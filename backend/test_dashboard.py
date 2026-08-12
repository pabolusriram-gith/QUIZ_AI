import asyncio
import os
import sys
from datetime import datetime, timezone

# Add parent directory to sys.path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.database.session import AsyncSessionLocal
from app.models.user import User
from app.api.v1.endpoints.attempts import get_student_dashboard
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        # Fetch the student users
        res = await db.execute(select(User).where(User.role == 'student'))
        students = res.scalars().all()
        
        for student in students:
            print(f"\n======================================")
            print(f"Testing for student: {student.email} (ID: {student.id})")
            print(f"======================================")
            try:
                data = await get_student_dashboard(current_user=student, db=db)
                print("Dashboard result:")
                import pprint
                pprint.pprint(data)
            except Exception as e:
                print("Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
