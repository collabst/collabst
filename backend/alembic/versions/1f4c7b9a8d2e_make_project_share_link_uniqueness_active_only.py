"""make project share link uniqueness active only

Revision ID: 1f4c7b9a8d2e
Revises: e2a4b6c8d0f1
Create Date: 2026-03-31 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "1f4c7b9a8d2e"
down_revision: Union[str, None] = "e2a4b6c8d0f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEX_NAME = "uq_project_share_link_active_type"
TABLE_NAME = "project_share_links"


def upgrade() -> None:
    op.drop_constraint("uq_project_share_link_type", TABLE_NAME, type_="unique")
    op.create_index(
        INDEX_NAME,
        TABLE_NAME,
        ["project_id", "link_type"],
        unique=True,
        postgresql_where=sa.text("revoked_at IS NULL"),
        sqlite_where=sa.text("revoked_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(INDEX_NAME, table_name=TABLE_NAME)
    op.create_unique_constraint(
        "uq_project_share_link_type",
        TABLE_NAME,
        ["project_id", "link_type"],
    )
