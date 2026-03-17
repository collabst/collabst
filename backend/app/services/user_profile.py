from app.models.user import User
from app.schemas.user import User as UserSchema


def serialize_user(user: User) -> UserSchema:
    return UserSchema(
        id=user.id,
        email=user.email,
        username=user.username,
        is_active=user.is_active,
        is_superuser=user.is_superuser,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )
