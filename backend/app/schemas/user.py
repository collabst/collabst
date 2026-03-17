from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    email: EmailStr
    username: str


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    username: str | None = None
    password: str | None = None


class User(UserBase):
    id: int
    is_active: bool
    is_superuser: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: User


class TokenData(BaseModel):
    user_id: int | None = None


class UserPublicProfile(BaseModel):
    id: int
    username: str
    created_at: datetime
    updated_at: datetime
    is_self: bool
    email: EmailStr | None = None
    is_active: bool | None = None
    is_superuser: bool | None = None


class UserSettingsUpdate(BaseModel):
    username: str | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str
