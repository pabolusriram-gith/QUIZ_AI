from typing import List, Optional, Union
from pydantic import AnyHttpUrl, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "QuizVerse AI"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"

    # CORS Allowed Origins
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    # Database Settings
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres_secure_password"
    POSTGRES_DB: str = "quizverse_db"
    DATABASE_URL: Optional[str] = None

    @property
    def async_database_url(self) -> str:
        if self.DATABASE_URL:
            url = self.DATABASE_URL
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+asyncpg://", 1)
            elif url.startswith("postgresql://"):
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            
            import re
            url = re.sub(r':\[([^\]]+)\]@', r':\1@', url)
            return url
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # Redis Settings
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: Optional[str] = None
    REDIS_URL: Optional[str] = None

    @property
    def redis_connection_url(self) -> str:
        if self.REDIS_URL:
            return self.REDIS_URL
        auth = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return f"redis://{auth}{self.REDIS_HOST}:{self.REDIS_PORT}/0"

    # JWT Authentication Secrets
    SECRET_KEY: str = "super_secret_jwt_key_change_in_production_32bytes_min"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # OAuth Settings
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    FRONTEND_URL: str = "http://localhost:3000"

    @field_validator("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", mode="before")
    @classmethod
    def strip_oauth_secrets(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v

    # SMTP Settings (For Password Recovery Emails)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: Optional[int] = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None

    # AI API Keys
    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None

    # AI Configuration Controls
    ENABLE_MOCK_PROVIDER: bool = False
    AUTO_PROVIDER_ORDER: Union[List[str], str] = ["groq", "gemini", "openai"]
    
    # RAG Settings
    RAG_BATCH_SIZE: int = 500
    ENABLE_PGVECTOR: bool = False

    # Redis Pub/Sub settings for horizontal scaling
    ENABLE_REDIS_PUBSUB: bool = True
    REDIS_PUBSUB_CHANNEL: str = "quizverse:broadcast"
    REDIS_RECONNECT_MAX_DELAY: int = 30

    # Configurable HTTP Security Headers
    SECURE_HEADERS_CSP: str = "default-src 'self'; frame-ancestors 'none';"
    SECURE_HEADERS_REFERRER: str = "strict-origin-when-cross-origin"
    SECURE_HEADERS_PERMISSIONS: str = "geolocation=(), microphone=(), camera=()"

    # AI Rate Limiting Settings
    AI_GENERATE_PER_MINUTE: int = 10
    AI_GENERATE_PER_HOUR: int = 100
    AI_REGENERATE_PER_MINUTE: int = 30
    AI_ENHANCE_PER_MINUTE: int = 20

    # AI Resilience Settings
    GEMINI_TIMEOUT_SECONDS: int = 45
    GROQ_TIMEOUT_SECONDS: int = 30
    OPENAI_TIMEOUT_SECONDS: int = 45

    AI_MAX_RETRIES: int = 2
    AI_RETRY_BASE_DELAY_SECONDS: int = 1
    AI_CIRCUIT_FAILURE_THRESHOLD: int = 5
    AI_CIRCUIT_COOLDOWN_SECONDS: int = 60

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def validate_and_parse_cors_origins(cls, v):
        if isinstance(v, str):
            v_trimmed = v.strip()
            if v_trimmed.startswith("[") and v_trimmed.endswith("]"):
                import json
                try:
                    return json.loads(v_trimmed)
                except Exception:
                    pass
            return [x.strip() for x in v_trimmed.split(",") if x.strip()]
        return v

    @field_validator("AUTO_PROVIDER_ORDER", mode="before")
    @classmethod
    def validate_and_parse_auto_provider_order(cls, v):
        if isinstance(v, str):
            v = [x.strip().lower() for x in v.split(",") if x.strip()]
        if not isinstance(v, list):
            raise ValueError("AUTO_PROVIDER_ORDER must be a list or a comma-separated string.")
        
        allowed_providers = {"gemini", "groq", "openai", "mock"}
        for item in v:
            if item not in allowed_providers:
                raise ValueError(f"Invalid provider '{item}' in AUTO_PROVIDER_ORDER. Allowed values: {list(allowed_providers)}")
        return v

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
