import asyncio
import os
import sys
import uuid
from sqlalchemy import text, create_engine
from sqlalchemy.ext.asyncio import create_async_engine

# Add backend directory to sys.path
sys.path.append(r"c:\Users\pabol\OneDrive\Desktop\QuizVersaAI\backend")

from app.database.session import engine

# Get base database URL
from app.config.settings import settings
base_url = settings.async_database_url

# Construct test URL for non-superuser connection
import re
test_url = re.sub(r'postgres:[^@]+', 'test_rls_user:test_rls_password', base_url)

async def test_rls_policies():
    print("[*] Starting RLS Policy Verification Test...")
    
    # 1. Setup test data and temporary role using superuser connection
    async with engine.connect() as super_conn:
        # Idempotent cleanup first
        print("[*] Performing pre-test database cleanup...")
        await super_conn.execute(text("DELETE FROM public.quizzes WHERE title LIKE 'Quiz % (Private)' OR title LIKE 'Quiz % (Public Published)' OR title LIKE 'Quiz % Draft (Private)';"))
        await super_conn.execute(text("DELETE FROM public.users WHERE email IN ('user_a@test.com', 'user_b@test.com');"))
        await super_conn.commit()

        print("[*] Creating test_rls_user login role and granting permissions...")
        await super_conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'test_rls_user') THEN
                    CREATE ROLE test_rls_user WITH LOGIN PASSWORD 'test_rls_password';
                END IF;
            END
            $$;
        """))
        await super_conn.execute(text("GRANT authenticated TO test_rls_user;"))
        await super_conn.execute(text("GRANT USAGE ON SCHEMA public TO test_rls_user;"))
        await super_conn.execute(text("GRANT ALL ON ALL TABLES IN SCHEMA public TO test_rls_user;"))
        await super_conn.execute(text("GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO test_rls_user;"))
        await super_conn.commit()

        # Insert test users, quizzes
        user_a_id = uuid.uuid4()
        user_b_id = uuid.uuid4()
        quiz_a_id = uuid.uuid4()
        quiz_b_id = uuid.uuid4()
        quiz_c_id = uuid.uuid4() # User B draft private quiz

        print(f"[*] Inserting Test User A ({user_a_id}) and User B ({user_b_id})...")
        await super_conn.execute(text("""
            INSERT INTO public.users (id, email, hashed_password, role, is_active, token_version, created_at, updated_at) 
            VALUES 
            (:user_a, 'user_a@test.com', 'hash', 'student', true, 1, now(), now()),
            (:user_b, 'user_b@test.com', 'hash', 'student', true, 1, now(), now());
        """), {"user_a": user_a_id, "user_b": user_b_id})

        print(f"[*] Inserting Test Quizzes (Quiz A: User A Private, Quiz B: User B Public Published, Quiz C: User B Private Draft)...")
        await super_conn.execute(text("""
            INSERT INTO public.quizzes (id, title, subject, duration, randomize_questions, randomize_options, anti_cheating_enabled, ai_feedback_enabled, total_marks, pass_percentage, visibility, status, language, fullscreen_required, adaptive_mode, allow_review, quiz_code, max_attempts, created_by_id, created_at, updated_at)
            VALUES 
            (:quiz_a, 'Quiz A (Private)', 'Math', 10, false, false, false, false, 0, 40.0, 'private', 'draft', 'en', false, false, true, 'CODE-A', 1, :user_a, now(), now()),
            (:quiz_b, 'Quiz B (Public Published)', 'Science', 10, false, false, false, false, 0, 40.0, 'public', 'published', 'en', false, false, true, 'CODE-B', 1, :user_b, now(), now()),
            (:quiz_c, 'Quiz C Draft (Private)', 'History', 10, false, false, false, false, 0, 40.0, 'private', 'draft', 'en', false, false, true, 'CODE-C', 1, :user_b, now(), now());
        """), {"quiz_a": quiz_a_id, "quiz_b": quiz_b_id, "quiz_c": quiz_c_id, "user_a": user_a_id, "user_b": user_b_id})
        await super_conn.commit()

    # 2. Open non-superuser connection and run assertions
    print(f"\n[*] Connecting to database as test_rls_user: {test_url}")
    test_engine = create_async_engine(test_url)
    
    try:
        async with test_engine.connect() as test_conn:
            # Begin test transaction for User A simulation
            test_trans = await test_conn.begin()
            
            # Simulate User A JWT subject
            await test_conn.execute(text(f"SET LOCAL request.jwt.claim.sub = '{user_a_id}';"))
            
            # --- Test 1: User A SELECT users profile ---
            res = await test_conn.execute(text("SELECT email FROM public.users;"))
            visible_emails = [r[0] for r in res.fetchall()]
            print(f"  [Users] Visible profiles to User A: {visible_emails}")
            assert 'user_a@test.com' in visible_emails, "User A should see their own profile!"
            assert 'user_b@test.com' not in visible_emails, "User A should NOT see User B's profile!"
            print("  [PASSED] RLS restricts users SELECT to own profile.")
            
            # --- Test 2: User A UPDATE User B's profile ---
            print("  [Users] Attempting to update User B's profile...")
            res = await test_conn.execute(text(f"UPDATE public.users SET full_name = 'Hacked' WHERE id = '{user_b_id}';"))
            print(f"  [Users] Rows updated: {res.rowcount}")
            assert res.rowcount == 0, "Security Violation: User A was able to update User B's profile!"
            print("  [PASSED] RLS blocks User A from updating User B's profile.")

            # --- Test 3: User A SELECT quizzes ---
            res = await test_conn.execute(text("SELECT title FROM public.quizzes;"))
            visible_quizzes = [r[0] for r in res.fetchall()]
            print(f"  [Quizzes] Visible quizzes to User A: {visible_quizzes}")
            assert "Quiz A (Private)" in visible_quizzes, "User A should see their own private quiz!"
            assert "Quiz B (Public Published)" in visible_quizzes, "User A should see public published quizzes!"
            assert "Quiz C Draft (Private)" not in visible_quizzes, "User A should NOT see User B's private draft quiz!"
            print("  [PASSED] RLS Quiz SELECT logic works correctly.")

            # --- Test 4: User A UPDATE User B's quiz ---
            print("  [Quizzes] Attempting to update User B's quiz...")
            res = await test_conn.execute(text(f"UPDATE public.quizzes SET title = 'Hacked' WHERE id = '{quiz_b_id}';"))
            print(f"  [Quizzes] Rows updated: {res.rowcount}")
            assert res.rowcount == 0, "Security Violation: User A was able to update User B's quiz!"
            print("  [PASSED] RLS blocks User A from updating User B's quiz.")

            await test_trans.rollback()
            
    except AssertionError as ae:
        print(f"\n[FAIL] Assertion failed: {ae}")
        raise ae
    except Exception as e:
        print(f"\n[ERROR] Test execution failed: {e}")
        raise e
    finally:
        await test_engine.dispose()
        
        # 3. Clean up test data and role using superuser connection
        print("\n[*] Cleaning up database test records and roles...")
        async with engine.connect() as super_conn:
            await super_conn.execute(text(f"DELETE FROM public.quizzes WHERE id IN ('{quiz_a_id}', '{quiz_b_id}', '{quiz_c_id}');"))
            await super_conn.execute(text(f"DELETE FROM public.users WHERE id IN ('{user_a_id}', '{user_b_id}');"))
            # Drop dependencies of the role first
            await super_conn.execute(text("DROP OWNED BY test_rls_user;"))
            await super_conn.execute(text("DROP ROLE IF EXISTS test_rls_user;"))
            await super_conn.commit()
            print("[+] Database cleaned successfully.")

if __name__ == "__main__":
    asyncio.run(test_rls_policies())
