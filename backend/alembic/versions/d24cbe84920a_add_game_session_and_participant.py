"""add_game_session_and_participant

Revision ID: d24cbe84920a
Revises: e22e96efd1b8
Create Date: 2026-07-31 19:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd24cbe84920a'
down_revision: Union[str, None] = 'e22e96efd1b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create game_sessions table
    op.create_table(
        'game_sessions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('quiz_id', sa.UUID(), nullable=False),
        sa.Column('host_id', sa.UUID(), nullable=False),
        sa.Column('game_pin', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('max_players', sa.Integer(), nullable=False, server_default='50'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['host_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['quiz_id'], ['quizzes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_game_sessions_id'), 'game_sessions', ['id'], unique=False)
    op.create_index(op.f('ix_game_sessions_game_pin'), 'game_sessions', ['game_pin'], unique=True)
    op.create_index(op.f('ix_game_sessions_quiz_id'), 'game_sessions', ['quiz_id'], unique=False)
    op.create_index(op.f('ix_game_sessions_host_id'), 'game_sessions', ['host_id'], unique=False)

    # 2. Create participants table
    op.create_table(
        'participants',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('session_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('nickname', sa.String(length=255), nullable=False),
        sa.Column('score', sa.Float(), nullable=False),
        sa.Column('joined_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('connected', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['game_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('session_id', 'nickname', name='_session_nickname_uc')
    )
    op.create_index(op.f('ix_participants_id'), 'participants', ['id'], unique=False)
    op.create_index(op.f('ix_participants_session_id'), 'participants', ['session_id'], unique=False)
    op.create_index(op.f('ix_participants_user_id'), 'participants', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_participants_user_id'), table_name='participants')
    op.drop_index(op.f('ix_participants_session_id'), table_name='participants')
    op.drop_index(op.f('ix_participants_id'), table_name='participants')
    op.drop_table('participants')
    op.drop_index(op.f('ix_game_sessions_host_id'), table_name='game_sessions')
    op.drop_index(op.f('ix_game_sessions_quiz_id'), table_name='game_sessions')
    op.drop_index(op.f('ix_game_sessions_game_pin'), table_name='game_sessions')
    op.drop_index(op.f('ix_game_sessions_id'), table_name='game_sessions')
    op.drop_table('game_sessions')
