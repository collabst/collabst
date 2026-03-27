from datetime import datetime
from typing import Literal
from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    display_name: str = Field(min_length=1, max_length=50)


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    display_name: str | None = Field(default=None, min_length=1, max_length=50)
    password: str | None = None


class User(UserBase):
    id: str
    is_active: bool
    is_superuser: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SessionUser(BaseModel):
    id: str
    display_name: str
    user_type: Literal["auth", "guest"]
    created_at: datetime
    updated_at: datetime
    email: EmailStr | None = None
    is_active: bool | None = None
    is_superuser: bool | None = None


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: SessionUser


class TokenData(BaseModel):
    user_id: str | None = None


class UserPublicProfile(BaseModel):
    id: str
    display_name: str
    created_at: datetime
    updated_at: datetime
    is_self: bool
    email: EmailStr | None = None
    is_active: bool | None = None
    is_superuser: bool | None = None


class UserSettingsUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=50)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str
