from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Absolute path to your course folder (the one containing agentic-ai/, db/, etc.)
    content_root: str = "../content"

    # Auth
    secret_key: str = "dev-secret-change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    # Storage
    database_url: str = "sqlite:///./platform.db"

    # Certification flow
    require_instructor_approval: bool = True
    instructor_signup_code: str = "letmein-instructor"
    frontend_base_url: str = "http://localhost:5173"

    # CORS
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Demo / showcase mode — when True, auth is bypassed and a read-only
    # guest session is injected so the platform can be shown without real accounts
    demo_mode: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
