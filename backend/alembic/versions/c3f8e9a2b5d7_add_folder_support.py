"""Add folder support

Revision ID: c3f8e9a2b5d7
Revises: 9d17ab4c17a8
Create Date: 2025-12-17 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3f8e9a2b5d7'
down_revision: Union[str, None] = '816cd97554e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add parent_id column (nullable, for self-referential foreign key)
    op.add_column('files', sa.Column('parent_id', sa.Integer(), nullable=True))

    # Add is_folder column (non-nullable, default False)
    op.add_column('files', sa.Column('is_folder', sa.Boolean(), nullable=False, server_default=sa.false()))

    # Create indexes for performance
    op.create_index(op.f('ix_files_parent_id'), 'files', ['parent_id'], unique=False)
    op.create_index(op.f('ix_files_is_folder'), 'files', ['is_folder'], unique=False)

    # Add foreign key constraint with CASCADE delete
    op.create_foreign_key(
        'fk_files_parent_id_files',
        'files',
        'files',
        ['parent_id'],
        ['id'],
        ondelete='CASCADE'
    )

    # Add unique constraint: no duplicate names in same directory
    op.create_unique_constraint(
        'unique_name_in_directory',
        'files',
        ['project_id', 'parent_id', 'name']
    )

    # Add check constraint: folders must have empty content
    op.create_check_constraint(
        'folders_no_content',
        'files',
        "is_folder = false OR content = ''"
    )


def downgrade() -> None:
    # Drop constraints first
    op.drop_constraint('folders_no_content', 'files', type_='check')
    op.drop_constraint('unique_name_in_directory', 'files', type_='unique')
    op.drop_constraint('fk_files_parent_id_files', 'files', type_='foreignkey')

    # Drop indexes
    op.drop_index(op.f('ix_files_is_folder'), table_name='files')
    op.drop_index(op.f('ix_files_parent_id'), table_name='files')

    # Drop columns
    op.drop_column('files', 'is_folder')
    op.drop_column('files', 'parent_id')
