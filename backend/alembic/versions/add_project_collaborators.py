"""add project collaborators

Revision ID: add_project_collaborators
Revises: 63bbf16c9217
Create Date: 2025-12-11

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_project_collaborators'
down_revision: Union[str, None] = '63bbf16c9217'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the project_collaborators table
    op.create_table(
        'project_collaborators',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.Enum('READER', 'COMMENTOR', 'EDITOR', 'ADMIN', name='collaboratorrole'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('project_id', 'user_id', name='unique_project_user')
    )
    op.create_index(op.f('ix_project_collaborators_id'), 'project_collaborators', ['id'], unique=False)


def downgrade() -> None:
    # Drop the project_collaborators table
    op.drop_index(op.f('ix_project_collaborators_id'), table_name='project_collaborators')
    op.drop_table('project_collaborators')
    # Drop the enum type
    op.execute('DROP TYPE collaboratorrole')

