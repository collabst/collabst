"""add_path_to_assets

Revision ID: bcd37cf6076e
Revises: d4e9f1b3c6a8
Create Date: 2025-12-17 10:42:11.841183

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'bcd37cf6076e'
down_revision: Union[str, None] = 'd4e9f1b3c6a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add path column to assets table (computed from parent hierarchy like files)
    op.add_column('assets', sa.Column('path', sa.String(), nullable=False, server_default='/'))

    # Index on path for faster lookups
    op.create_index(op.f('ix_assets_path'), 'assets', ['path'], unique=False)


def downgrade() -> None:
    # Drop index
    op.drop_index(op.f('ix_assets_path'), table_name='assets')

    # Drop column
    op.drop_column('assets', 'path')
