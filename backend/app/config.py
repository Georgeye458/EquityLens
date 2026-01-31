"""Application configuration using pydantic-settings."""

from functools import lru_cache
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # SCX.ai API Configuration
    scx_api_key: str = ""
    scx_api_base_url: str = "https://api.scx.ai/v1"
    scx_model: str = "llama-4"
    scx_embedding_model: str = "text-embedding-3-small"

    # Database
    database_url: str = "postgresql://localhost:5432/equitylens"

    # Application
    debug: bool = False
    allowed_origins: Union[List[str], str] = "http://localhost:5173,http://localhost:3000"
    secret_key: str = "change-me-in-production"

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v):
        """Parse allowed_origins from comma-separated string or list."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # Document Processing
    max_file_size_mb: int = 50
    max_pages: int = 300
    chunk_size: int = 1000
    chunk_overlap: int = 200

    @property
    def async_database_url(self) -> str:
        """Convert database URL to async version."""
        if self.database_url.startswith("postgres://"):
            return self.database_url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif self.database_url.startswith("postgresql://"):
            return self.database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return self.database_url


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
