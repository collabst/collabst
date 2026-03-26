"""add user polymorphism and guest shares

Revision ID: e2a4b6c8d0f1
Revises: d9f1a2b3c4d5
Create Date: 2026-03-26 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e2a4b6c8d0f1"
down_revision: Union[str, None] = "d9f1a2b3c4d5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("user_type", sa.String(length=20), nullable=True, server_default="auth"))
    op.execute("UPDATE users SET user_type = 'auth' WHERE user_type IS NULL")
    op.alter_column("users", "user_type", nullable=False)
    op.create_index(op.f("ix_users_user_type"), "users", ["user_type"], unique=False)

    op.alter_column("users", "email", existing_type=sa.String(), nullable=True)
    op.alter_column("users", "hashed_password", existing_type=sa.String(), nullable=True)

    op.create_table(
        "guest_shares",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("hash_id", sa.String(length=20), nullable=False),
        sa.Column("guest_user_id", sa.Integer(), nullable=False),
        sa.Column("project_share_link_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["guest_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_share_link_id"], ["project_share_links.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("guest_user_id", "project_share_link_id", name="uq_guest_share_user_link"),
    )
    op.create_index(op.f("ix_guest_shares_id"), "guest_shares", ["id"], unique=False)
    op.create_index(op.f("ix_guest_shares_hash_id"), "guest_shares", ["hash_id"], unique=True)
    op.create_index(op.f("ix_guest_shares_guest_user_id"), "guest_shares", ["guest_user_id"], unique=False)
    op.create_index(op.f("ix_guest_shares_project_share_link_id"), "guest_shares", ["project_share_link_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_guest_shares_project_share_link_id"), table_name="guest_shares")
    op.drop_index(op.f("ix_guest_shares_guest_user_id"), table_name="guest_shares")
    op.drop_index(op.f("ix_guest_shares_hash_id"), table_name="guest_shares")
    op.drop_index(op.f("ix_guest_shares_id"), table_name="guest_shares")
    op.drop_table("guest_shares")

    op.alter_column("users", "hashed_password", existing_type=sa.String(), nullable=False)
    op.alter_column("users", "email", existing_type=sa.String(), nullable=False)

    op.drop_index(op.f("ix_users_user_type"), table_name="users")
    op.drop_column("users", "user_type")
