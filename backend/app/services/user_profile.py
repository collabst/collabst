from app.models.user import AuthUser, User
from app.schemas.user import SessionUser, User as UserSchema


def serialize_user(user: AuthUser) -> UserSchema:
    return UserSchema(
        id=user.hash_id,
        email=user.email,
        display_name=user.display_name,
        is_active=user.is_active,
        is_superuser=user.is_superuser,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def serialize_session_user(user: User) -> SessionUser:
    user_type_value = user.user_type.value if hasattr(user.user_type, "value") else str(user.user_type)
    payload = {
        "id": user.hash_id,
        "display_name": user.display_name,
        "user_type": user_type_value,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }

    if isinstance(user, AuthUser):
        payload["email"] = user.email
        payload["is_active"] = user.is_active
        payload["is_superuser"] = user.is_superuser

    return SessionUser(**payload)
