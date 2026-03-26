"""replace username with display_name

Revision ID: d9f1a2b3c4d5
Revises: c8a1e2d3f4a5
Create Date: 2026-03-26 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd9f1a2b3c4d5'
down_revision: Union[str, None] = 'c8a1e2d3f4a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.alter_column('users', 'username', new_column_name='display_name')


def downgrade() -> None:
    op.alter_column('users', 'display_name', new_column_name='username')
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)
