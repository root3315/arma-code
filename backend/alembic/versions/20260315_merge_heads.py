"""merge quiz explanation and project heads

Revision ID: 20260315_merge_heads
Revises: add_quiz_question_explanation, e6b27f198c08
Create Date: 2026-03-15
"""

from typing import Sequence, Union


revision: str = "20260315_merge_heads"
down_revision: Union[str, Sequence[str], None] = (
    "add_quiz_question_explanation",
    "e6b27f198c08",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
