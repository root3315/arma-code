"""create project_progress table

Revision ID: 20260406_create_project_progress
Revises: 20260321_merge_heads
Create Date: 2026-04-06 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20260406_create_project_progress'
down_revision: Union[str, None] = '20260324_adaptive_learning'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'project_progress',
        sa.Column('id', sa.UUID(), primary_key=True, default=sa.text('gen_random_uuid()')),
        sa.Column('project_id', sa.UUID(), nullable=False, index=True, unique=True),
        sa.Column('user_id', sa.UUID(), nullable=False, index=True),
        # Summary stage
        sa.Column('summary_read', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('summary_read_at', sa.DateTime(), nullable=True),
        # Flashcards stage
        sa.Column('flashcards_unlocked', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('flashcards_unlocked_at', sa.DateTime(), nullable=True),
        sa.Column('flashcards_completed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('flashcards_completed_at', sa.DateTime(), nullable=True),
        # Quiz stage
        sa.Column('quiz_unlocked', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('quiz_unlocked_at', sa.DateTime(), nullable=True),
        sa.Column('quiz_completed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('quiz_completed_at', sa.DateTime(), nullable=True),
        sa.Column('quiz_best_score', sa.Integer(), nullable=True),
        # Timestamps
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.Index('idx_project_progress_user', 'user_id'),
    )


def downgrade() -> None:
    op.drop_table('project_progress')
