import secrets


def generate_hash_id(length: int = 20) -> str:
    token = secrets.token_urlsafe(length)
    return token[:length]
