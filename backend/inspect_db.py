import sqlite3
import os
import json
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

def inspect_sqlite(db_path):
    print(f"=== Inspecting SQLite: {db_path} ===")
    if not os.path.exists(db_path):
        print("File does not exist.")
        return
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in c.fetchall()]
    print("Tables:", tables)
    for table in tables:
        c.execute(f"SELECT COUNT(*) FROM {table}")
        count = c.fetchone()[0]
        print(f"  Table '{table}': {count} rows")
        if table in ["users", "quizzes", "quiz_attempts"]:
            c.execute(f"SELECT * FROM {table} LIMIT 5")
            rows = c.fetchall()
            print(f"  Sample from '{table}':")
            for r in rows:
                print("    ", dict(r))
    conn.close()

async def inspect_postgres():
    print("=== Inspecting PostgreSQL ===")
    db_url = None
    env_paths = [".env", "backend/.env", "../.env"]
    for path in env_paths:
        if os.path.exists(path):
            with open(path, "r") as f:
                for line in f:
                    if line.startswith("DATABASE_URL="):
                        db_url = line.split("=", 1)[1].strip()
                        if (db_url.startswith('"') and db_url.endswith('"')) or (db_url.startswith("'") and db_url.endswith("'")):
                            db_url = db_url[1:-1]
                        break
            if db_url:
                break
    
    if not db_url:
        print("DATABASE_URL not found in .env files")
        return
        
    print(f"Connecting to: {db_url}")
    engine = create_async_engine(db_url)
    try:
        async with engine.connect() as conn:
            # List tables
            res = await conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public';
            """))
            tables = [r[0] for r in res.fetchall()]
            print("Tables:", tables)
            for table in tables:
                res_count = await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = res_count.scalar()
                print(f"  Table '{table}': {count} rows")
                if table in ["users", "quizzes", "quiz_attempts"]:
                    res_sample = await conn.execute(text(f"SELECT * FROM {table} LIMIT 5"))
                    rows = res_sample.fetchall()
                    print(f"  Sample from '{table}':")
                    for r in rows:
                        print("    ", dict(r._mapping))
    except Exception as e:
        print(f"PostgreSQL connection/query failed: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    inspect_sqlite("../quizverse.db")
    inspect_sqlite("quizverse.db")
    inspect_sqlite("backend/quizverse.db")
    asyncio.run(inspect_postgres())
