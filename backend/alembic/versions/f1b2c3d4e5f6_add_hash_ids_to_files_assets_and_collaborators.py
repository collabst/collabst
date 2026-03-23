"""add hash ids to files assets and collaborators

Revision ID: f1b2c3d4e5f6
Revises: e9a1d2c3b4f5
Create Date: 2026-03-20 12:00:00.000000

"""
from typing import Sequence, Union
import secrets

from alembic import op
import sqlalchemy as sa


revision: str = 'f1b2c3d4e5f6'
down_revision: Union[str, None] = 'e9a1d2c3b4f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


users_table = sa.table(
    'users',
    sa.column('id', sa.Integer),
    sa.column('hash_id', sa.String),
)

projects_table = sa.table(
    'projects',
    sa.column('id', sa.Integer),
    sa.column('hash_id', sa.String),
)

invitations_table = sa.table(
    'invitations',
    sa.column('id', sa.Integer),
    sa.column('hash_id', sa.String),
)

files_table = sa.table(
    'files',
    sa.column('id', sa.Integer),
    sa.column('hash_id', sa.String),
)

assets_table = sa.table(
    'assets',
    sa.column('id', sa.Integer),
    sa.column('hash_id', sa.String),
)

collaborators_table = sa.table(
    'project_collaborators',
    sa.column('id', sa.Integer),
    sa.column('hash_id', sa.String),
)


def _generate_hash_id(length: int = 20) -> str:
    token = secrets.token_urlsafe(length)
    return token[:length]


def _populate_hash_ids(connection: sa.Connection, table: sa.Table) -> None:
    rows = connection.execute(sa.select(table.c.id)).fetchall()
    for row in rows:
        hash_id = _generate_hash_id()
        while connection.execute(sa.select(table.c.id).where(table.c.hash_id == hash_id)).fetchone() is not None:
            hash_id = _generate_hash_id()

        connection.execute(
            table.update().where(table.c.id == row.id).values(hash_id=hash_id)
        )


def upgrade() -> None:
    op.add_column('users', sa.Column('hash_id', sa.String(length=20), nullable=True))
    op.add_column('projects', sa.Column('hash_id', sa.String(length=20), nullable=True))
    op.add_column('invitations', sa.Column('hash_id', sa.String(length=20), nullable=True))
    op.add_column('files', sa.Column('hash_id', sa.String(length=20), nullable=True))
    op.add_column('assets', sa.Column('hash_id', sa.String(length=20), nullable=True))
    op.add_column('project_collaborators', sa.Column('hash_id', sa.String(length=20), nullable=True))

    connection = op.get_bind()
    _populate_hash_ids(connection, users_table)
    _populate_hash_ids(connection, projects_table)
    _populate_hash_ids(connection, invitations_table)
    _populate_hash_ids(connection, files_table)
    _populate_hash_ids(connection, assets_table)
    _populate_hash_ids(connection, collaborators_table)

    op.alter_column('users', 'hash_id', nullable=False)
    op.alter_column('projects', 'hash_id', nullable=False)
    op.alter_column('invitations', 'hash_id', nullable=False)
    op.alter_column('files', 'hash_id', nullable=False)
    op.alter_column('assets', 'hash_id', nullable=False)
    op.alter_column('project_collaborators', 'hash_id', nullable=False)

    op.create_index(op.f('ix_users_hash_id'), 'users', ['hash_id'], unique=True)
    op.create_index(op.f('ix_projects_hash_id'), 'projects', ['hash_id'], unique=True)
    op.create_index(op.f('ix_invitations_hash_id'), 'invitations', ['hash_id'], unique=True)
    op.create_index(op.f('ix_files_hash_id'), 'files', ['hash_id'], unique=True)
    op.create_index(op.f('ix_assets_hash_id'), 'assets', ['hash_id'], unique=True)
    op.create_index(op.f('ix_project_collaborators_hash_id'), 'project_collaborators', ['hash_id'], unique=True)

    op.create_table(
        'project_share_links',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('hash', sa.String(length=48), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('link_type', sa.Enum('READ', 'COMMENT', 'EDIT', name='sharelinktype'), nullable=False),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('project_id', 'link_type', name='uq_project_share_link_type'),
    )
    op.create_index(op.f('ix_project_share_links_id'), 'project_share_links', ['id'], unique=False)
    op.create_index(op.f('ix_project_share_links_hash'), 'project_share_links', ['hash'], unique=True)
    op.create_index(op.f('ix_project_share_links_project_id'), 'project_share_links', ['project_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_project_collaborators_hash_id'), table_name='project_collaborators')
    op.drop_index(op.f('ix_assets_hash_id'), table_name='assets')
    op.drop_index(op.f('ix_files_hash_id'), table_name='files')
    op.drop_index(op.f('ix_invitations_hash_id'), table_name='invitations')
    op.drop_index(op.f('ix_projects_hash_id'), table_name='projects')
    op.drop_index(op.f('ix_users_hash_id'), table_name='users')

    op.drop_column('project_collaborators', 'hash_id')
    op.drop_column('assets', 'hash_id')
    op.drop_column('files', 'hash_id')
    op.drop_column('invitations', 'hash_id')
    op.drop_column('projects', 'hash_id')
    op.drop_column('users', 'hash_id')
    op.drop_table('project_share_links')
