"""add_quiz_created_by_id_index

Revision ID: 7c97a631f6b5
Revises: '432ae0c76743'
Create Date: 2026-07-29 07:14:01.984293

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c97a631f6b5'
down_revision: Union[str, None] = '432ae0c76743'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(op.f('ix_quizzes_created_by_id'), 'quizzes', ['created_by_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_quizzes_created_by_id'), table_name='quizzes')
