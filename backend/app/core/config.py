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

    ENVIRONMENT: str = "development"
    WEB_URL: str = "http://localhost:5173"
    CORS_ORIGINS: str = ""
    FRONTEND_DIST_DIR: str = "/app/frontend-dist"

    # Registration enabled/disabled
    REGISTRATION_ENABLED: bool = True

    @property
    def cors_origins_list(self) -> list[str]:
        if self.CORS_ORIGINS.strip():
            return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        return [self.WEB_URL]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"


settings = Settings()
