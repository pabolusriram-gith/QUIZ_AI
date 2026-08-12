"""add_critic_score_to_questions

Revision ID: e22e96efd1b8
Revises: '7c97a631f6b5'
Create Date: 2026-07-30 19:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e22e96efd1b8'
down_revision: Union[str, None] = '7c97a631f6b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('questions', sa.Column('critic_score', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('questions', 'critic_score')
