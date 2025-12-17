"""Add parent to assets

Revision ID: d4e9f1b3c6a8
Revises: c3f8e9a2b5d7
Create Date: 2025-12-17 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4e9f1b3c6a8'
down_revision: Union[str, None] = 'c3f8e9a2b5d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add parent_id column to assets table
    op.add_column('assets', sa.Column('parent_id', sa.Integer(), nullable=True))

    # Create index for performance
    op.create_index(op.f('ix_assets_parent_id'), 'assets', ['parent_id'], unique=False)

    # Add foreign key constraint with SET NULL on delete (if folder is deleted, asset parent becomes null)
    op.create_foreign_key(
        'fk_assets_parent_id_files',
        'assets',
        'files',
        ['parent_id'],
        ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    # Drop foreign key constraint
    op.drop_constraint('fk_assets_parent_id_files', 'assets', type_='foreignkey')

    # Drop index
    op.drop_index(op.f('ix_assets_parent_id'), table_name='assets')

    # Drop column
    op.drop_column('assets', 'parent_id')
