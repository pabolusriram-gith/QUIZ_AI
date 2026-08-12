"""add_performance_indexes

Revision ID: 2e101a95b4cd
Revises: 54c5ce613363
Create Date: 2026-07-25 17:11:47.162781

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2e101a95b4cd'
down_revision: Union[str, None] = '54c5ce613363'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create indexes only to optimize queries without altering column types which SQLite doesn't support
    op.create_index(op.f('ix_question_options_question_id'), 'question_options', ['question_id'], unique=False)
    op.create_index(op.f('ix_questions_quiz_id'), 'questions', ['quiz_id'], unique=False)
    op.create_index(op.f('ix_quiz_attempts_quiz_id'), 'quiz_attempts', ['quiz_id'], unique=False)
    op.create_index(op.f('ix_quiz_attempts_user_id'), 'quiz_attempts', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_quiz_attempts_user_id'), table_name='quiz_attempts')
    op.drop_index(op.f('ix_quiz_attempts_quiz_id'), table_name='quiz_attempts')
    op.drop_index(op.f('ix_questions_quiz_id'), table_name='questions')
    op.drop_index(op.f('ix_question_options_question_id'), table_name='question_options')
