import asyncio
from app.database.session import engine
from sqlalchemy import text

async def main():
    async with engine.connect() as conn:
        res = await conn.execute(text("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'quizzes' 
              AND column_name IN ('available_from', 'available_until', 'created_at');
        """))
        for row in res.fetchall():
            print(row)

if __name__ == "__main__":
    asyncio.run(main())
