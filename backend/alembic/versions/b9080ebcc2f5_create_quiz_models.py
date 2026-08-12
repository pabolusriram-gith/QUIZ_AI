"""create_quiz_models

Revision ID: b9080ebcc2f5
Revises: '46e60b2305fd'
Create Date: 2026-07-22 12:23:43.098602

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b9080ebcc2f5'
down_revision: Union[str, None] = '46e60b2305fd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create quizzes table
    op.create_table(
        'quizzes',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('subject', sa.String(length=255), nullable=False),
        sa.Column('duration', sa.Integer(), nullable=False),
        sa.Column('randomize_questions', sa.Boolean(), nullable=False),
        sa.Column('randomize_options', sa.Boolean(), nullable=False),
        sa.Column('anti_cheating_enabled', sa.Boolean(), nullable=False),
        sa.Column('ai_feedback_enabled', sa.Boolean(), nullable=False),
        sa.Column('department', sa.String(length=255), nullable=True),
        sa.Column('semester', sa.String(length=50), nullable=True),
        sa.Column('total_marks', sa.Integer(), nullable=False),
        sa.Column('pass_percentage', sa.Float(), nullable=False),
        sa.Column('visibility', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('language', sa.String(length=50), nullable=False),
        sa.Column('fullscreen_required', sa.Boolean(), nullable=False),
        sa.Column('adaptive_mode', sa.Boolean(), nullable=False),
        sa.Column('allow_review', sa.Boolean(), nullable=False),
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('quiz_code', sa.String(length=100), nullable=False),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('max_attempts', sa.Integer(), nullable=False),
        sa.Column('created_by_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_quizzes_id'), 'quizzes', ['id'], unique=False)
    op.create_index(op.f('ix_quizzes_quiz_code'), 'quizzes', ['quiz_code'], unique=True)

    # 2. Create questions table
    op.create_table(
        'questions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('quiz_id', sa.UUID(), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('difficulty', sa.String(length=50), nullable=False),
        sa.Column('topic', sa.String(length=255), nullable=False),
        sa.Column('marks', sa.Integer(), nullable=False),
        sa.Column('explanation', sa.Text(), nullable=True),
        sa.Column('question_type', sa.String(length=50), nullable=False),
        sa.Column('bloom_level', sa.String(length=50), nullable=True),
        sa.Column('subtopic', sa.String(length=255), nullable=True),
        sa.Column('estimated_time', sa.Integer(), nullable=True),
        sa.Column('negative_marks', sa.Float(), nullable=False),
        sa.Column('hint', sa.Text(), nullable=True),
        sa.Column('ai_generated', sa.Boolean(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['quiz_id'], ['quizzes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_questions_id'), 'questions', ['id'], unique=False)

    # 3. Create question_options table
    op.create_table(
        'question_options',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('question_id', sa.UUID(), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('is_correct', sa.Boolean(), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_question_options_id'), 'question_options', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_question_options_id'), table_name='question_options')
    op.drop_table('question_options')
    op.drop_index(op.f('ix_questions_id'), table_name='questions')
    op.drop_table('questions')
    op.drop_index(op.f('ix_quizzes_quiz_code'), table_name='quizzes')
    op.drop_index(op.f('ix_quizzes_id'), table_name='quizzes')
    op.drop_table('quizzes')

