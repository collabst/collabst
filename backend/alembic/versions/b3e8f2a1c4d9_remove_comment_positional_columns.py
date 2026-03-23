"""remove comment positional columns

Revision ID: b3e8f2a1c4d9
Revises: a2c9d8e7f6b5
Create Date: 2026-03-23 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b3e8f2a1c4d9"
down_revision: Union[str, None] = "a2c9d8e7f6b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("comment_threads", "start_line")
    op.drop_column("comment_threads", "start_col")
    op.drop_column("comment_threads", "end_line")
    op.drop_column("comment_threads", "end_col")
    op.drop_column("comment_threads", "selected_text")
    op.drop_column("comment_threads", "text_before")
    op.drop_column("comment_threads", "text_after")


def downgrade() -> None:
    op.add_column("comment_threads", sa.Column("text_after", sa.Text(), nullable=True))
    op.add_column("comment_threads", sa.Column("text_before", sa.Text(), nullable=True))
    op.add_column("comment_threads", sa.Column("selected_text", sa.Text(), nullable=True))
    op.add_column("comment_threads", sa.Column("end_col", sa.Integer(), nullable=True))
    op.add_column("comment_threads", sa.Column("end_line", sa.Integer(), nullable=True))
    op.add_column("comment_threads", sa.Column("start_col", sa.Integer(), nullable=True))
    op.add_column("comment_threads", sa.Column("start_line", sa.Integer(), nullable=True))
