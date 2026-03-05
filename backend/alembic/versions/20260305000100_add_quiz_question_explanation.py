"""Add explanation field to quiz questions

Revision ID: add_quiz_question_explanation
Revises: change_correct_option_text
Create Date: 2026-03-05
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_quiz_question_explanation'
down_revision = 'change_correct_option_text'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('quiz_questions', sa.Column('explanation', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('quiz_questions', 'explanation')
