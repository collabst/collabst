from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser
from app.db.base import get_db
from app.models.comment_thread import CommentThread, CommentThreadStatus
from app.models.comment_reply import CommentReply, CommentReplyStatus
from app.models.file import File
from app.models.project_collaborator import CollaboratorRole
from app.schemas.comment import (
    CommentReply as CommentReplySchema,
    CommentReplyCreate,
    CommentThread as CommentThreadSchema,
    CommentThreadCreate,
    CommentThreadUpdate,
)
from app.services.hash_lookup import get_file_by_ref, get_project_by_ref
from app.services.permissions import check_project_access, get_user_project_role
from app.websocket.notifications_ws import notifications_manager


router = APIRouter()


def _is_moderator(*, is_owner: bool, role: CollaboratorRole | None) -> bool:
    return is_owner or role == CollaboratorRole.ADMIN


def _serialize_reply(reply: CommentReply) -> CommentReplySchema:
    return CommentReplySchema(
        id=reply.hash_id,
        thread_id=reply.thread.hash_id,
        author_id=reply.author.hash_id,
        content=reply.content,
        status=reply.status.value,
        created_at=reply.created_at,
        updated_at=reply.updated_at,
    )


def _serialize_thread(thread: CommentThread) -> CommentThreadSchema:
    return CommentThreadSchema(
        id=thread.hash_id,
        project_id=thread.project.hash_id,
        file_id=thread.file.hash_id,
        author_id=thread.author.hash_id,
        content=thread.content,
        status=thread.status.value,
        anchor_rel_json=thread.anchor_rel_json,
        head_rel_json=thread.head_rel_json,
        resolved_at=thread.resolved_at,
        resolved_by_id=thread.resolved_by.hash_id if thread.resolved_by else None,
        created_at=thread.created_at,
        updated_at=thread.updated_at,
        replies=[_serialize_reply(reply) for reply in thread.replies if reply.status != CommentReplyStatus.DELETED],
    )


@router.get("/{project_ref}/comments/files/{file_ref}/threads", response_model=List[CommentThreadSchema])
async def list_file_threads(
    project_ref: str,
    file_ref: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    project = await get_project_by_ref(db, project_ref)
    project = await check_project_access(db, project, current_user, CollaboratorRole.READER)
    file = await get_file_by_ref(db, file_ref)
    if file.project_id != project.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    result = await db.execute(
        select(CommentThread)
        .options(
            selectinload(CommentThread.project),
            selectinload(CommentThread.file),
            selectinload(CommentThread.author),
            selectinload(CommentThread.resolved_by),
            selectinload(CommentThread.replies).selectinload(CommentReply.author),
            selectinload(CommentThread.replies).selectinload(CommentReply.thread),
        )
        .where(CommentThread.project_id == project.id, CommentThread.file_id == file.id)
        .order_by(CommentThread.created_at.asc())
    )
    return [_serialize_thread(thread) for thread in result.scalars().all() if thread.status != CommentThreadStatus.DELETED]


@router.post("/{project_ref}/comments/threads", response_model=CommentThreadSchema)
async def create_thread(
    project_ref: str,
    payload: CommentThreadCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    project = await get_project_by_ref(db, project_ref)
    project = await check_project_access(db, project, current_user, CollaboratorRole.COMMENTOR)
    file = await get_file_by_ref(db, payload.file_id)
    if file.project_id != project.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    thread = CommentThread(
        project_id=project.id,
        file_id=file.id,
        author_id=current_user.id,
        content=payload.content,
        status=CommentThreadStatus.OPEN,
        anchor_rel_json=payload.anchor_rel_json,
        head_rel_json=payload.head_rel_json,
    )
    db.add(thread)
    await db.commit()

    result = await db.execute(
        select(CommentThread)
        .options(
            selectinload(CommentThread.project),
            selectinload(CommentThread.file),
            selectinload(CommentThread.author),
            selectinload(CommentThread.resolved_by),
            selectinload(CommentThread.replies),
        )
        .where(CommentThread.id == thread.id)
    )
    thread = result.scalar_one()

    serialized = _serialize_thread(thread)
    await notifications_manager.broadcast_to_project(
        project_id=project.hash_id,
        message={"type": "comment_thread_created", "thread": serialized.model_dump(mode="json")},
        minimum_role=CollaboratorRole.READER,
    )
    return serialized


@router.post("/{project_ref}/comments/threads/{thread_ref}/replies", response_model=CommentReplySchema)
async def create_reply(
    project_ref: str,
    thread_ref: str,
    payload: CommentReplyCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    project = await get_project_by_ref(db, project_ref)
    project = await check_project_access(db, project, current_user, CollaboratorRole.COMMENTOR)
    result = await db.execute(
        select(CommentThread)
        .options(selectinload(CommentThread.project))
        .where(CommentThread.hash_id == thread_ref)
    )
    thread = result.scalar_one_or_none()
    if not thread or thread.project_id != project.id or thread.status == CommentThreadStatus.DELETED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment thread not found")

    reply = CommentReply(
        thread_id=thread.id,
        author_id=current_user.id,
        content=payload.content,
        status=CommentReplyStatus.ACTIVE,
    )
    db.add(reply)
    await db.commit()

    result = await db.execute(
        select(CommentReply)
        .options(selectinload(CommentReply.author), selectinload(CommentReply.thread))
        .where(CommentReply.id == reply.id)
    )
    reply = result.scalar_one()

    serialized = _serialize_reply(reply)
    await notifications_manager.broadcast_to_project(
        project_id=project.hash_id,
        message={"type": "comment_reply_created", "reply": serialized.model_dump(mode="json"), "thread_id": thread_ref},
        minimum_role=CollaboratorRole.READER,
    )
    return serialized


@router.patch("/{project_ref}/comments/threads/{thread_ref}", response_model=CommentThreadSchema)
async def update_thread(
    project_ref: str,
    thread_ref: str,
    payload: CommentThreadUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    project = await get_project_by_ref(db, project_ref)
    project = await check_project_access(db, project, current_user, CollaboratorRole.COMMENTOR)
    result = await db.execute(
        select(CommentThread)
        .options(
            selectinload(CommentThread.project),
            selectinload(CommentThread.file),
            selectinload(CommentThread.author),
            selectinload(CommentThread.resolved_by),
            selectinload(CommentThread.replies).selectinload(CommentReply.author),
            selectinload(CommentThread.replies).selectinload(CommentReply.thread),
        )
        .where(CommentThread.hash_id == thread_ref)
    )
    thread = result.scalar_one_or_none()
    if not thread or thread.project_id != project.id or thread.status == CommentThreadStatus.DELETED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment thread not found")

    user_role = await get_user_project_role(db, project, current_user)
    can_moderate = _is_moderator(is_owner=(project.owner_id == current_user.id), role=user_role)
    is_author = thread.author_id == current_user.id

    if payload.content is not None and not (is_author or can_moderate):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot edit this comment")

    if payload.content is not None:
        thread.content = payload.content

    if payload.status is not None:
        target_status = CommentThreadStatus(payload.status)
        if target_status == CommentThreadStatus.DELETED:
            if not can_moderate:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot delete this comment")
        elif target_status == CommentThreadStatus.RESOLVED:
            thread.resolved_at = thread.updated_at
            thread.resolved_by_id = current_user.id
        elif target_status == CommentThreadStatus.OPEN:
            thread.resolved_at = None
            thread.resolved_by_id = None
        thread.status = target_status

    await db.commit()
    await db.refresh(thread)

    result = await db.execute(
        select(CommentThread)
        .options(
            selectinload(CommentThread.project),
            selectinload(CommentThread.file),
            selectinload(CommentThread.author),
            selectinload(CommentThread.resolved_by),
            selectinload(CommentThread.replies).selectinload(CommentReply.author),
            selectinload(CommentThread.replies).selectinload(CommentReply.thread),
        )
        .where(CommentThread.id == thread.id)
    )
    thread = result.scalar_one()

    serialized = _serialize_thread(thread)
    await notifications_manager.broadcast_to_project(
        project_id=project.hash_id,
        message={"type": "comment_thread_updated", "thread": serialized.model_dump(mode="json")},
        minimum_role=CollaboratorRole.READER,
    )
    return serialized
