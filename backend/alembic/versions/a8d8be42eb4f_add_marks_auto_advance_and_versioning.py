"""add_marks_auto_advance_and_versioning

Revision ID: a8d8be42eb4f
Revises: '0e5ae4c55511'
Create Date: 2026-08-07 20:31:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a8d8be42eb4f'
down_revision: Union[str, None] = '0e5ae4c55511'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add questions columns
    op.add_column('questions', sa.Column('is_user_modified', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('questions', sa.Column('ai_original_json', sa.Text(), nullable=True))
    op.add_column('questions', sa.Column('shuffle_seed', sa.Integer(), nullable=True))
    
    # 2. Add game_sessions columns
    op.add_column('game_sessions', sa.Column('auto_advance', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('game_sessions', sa.Column('randomized_question_ids', sa.Text(), nullable=True))
    
    # 3. Add quizzes columns
    op.add_column('quizzes', sa.Column('marks_mode', sa.String(length=50), server_default='default', nullable=False))
    op.add_column('quizzes', sa.Column('default_marks', sa.Integer(), server_default='1', nullable=False))


def downgrade() -> None:
    # 1. Drop questions columns
    op.drop_column('questions', 'is_user_modified')
    op.drop_column('questions', 'ai_original_json')
    op.drop_column('questions', 'shuffle_seed')
    
    # 2. Drop game_sessions columns
    op.drop_column('game_sessions', 'auto_advance')
    op.drop_column('game_sessions', 'randomized_question_ids')
    
    # 3. Drop quizzes columns
    op.drop_column('quizzes', 'marks_mode')
    op.drop_column('quizzes', 'default_marks')
