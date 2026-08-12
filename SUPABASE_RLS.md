# Supabase Row Level Security (RLS) Database Security Specification

This document details the Row Level Security (RLS) configuration, policies, and local/production design conventions for QuizVerse AI's PostgreSQL database.

---

## 1. Protected Tables & RLS Status
Row Level Security is enabled on all 7 tables in the `public` schema. All anonymous and authenticated roles querying via PostgREST (the public Supabase API) are subject to RLS restrictions.

| Table Name | RLS Enabled | Policies Active | Primary Restriction |
| :--- | :--- | :--- | :--- |
| `users` | Yes | 2 | Users can only select/update their own profile. |
| `quizzes` | Yes | 4 | Owners can perform all CRUD; others can only select public published quizzes. |
| `questions` | Yes | 4 | Mutating questions is restricted to the quiz owner. |
| `question_options` | Yes | 4 | Mutating question options is restricted to the quiz owner. |
| `login_history` | Yes | 2 | Users can only select/insert their own login history. |
| `quiz_attempts` | Yes | 4 | Users can view/create own attempts; teachers can view attempts on owned quizzes. |
| `document_chunks` | Yes | 4 | Restricted only to users with the role of `teacher` or `admin`. |

---

## 2. Policy Specifications & SQL Implementation

### `public.users`
- **Read (SELECT)**: `id = auth.uid()`
- **Update (UPDATE)**: `id = auth.uid()`

### `public.quizzes`
- **Read (SELECT)**: `created_by_id = auth.uid() OR (visibility = 'public' AND status = 'published')`
- **Write (INSERT)**: `created_by_id = auth.uid()` (WITH CHECK)
- **Update (UPDATE)**: `created_by_id = auth.uid()`
- **Delete (DELETE)**: `created_by_id = auth.uid()`

### `public.questions`
- **Read (SELECT)**:
  ```sql
  EXISTS (
      SELECT 1 FROM public.quizzes q 
      WHERE q.id = questions.quiz_id 
      AND (q.created_by_id = auth.uid() OR (q.visibility = 'public' AND q.status = 'published'))
  )
  ```
- **Write/Update/Delete (INSERT/UPDATE/DELETE)**:
  ```sql
  EXISTS (
      SELECT 1 FROM public.quizzes q 
      WHERE q.id = questions.quiz_id AND q.created_by_id = auth.uid()
  )
  ```

### `public.question_options`
- **Read (SELECT)**:
  ```sql
  EXISTS (
      SELECT 1 FROM public.questions q 
      JOIN public.quizzes qz ON qz.id = q.quiz_id 
      WHERE q.id = question_options.question_id 
      AND (qz.created_by_id = auth.uid() OR (qz.visibility = 'public' AND qz.status = 'published'))
  )
  ```
- **Write/Update/Delete (INSERT/UPDATE/DELETE)**:
  ```sql
  EXISTS (
      SELECT 1 FROM public.questions q 
      JOIN public.quizzes qz ON qz.id = q.quiz_id 
      WHERE q.id = question_options.question_id AND qz.created_by_id = auth.uid()
  )
  ```

### `public.login_history`
- **Read (SELECT)**: `user_id = auth.uid()`
- **Write (INSERT)**: `user_id = auth.uid()`

### `public.quiz_attempts`
- **Read (SELECT)**:
  ```sql
  user_id = auth.uid() 
  OR EXISTS (
      SELECT 1 FROM public.quizzes q 
      WHERE q.id = quiz_attempts.quiz_id AND q.created_by_id = auth.uid()
  )
  ```
- **Write (INSERT)**: `user_id = auth.uid()`
- **Update (UPDATE)**: `user_id = auth.uid()`
- **Delete (DELETE)**:
  ```sql
  user_id = auth.uid() 
  OR EXISTS (
      SELECT 1 FROM public.quizzes q 
      WHERE q.id = quiz_attempts.quiz_id AND q.created_by_id = auth.uid()
  )
  ```

### `public.document_chunks`
- **CRUD (SELECT/INSERT/UPDATE/DELETE)**:
  ```sql
  EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role IN ('teacher', 'admin')
  )
  ```

---

## 3. Performance & Indexing
To ensure policies evaluate rapidly without full table scans, the following indexes are active in the database:
- `ix_quizzes_created_by_id` on `quizzes(created_by_id)` (Optimizes quiz ownership checks)
- `ix_questions_quiz_id` on `questions(quiz_id)` (Optimizes question quiz mapping)
- `ix_question_options_question_id` on `question_options(question_id)` (Optimizes options parent mappings)
- `ix_quiz_attempts_quiz_id` on `quiz_attempts(quiz_id)` (Optimizes attempt checks)
- `ix_quiz_attempts_user_id` on `quiz_attempts(user_id)` (Optimizes student results filtering)
- `ix_login_history_user_id` on `login_history(user_id)` (Optimizes session audit lookups)

---

## 4. Local Development Compatibility Layer
The local development database uses a plain PostgreSQL database instance (running on Windows, port 5432). This instance does not natively contain Supabase's `auth` schema, roles (`anon`, `authenticated`, `service_role`), or `auth.uid()` functions.

To prevent local Alembic migrations from crashing, we added a compatibility check inside [backend/alembic/env.py](file:///c:/Users/pabol/OneDrive/Desktop/QuizVersaAI/backend/alembic/env.py):
1. **Dynamic Schema & Role Setup**: Before running migrations, `env.py` checks if the `auth` schema exists in the database.
2. **If Schema is Missing (Local Dev)**: It dynamically creates the `auth` schema, a mock `auth.uid()` function (returning a mock UUID or session parameter context), and roles `anon`, `authenticated`, and `service_role`.
3. **If Schema is Present (Production Supabase)**: The check returns true, and the setup is skipped completely. This ensures production deployment runs pure Supabase RLS migrations without introducing mock entities.

---

## 5. Deployment Notes
- **FastAPI Backend bypass**: The FastAPI backend connects to the database as the database owner `postgres` superuser. In PostgreSQL, owners and superusers bypass RLS policies by default. Backend CRUD operations continue to function natively, independent of database-level session settings.
- **Supabase API Protection**: RLS is explicitly designed to lock down direct REST access via PostgREST endpoints. Enabling RLS blocks anonymous access and prevents authenticated users from querying databases outside of API limits.

---

## 6. Guidelines for Adding Policies to New Tables
When adding a new table to the schema:
1. Enable RLS inside the new Alembic migration using:
   `op.execute("ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;")`
2. Create granular policies (one `op.execute()` call per policy to prevent asyncpg multi-statement parsing errors):
   ```python
   op.execute("""
       CREATE POLICY "Allow users to read their own records" 
       ON public.new_table FOR SELECT TO authenticated
       USING (user_id = auth.uid());
   """)
   ```
3. Add appropriate indexes to foreign key or ownership lookup columns (e.g. `user_id`, `created_by_id`) inside the migration to ensure high-performance RLS check evaluations.
