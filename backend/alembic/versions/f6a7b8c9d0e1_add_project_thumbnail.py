"""add project thumbnail

Revision ID: f6a7b8c9d0e1
Revises: c5d8a3b7e9f1
Create Date: 2026-05-26 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "c5d8a3b7e9f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("thumbnail_storage_path", sa.String(), nullable=True))
    op.add_column("projects", sa.Column("thumbnail_updated_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "thumbnail_updated_at")
    op.drop_column("projects", "thumbnail_storage_path")
