"""add user profile picture path

Revision ID: e9a1d2c3b4f5
Revises: bcd37cf6076e
Create Date: 2026-03-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e9a1d2c3b4f5'
down_revision: Union[str, None] = 'bcd37cf6076e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('profile_picture_path', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'profile_picture_path')
