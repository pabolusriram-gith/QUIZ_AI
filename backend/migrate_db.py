import asyncio
import sqlite3
import json
import uuid
import os
from datetime import datetime, timezone
from sqlalchemy import text
from app.database.session import engine

# Tables in correct dependency order (foreign keys last)
TABLE_ORDER = [
    "users",
    "quizzes",
    "questions",
    "question_options",
    "login_history",
    "quiz_attempts"
]

def get_sqlite_data(sqlite_path):
    print(f"[*] Reading data from SQLite database: {sqlite_path}")
    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()
    
    data = {}
    for table in TABLE_ORDER:
        sqlite_cursor.execute(f"SELECT * FROM {table}")
        rows = sqlite_cursor.fetchall()
        data[table] = [dict(r) for r in rows]
    sqlite_conn.close()
    return data

async def migrate():
    # Resolve the absolute path of the SQLite database
    script_dir = os.path.dirname(os.path.abspath(__file__))
    sqlite_path = os.path.join(script_dir, "quizverse.db")
    
    if not os.path.exists(sqlite_path):
        raise FileNotFoundError(f"SQLite database file not found at: {sqlite_path}")
        
    sqlite_data = get_sqlite_data(sqlite_path)
    
    # ----------------------------------------------------
    # ORPHAN FILTERING LOGIC
    # SQLite does not enforce foreign keys by default, but PostgreSQL does.
    # We must filter out orphaned records to satisfy foreign key constraints.
    # ----------------------------------------------------
    print("[*] Filtering out orphaned records to respect PostgreSQL foreign key constraints...")
    
    valid_user_ids = {uuid.UUID(hex=u["id"]) for u in sqlite_data["users"]}
    
    # Filter quizzes (must have valid creator)
    valid_quizzes = []
    valid_quiz_ids = set()
    for q in sqlite_data["quizzes"]:
        creator_id = uuid.UUID(hex=q["created_by_id"])
        if creator_id in valid_user_ids:
            valid_quizzes.append(q)
            valid_quiz_ids.add(uuid.UUID(hex=q["id"]))
        else:
            print(f"  [ORPHANED] Skipping quiz {q['id']} - created_by_id {q['created_by_id']} not found in users")

    # Filter questions (must have valid quiz_id)
    valid_questions = []
    valid_question_ids = set()
    for q in sqlite_data["questions"]:
        quiz_id = uuid.UUID(hex=q["quiz_id"])
        if quiz_id in valid_quiz_ids:
            valid_questions.append(q)
            valid_question_ids.add(uuid.UUID(hex=q["id"]))
        else:
            print(f"  [ORPHANED] Skipping question {q['id']} - quiz_id {q['quiz_id']} not found in quizzes")

    # Filter question options (must have valid question_id)
    valid_options = []
    for opt in sqlite_data["question_options"]:
        question_id = uuid.UUID(hex=opt["question_id"])
        if question_id in valid_question_ids:
            valid_options.append(opt)
        else:
            print(f"  [ORPHANED] Skipping option {opt['id']} - question_id {opt['question_id']} not found in questions")

    # Filter login history (must have valid user_id)
    valid_history = []
    for h in sqlite_data["login_history"]:
        user_id = uuid.UUID(hex=h["user_id"])
        if user_id in valid_user_ids:
            valid_history.append(h)
        else:
            print(f"  [ORPHANED] Skipping login history {h['id']} - user_id {h['user_id']} not found in users")

    # Filter quiz attempts (must have valid user_id and quiz_id)
    valid_attempts = []
    for att in sqlite_data["quiz_attempts"]:
        user_id = uuid.UUID(hex=att["user_id"])
        quiz_id = uuid.UUID(hex=att["quiz_id"])
        if user_id in valid_user_ids and quiz_id in valid_quiz_ids:
            valid_attempts.append(att)
        else:
            print(f"  [ORPHANED] Skipping attempt {att['id']} - user_id {att['user_id']} or quiz_id {att['quiz_id']} not found")

    # Compile the final dataset for insertion
    filtered_data = {
        "users": sqlite_data["users"],
        "quizzes": valid_quizzes,
        "questions": valid_questions,
        "question_options": valid_options,
        "login_history": valid_history,
        "quiz_attempts": valid_attempts
    }
    
    # We wrap everything in engine.begin() which starts an implicit transaction.
    # Any exception raised inside this block will automatically ROLLBACK the entire transaction.
    async with engine.begin() as pg_conn:
        # 1. Clear existing data in correct dependency order (reverse)
        print("[*] Clearing existing PostgreSQL tables in reverse dependency order...")
        for table in reversed(TABLE_ORDER):
            await pg_conn.execute(text(f"DELETE FROM {table} CASCADE;"))
        print("[+] PostgreSQL tables cleared successfully.")
        
        # 2. Get PostgreSQL table schemas to check datatypes
        print("[*] Inspecting column definitions in PostgreSQL...")
        column_types = {}
        for table in TABLE_ORDER:
            res = await pg_conn.execute(text(
                f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table}';"
            ))
            column_types[table] = {r[0]: r[1] for r in res.fetchall()}
            
        # 3. Perform the migration table by table
        for table in TABLE_ORDER:
            rows = filtered_data[table]
            if not rows:
                print(f"[!] No rows to migrate for table: {table}")
                continue
                
            print(f"[*] Processing {len(rows)} rows for table: {table}...")
            
            # Extract column list and build insertion query
            cols = list(rows[0].keys())
            col_list_str = ", ".join(cols)
            val_placeholders = ", ".join([f":{c}" for c in cols])
            insert_sql = text(f"INSERT INTO {table} ({col_list_str}) VALUES ({val_placeholders})")
            
            # Map SQLite types to PostgreSQL types
            parsed_rows = []
            for row in rows:
                parsed_row = {}
                for col, val in row.items():
                    if val is None:
                        parsed_row[col] = None
                        continue
                        
                    pg_type = column_types[table].get(col)
                    
                    # Convert to UUID type if applicable
                    if pg_type == "uuid" or col == "id" or col.endswith("_id"):
                        parsed_row[col] = uuid.UUID(hex=val)
                        
                    # Convert to JSON string (instead of passing dict/list directly)
                    elif pg_type in ["json", "jsonb"]:
                        if not isinstance(val, str):
                            parsed_row[col] = json.dumps(val)
                        else:
                            # Verify if the sqlite string is already valid json, otherwise dump it
                            try:
                                json.loads(val)
                                parsed_row[col] = val
                            except ValueError:
                                parsed_row[col] = json.dumps(val)
                            
                    # Convert to Timezone-Aware Datetimes
                    elif pg_type in ["timestamp without time zone", "timestamp with time zone", "timestamp"]:
                        if isinstance(val, str):
                            clean_val = val.split('+')[0]  # strip any offset suffix
                            parsed_dt = None
                            for fmt in ('%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S.%f', '%Y-%m-%dT%H:%M:%S'):
                                try:
                                    parsed_dt = datetime.strptime(clean_val, fmt)
                                    break
                                except ValueError:
                                    continue
                            
                            if parsed_dt:
                                parsed_row[col] = parsed_dt.replace(tzinfo=timezone.utc)
                            else:
                                parsed_row[col] = val
                        else:
                            parsed_row[col] = val
                            
                    # Convert to Boolean type
                    elif pg_type == "boolean":
                        parsed_row[col] = bool(val)
                        
                    # Default assignment
                    else:
                        parsed_row[col] = val
                parsed_rows.append(parsed_row)
                
            # Perform batch insert
            await pg_conn.execute(insert_sql, parsed_rows)
            print(f"[+] Migrated table: {table}")
            
        # 4. Verify count parity
        print("\n[*] Performing row count parity checks against non-orphaned SQLite records...")
        all_match = True
        for table in TABLE_ORDER:
            sqlite_cnt = len(filtered_data[table])
            pg_cnt_res = await pg_conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
            pg_cnt = pg_cnt_res.scalar()
            
            status_str = "MATCH" if sqlite_cnt == pg_cnt else "MISMATCH"
            print(f"  Table {table:20}: Filtered SQLite = {sqlite_cnt:3} | PostgreSQL = {pg_cnt:3} | [{status_str}]")
            if sqlite_cnt != pg_cnt:
                all_match = False
                
        if all_match:
            print("\n[SUCCESS] Data migration verification completed. All table row counts match exactly.")
        else:
            raise ValueError("[ERROR] Data validation failed: PostgreSQL row count does not match SQLite. Rolling back transaction.")

if __name__ == "__main__":
    asyncio.run(migrate())
