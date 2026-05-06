import os
from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Explicitly load backend/.env
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)


class Settings(BaseSettings):
    database_url: str = os.getenv("DATABASE_URL", "")
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    secret_key: str = os.getenv("SECRET_KEY", "changeme-in-production-please")

    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    storage_base_path: str = os.getenv("STORAGE_BASE_PATH", "./backend/storage")

    ocr_confidence_threshold: float = 0.60
    extraction_confidence_threshold: float = 0.75
    manual_review_confidence_threshold: float = 0.80

    similar_works_eligible_threshold: float = 0.72
    similar_works_review_threshold: float = 0.55

    llm_model: str = "gpt-4o"
    embedding_model: str = "text-embedding-3-small"

    max_chunk_tokens: int = 800
    chunk_overlap_ratio: float = 0.15

    app_title: str = "TenderGraph AI+"
    app_version: str = "1.0.0"

    debug: bool = os.getenv("DEBUG", "false").lower() == "true"

    class Config:
        extra = "ignore"


settings = Settings()

print("OPENAI_API_KEY loaded:", settings.openai_api_key[:10] if settings.openai_api_key else "NOT FOUND")