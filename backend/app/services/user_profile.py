from app.models.user import AuthUser, User, GuestUser
from app.schemas.user import SessionUser, AuthUser as AuthUserSchema, GuestUser as GuestUserSchema


def serialize_auth_user(user: AuthUser) -> AuthUserSchema:
    return AuthUserSchema(
        id=user.hash_id,
        email=user.email,
        display_name=user.display_name,
        is_active=user.is_active,
        is_superuser=user.is_superuser,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def serialize_guest_user(user: GuestUser) -> GuestUserSchema:
    return GuestUserSchema(
        id=user.hash_id,
        email=None,
        display_name=user.display_name,
        is_active=None,
        is_superuser=None,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def serialize_user(user: User) -> AuthUserSchema | GuestUserSchema:
    if isinstance(user, AuthUser):
        return serialize_auth_user(user)
    elif isinstance(user, GuestUser):
        return serialize_guest_user(user)
    else:
        raise ValueError("Unsupported user type")


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
