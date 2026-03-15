"""normalize materialtype enum values

Revision ID: 20260316_mat_enum
Revises: 20260315_merge_heads
Create Date: 2026-03-16
"""

from alembic import op
import sqlalchemy as sa


revision = "20260316_mat_enum"
down_revision = "20260315_merge_heads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    existing_values = {
        row[0]
        for row in conn.execute(
            sa.text(
                """
                SELECT e.enumlabel
                FROM pg_type t
                JOIN pg_enum e ON t.oid = e.enumtypid
                WHERE t.typname = 'materialtype'
                """
            )
        ).fetchall()
    }

    if "PDF" in existing_values and "pdf" not in existing_values:
        conn.execute(sa.text("ALTER TYPE materialtype RENAME VALUE 'PDF' TO 'pdf'"))
        existing_values.remove("PDF")
        existing_values.add("pdf")

    if "YOUTUBE" in existing_values and "youtube" not in existing_values:
        conn.execute(sa.text("ALTER TYPE materialtype RENAME VALUE 'YOUTUBE' TO 'youtube'"))
        existing_values.remove("YOUTUBE")
        existing_values.add("youtube")

    required_values = ["article", "rtf", "odt", "epub", "md", "html"]
    for value in required_values:
        if value not in existing_values:
            conn.execute(sa.text(f"ALTER TYPE materialtype ADD VALUE IF NOT EXISTS '{value}'"))


def downgrade() -> None:
    pass
