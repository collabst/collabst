"""drop file type column

Revision ID: c8a1e2d3f4a5
Revises: b3e8f2a1c4d9
Create Date: 2026-03-24 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c8a1e2d3f4a5'
down_revision: Union[str, None] = 'b3e8f2a1c4d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('files', 'type')

    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute('DROP TYPE IF EXISTS filetype')


def downgrade() -> None:
    filetype_enum = sa.Enum('TYPST', 'TEXT', 'YAML', 'JSON', 'OTHER', name='filetype')
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        filetype_enum.create(bind, checkfirst=True)

    op.add_column(
        'files',
        sa.Column('type', filetype_enum, nullable=False, server_default='TYPST'),
    )
