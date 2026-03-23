"""add comment threads and replies tables

Revision ID: a2c9d8e7f6b5
Revises: f1b2c3d4e5f6
Create Date: 2026-03-20 15:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a2c9d8e7f6b5"
down_revision: Union[str, None] = "f1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "comment_threads",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("hash_id", sa.String(length=20), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("file_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("open", "resolved", "deleted", name="commentthreadstatus"),
            nullable=False,
        ),
        sa.Column("anchor_rel_json", sa.Text(), nullable=True),
        sa.Column("head_rel_json", sa.Text(), nullable=True),
        sa.Column("start_line", sa.Integer(), nullable=True),
        sa.Column("start_col", sa.Integer(), nullable=True),
        sa.Column("end_line", sa.Integer(), nullable=True),
        sa.Column("end_col", sa.Integer(), nullable=True),
        sa.Column("selected_text", sa.Text(), nullable=True),
        sa.Column("text_before", sa.Text(), nullable=True),
        sa.Column("text_after", sa.Text(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("resolved_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["resolved_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_comment_threads_id"), "comment_threads", ["id"], unique=False)
    op.create_index(op.f("ix_comment_threads_hash_id"), "comment_threads", ["hash_id"], unique=True)
    op.create_index(op.f("ix_comment_threads_project_id"), "comment_threads", ["project_id"], unique=False)
    op.create_index(op.f("ix_comment_threads_file_id"), "comment_threads", ["file_id"], unique=False)
    op.create_index(op.f("ix_comment_threads_author_id"), "comment_threads", ["author_id"], unique=False)
    op.create_index(op.f("ix_comment_threads_status"), "comment_threads", ["status"], unique=False)
    op.create_index(op.f("ix_comment_threads_resolved_by_id"), "comment_threads", ["resolved_by_id"], unique=False)

    op.create_table(
        "comment_replies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("hash_id", sa.String(length=20), nullable=False),
        sa.Column("thread_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("active", "deleted", name="commentreplystatus"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["thread_id"], ["comment_threads.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_comment_replies_id"), "comment_replies", ["id"], unique=False)
    op.create_index(op.f("ix_comment_replies_hash_id"), "comment_replies", ["hash_id"], unique=True)
    op.create_index(op.f("ix_comment_replies_thread_id"), "comment_replies", ["thread_id"], unique=False)
    op.create_index(op.f("ix_comment_replies_author_id"), "comment_replies", ["author_id"], unique=False)
    op.create_index(op.f("ix_comment_replies_status"), "comment_replies", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_comment_replies_status"), table_name="comment_replies")
    op.drop_index(op.f("ix_comment_replies_author_id"), table_name="comment_replies")
    op.drop_index(op.f("ix_comment_replies_thread_id"), table_name="comment_replies")
    op.drop_index(op.f("ix_comment_replies_hash_id"), table_name="comment_replies")
    op.drop_index(op.f("ix_comment_replies_id"), table_name="comment_replies")
    op.drop_table("comment_replies")

    op.drop_index(op.f("ix_comment_threads_resolved_by_id"), table_name="comment_threads")
    op.drop_index(op.f("ix_comment_threads_status"), table_name="comment_threads")
    op.drop_index(op.f("ix_comment_threads_author_id"), table_name="comment_threads")
    op.drop_index(op.f("ix_comment_threads_file_id"), table_name="comment_threads")
    op.drop_index(op.f("ix_comment_threads_project_id"), table_name="comment_threads")
    op.drop_index(op.f("ix_comment_threads_hash_id"), table_name="comment_threads")
    op.drop_index(op.f("ix_comment_threads_id"), table_name="comment_threads")
    op.drop_table("comment_threads")

    op.execute("DROP TYPE IF EXISTS commentreplystatus")
    op.execute("DROP TYPE IF EXISTS commentthreadstatus")
