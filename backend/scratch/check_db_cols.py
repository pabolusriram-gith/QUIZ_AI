import sys
sys.path.insert(0, '.')
import asyncio
from sqlalchemy import text
from app.database.session import engine

async def check():
    async with engine.begin() as conn:
        # Check questions table columns
        r = await conn.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name='questions' ORDER BY column_name"
        ))
        cols = [row[0] for row in r.fetchall()]
        print('Questions columns:', cols)
        
        # Check alembic version
        r2 = await conn.execute(text("SELECT version_num FROM alembic_version"))
        ver = r2.fetchall()
        print('Alembic version:', ver)
        
        # Try a simple insert to get the actual DB error
        try:
            r3 = await conn.execute(text(
                "SELECT 1 FROM questions LIMIT 0"
            ))
            print("questions table accessible")
        except Exception as e:
            print("questions table error:", e)

asyncio.run(check())
