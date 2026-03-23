from datetime import datetime
from typing import Literal

from pydantic import BaseModel


CommentThreadStatus = Literal["open", "resolved", "deleted"]
CommentReplyStatus = Literal["active", "deleted"]


class CommentAnchor(BaseModel):
    anchor_rel_json: str | None = None
    head_rel_json: str | None = None


class CommentReplyBase(BaseModel):
    content: str


class CommentReplyCreate(CommentReplyBase):
    pass


class CommentReply(CommentReplyBase):
    id: str
    thread_id: str
    author_id: str
    status: CommentReplyStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CommentThreadBase(BaseModel):
    file_id: str
    content: str


class CommentThreadCreate(CommentThreadBase, CommentAnchor):
    pass


class CommentThreadUpdate(BaseModel):
    content: str | None = None
    status: CommentThreadStatus | None = None


class CommentThread(CommentThreadBase, CommentAnchor):
    id: str
    project_id: str
    author_id: str
    status: CommentThreadStatus
    resolved_at: datetime | None = None
    resolved_by_id: str | None = None
    created_at: datetime
    updated_at: datetime
    replies: list[CommentReply] = []

    model_config = {"from_attributes": True}
