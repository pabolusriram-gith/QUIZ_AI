import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.session import AsyncSessionLocal
from app.models.user import User
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User))
        users = res.scalars().all()
        print(f"Found {len(users)} users:")
        for u in users:
            print(f"Email: {u.email} | Role: {u.role} | Full Name: {u.full_name} | ID: {u.id}")

if __name__ == "__main__":
    asyncio.run(main())
