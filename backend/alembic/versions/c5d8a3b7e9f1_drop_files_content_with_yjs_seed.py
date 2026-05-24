"""drop files.content column, seed remaining content into Yjs state

Revision ID: c5d8a3b7e9f1
Revises: 1f4c7b9a8d2e
Create Date: 2026-05-22 18:50:00.000000

Yjs becomes the single source of truth for file content. For each project
with files that have non-empty `files.content`, we load any existing Yjs
state, then insert content into every file's Y.Text that is currently empty,
and save the merged state back. Files whose Y.Text already has content keep
the Yjs version (it reflects live edits; `files.content` is a frozen snapshot
from creation time).

This is safe to run repeatedly — the per-Y.Text emptiness check makes it
idempotent.

Downgrade re-adds the column empty. We do not decode Yjs state back into the
column because under conflict that would be lossy.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column

from pycrdt import Doc, Text


revision: str = "c5d8a3b7e9f1"
down_revision: Union[str, None] = "1f4c7b9a8d2e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


files_table = table(
    "files",
    column("id", sa.Integer),
    column("hash_id", sa.String),
    column("project_id", sa.Integer),
    column("content", sa.Text),
    column("is_folder", sa.Boolean),
)

yjs_state_table = table(
    "yjs_document_states",
    column("id", sa.Integer),
    column("project_id", sa.Integer),
    column("state", sa.LargeBinary),
    column("created_at", sa.DateTime),
    column("updated_at", sa.DateTime),
)


def _seed_existing_projects(conn) -> None:
    project_files: dict[int, list[tuple[str, str]]] = {}
    for row in conn.execute(
        sa.select(
            files_table.c.project_id,
            files_table.c.hash_id,
            files_table.c.content,
        ).where(
            files_table.c.is_folder.is_(False),
            files_table.c.content.isnot(None),
            files_table.c.content != "",
        )
    ).fetchall():
        project_id, hash_id, content = row
        project_files.setdefault(project_id, []).append((hash_id, content))

    if not project_files:
        return

    now = sa.func.now()
    for project_id, entries in project_files.items():
        existing = conn.execute(
            sa.select(
                yjs_state_table.c.id,
                yjs_state_table.c.state,
            ).where(yjs_state_table.c.project_id == project_id)
        ).first()

        doc = Doc()
        if existing is not None and existing.state:
            doc.apply_update(existing.state)

        mutated = False
        for hash_id, content in entries:
            text = doc.get(f"file-{hash_id}", type=Text)
            if len(text) == 0:
                text.insert(0, content)
                mutated = True

        if not mutated and existing is not None:
            continue

        update_bytes = doc.get_update()
        if not update_bytes:
            continue

        if existing is None:
            conn.execute(
                yjs_state_table.insert().values(
                    project_id=project_id,
                    state=update_bytes,
                    created_at=now,
                    updated_at=now,
                )
            )
        else:
            conn.execute(
                yjs_state_table.update()
                .where(yjs_state_table.c.id == existing.id)
                .values(state=update_bytes, updated_at=now)
            )


def upgrade() -> None:
    conn = op.get_bind()
    _seed_existing_projects(conn)

    op.drop_constraint("folders_no_content", "files", type_="check")
    op.drop_column("files", "content")


def downgrade() -> None:
    op.add_column(
        "files",
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
    )
    op.create_check_constraint(
        "folders_no_content",
        "files",
        "is_folder = false OR content = ''",
    )
