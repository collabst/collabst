from app.models.user import User
from app.schemas.user import User as UserSchema


def serialize_user(user: User) -> UserSchema:
    return UserSchema(
        id=user.hash_id,
        email=user.email,
        display_name=user.display_name,
        is_active=user.is_active,
        is_superuser=user.is_superuser,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )
