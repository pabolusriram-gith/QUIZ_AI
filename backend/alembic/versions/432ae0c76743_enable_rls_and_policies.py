"""enable_rls_and_policies

Revision ID: 432ae0c76743
Revises: '34cbbe4e6c1c'
Create Date: 2026-07-29 07:04:48.792096

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '432ae0c76743'
down_revision: Union[str, None] = '34cbbe4e6c1c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Enable RLS on all 7 tables
    tables = [
        "users",
        "quizzes",
        "questions",
        "question_options",
        "login_history",
        "quiz_attempts",
        "document_chunks"
    ]
    for t in tables:
        op.execute(f"ALTER TABLE public.{t} ENABLE ROW LEVEL SECURITY;")

    # 2. Users table policies
    op.execute("""
        CREATE POLICY "Allow users to read their own profile" 
        ON public.users FOR SELECT 
        TO authenticated
        USING (id = auth.uid());
    """)
    op.execute("""
        CREATE POLICY "Allow users to update their own profile" 
        ON public.users FOR UPDATE 
        TO authenticated
        USING (id = auth.uid())
        WITH CHECK (id = auth.uid());
    """)

    # 3. Quizzes table policies
    op.execute("""
        CREATE POLICY "Allow users to read owned or public published quizzes" 
        ON public.quizzes FOR SELECT 
        TO authenticated, anon
        USING (created_by_id = auth.uid() OR (visibility = 'public' AND status = 'published'));
    """)
    op.execute("""
        CREATE POLICY "Allow users to insert their own quizzes" 
        ON public.quizzes FOR INSERT 
        TO authenticated
        WITH CHECK (created_by_id = auth.uid());
    """)
    op.execute("""
        CREATE POLICY "Allow users to update their own quizzes" 
        ON public.quizzes FOR UPDATE 
        TO authenticated
        USING (created_by_id = auth.uid())
        WITH CHECK (created_by_id = auth.uid());
    """)
    op.execute("""
        CREATE POLICY "Allow users to delete their own quizzes" 
        ON public.quizzes FOR DELETE 
        TO authenticated
        USING (created_by_id = auth.uid());
    """)

    # 4. Questions table policies
    op.execute("""
        CREATE POLICY "Allow users to read questions of accessible quizzes" 
        ON public.questions FOR SELECT 
        TO authenticated, anon
        USING (EXISTS (
            SELECT 1 FROM public.quizzes q 
            WHERE q.id = questions.quiz_id 
            AND (q.created_by_id = auth.uid() OR (q.visibility = 'public' AND q.status = 'published'))
        ));
    """)
    op.execute("""
        CREATE POLICY "Allow users to insert questions into owned quizzes" 
        ON public.questions FOR INSERT 
        TO authenticated
        WITH CHECK (EXISTS (
            SELECT 1 FROM public.quizzes q 
            WHERE q.id = questions.quiz_id AND q.created_by_id = auth.uid()
        ));
    """)
    op.execute("""
        CREATE POLICY "Allow users to update questions of owned quizzes" 
        ON public.questions FOR UPDATE 
        TO authenticated
        USING (EXISTS (
            SELECT 1 FROM public.quizzes q 
            WHERE q.id = questions.quiz_id AND q.created_by_id = auth.uid()
        ))
        WITH CHECK (EXISTS (
            SELECT 1 FROM public.quizzes q 
            WHERE q.id = questions.quiz_id AND q.created_by_id = auth.uid()
        ));
    """)
    op.execute("""
        CREATE POLICY "Allow users to delete questions of owned quizzes" 
        ON public.questions FOR DELETE 
        TO authenticated
        USING (EXISTS (
            SELECT 1 FROM public.quizzes q 
            WHERE q.id = questions.quiz_id AND q.created_by_id = auth.uid()
        ));
    """)

    # 5. Question Options table policies
    op.execute("""
        CREATE POLICY "Allow users to read options of questions in accessible quizzes" 
        ON public.question_options FOR SELECT 
        TO authenticated, anon
        USING (EXISTS (
            SELECT 1 FROM public.questions q 
            JOIN public.quizzes qz ON qz.id = q.quiz_id 
            WHERE q.id = question_options.question_id 
            AND (qz.created_by_id = auth.uid() OR (qz.visibility = 'public' AND qz.status = 'published'))
        ));
    """)
    op.execute("""
        CREATE POLICY "Allow users to insert options for questions in owned quizzes" 
        ON public.question_options FOR INSERT 
        TO authenticated
        WITH CHECK (EXISTS (
            SELECT 1 FROM public.questions q 
            JOIN public.quizzes qz ON qz.id = q.quiz_id 
            WHERE q.id = question_options.question_id AND qz.created_by_id = auth.uid()
        ));
    """)
    op.execute("""
        CREATE POLICY "Allow users to update options of questions in owned quizzes" 
        ON public.question_options FOR UPDATE 
        TO authenticated
        USING (EXISTS (
            SELECT 1 FROM public.questions q 
            JOIN public.quizzes qz ON qz.id = q.quiz_id 
            WHERE q.id = question_options.question_id AND qz.created_by_id = auth.uid()
        ))
        WITH CHECK (EXISTS (
            SELECT 1 FROM public.questions q 
            JOIN public.quizzes qz ON qz.id = q.quiz_id 
            WHERE q.id = question_options.question_id AND qz.created_by_id = auth.uid()
        ));
    """)
    op.execute("""
        CREATE POLICY "Allow users to delete options of questions in owned quizzes" 
        ON public.question_options FOR DELETE 
        TO authenticated
        USING (EXISTS (
            SELECT 1 FROM public.questions q 
            JOIN public.quizzes qz ON qz.id = q.quiz_id 
            WHERE q.id = question_options.question_id AND qz.created_by_id = auth.uid()
        ));
    """)

    # 6. Login History table policies
    op.execute("""
        CREATE POLICY "Allow users to view their own login history" 
        ON public.login_history FOR SELECT 
        TO authenticated
        USING (user_id = auth.uid());
    """)
    op.execute("""
        CREATE POLICY "Allow users to insert their own login history" 
        ON public.login_history FOR INSERT 
        TO authenticated
        WITH CHECK (user_id = auth.uid());
    """)

    # 7. Quiz Attempts table policies
    op.execute("""
        CREATE POLICY "Allow users to read their own attempts or attempts on quizzes they created" 
        ON public.quiz_attempts FOR SELECT 
        TO authenticated
        USING (
            user_id = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM public.quizzes q 
                WHERE q.id = quiz_attempts.quiz_id AND q.created_by_id = auth.uid()
            )
        );
    """)
    op.execute("""
        CREATE POLICY "Allow users to insert their own attempts" 
        ON public.quiz_attempts FOR INSERT 
        TO authenticated
        WITH CHECK (user_id = auth.uid());
    """)
    op.execute("""
        CREATE POLICY "Allow users to update their own attempts" 
        ON public.quiz_attempts FOR UPDATE 
        TO authenticated
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid());
    """)
    op.execute("""
        CREATE POLICY "Allow users/creators to delete attempts" 
        ON public.quiz_attempts FOR DELETE 
        TO authenticated
        USING (
            user_id = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM public.quizzes q 
                WHERE q.id = quiz_attempts.quiz_id AND q.created_by_id = auth.uid()
            )
        );
    """)

    # 8. Document Chunks table policies
    op.execute("""
        CREATE POLICY "Allow teachers/admins to read document chunks" 
        ON public.document_chunks FOR SELECT 
        TO authenticated
        USING (EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.id = auth.uid() AND u.role IN ('teacher', 'admin')
        ));
    """)
    op.execute("""
        CREATE POLICY "Allow teachers/admins to insert document chunks" 
        ON public.document_chunks FOR INSERT 
        TO authenticated
        WITH CHECK (EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.id = auth.uid() AND u.role IN ('teacher', 'admin')
        ));
    """)
    op.execute("""
        CREATE POLICY "Allow teachers/admins to update document chunks" 
        ON public.document_chunks FOR UPDATE 
        TO authenticated
        USING (EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.id = auth.uid() AND u.role IN ('teacher', 'admin')
        ))
        WITH CHECK (EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.id = auth.uid() AND u.role IN ('teacher', 'admin')
        ));
    """)
    op.execute("""
        CREATE POLICY "Allow teachers/admins to delete document chunks" 
        ON public.document_chunks FOR DELETE 
        TO authenticated
        USING (EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.id = auth.uid() AND u.role IN ('teacher', 'admin')
        ));
    """)


def downgrade() -> None:
    tables = [
        "users",
        "quizzes",
        "questions",
        "question_options",
        "login_history",
        "quiz_attempts",
        "document_chunks"
    ]
    for t in tables:
        op.execute(f"ALTER TABLE public.{t} DISABLE ROW LEVEL SECURITY;")
        op.execute(f"""
            DO $$
            DECLARE
                pol record;
            BEGIN
                FOR pol IN 
                    SELECT policyname FROM pg_policies 
                    WHERE schemaname = 'public' AND tablename = '{t}'
                LOOP
                    EXECUTE 'DROP POLICY ' || quote_ident(pol.policyname) || ' ON public.{t};';
                END LOOP;
            END
            $$;
        """)
