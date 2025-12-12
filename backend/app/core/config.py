from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    PROJECT_NAME: str = "Typst Collaboration Platform"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/collabst"

    REDIS_URL: str = "redis://localhost:6379/0"

    # YJS collaboration settings
    YJS_SNAPSHOT_INTERVAL_SECONDS: int = 30  # How often to snapshot to PostgreSQL

    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_PUBLIC_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_SECURE: bool = False
    MINIO_PUBLIC_SECURE: bool = False
    MINIO_BUCKET_NAME: str = "collabst"

    SECRET_KEY: str = "your-secret-key-change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30  # Short-lived access token
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30  # Long-lived refresh token with sliding expiration

    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]


settings = Settings()
