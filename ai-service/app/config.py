"""Uygulama yapılandırması — .env'den okunur (pydantic-settings)."""
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # Sağlayıcı seçimi
    llm_provider: Literal["nvidia", "gemini"] = "nvidia"

    # NVIDIA NIM
    nvidia_api_key: str = ""
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"
    nvidia_chat_model: str = "meta/llama-3.3-70b-instruct"
    nvidia_embed_model: str = "nvidia/nv-embedqa-e5-v5"
    embed_dim: int = 1024

    # Gemini (opsiyonel)
    gemini_api_key: str = ""
    gemini_chat_model: str = "gemini-2.0-flash"
    gemini_embed_model: str = "text-embedding-004"

    # Harita verisi sağlayıcı (mekan + yürüyüş mesafesi)
    maps_provider: Literal["serpapi", "google"] = "serpapi"
    serpapi_key: str = ""
    google_maps_api_key: str = ""   # SADECE app harita GÖSTERİMİ (Android SDK, mobilde ücretsiz)
    openweather_api_key: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
