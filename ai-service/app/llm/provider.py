"""Sağlayıcı soyutlama katmanı (provider abstraction).

Tek bir `LLMClient` arayüzü; NVIDIA NIM (OpenAI uyumlu) ve Gemini implementasyonları.
Sağlayıcı `.env` içindeki LLM_PROVIDER ile seçilir → pipeline kodu sağlayıcıdan habersizdir.

Kullanım:
    from app.llm import get_llm_client
    llm = get_llm_client()
    vec = llm.embed("kafa dinlemelik sakin bir rota", input_type="query")
    txt = llm.complete(system="...", user="...", json_mode=True)
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from functools import lru_cache
from typing import Literal

from app.config import Settings, get_settings

InputType = Literal["query", "passage"]


class LLMClient(ABC):
    """Pipeline'ın gördüğü tek arayüz."""

    @abstractmethod
    def embed(self, text: str, input_type: InputType = "passage") -> list[float]:
        """Metni embedding vektörüne çevirir.

        input_type: retrieval modellerinde sorgu mu (query) yoksa
        depolanan içerik mi (passage) embed edildiğini belirtir.
        """

    @abstractmethod
    def complete(self, system: str, user: str, json_mode: bool = False) -> str:
        """Sistem + kullanıcı mesajından tamamlama döndürür."""


class NvidiaClient(LLMClient):
    """NVIDIA NIM — OpenAI uyumlu endpoint (build.nvidia.com)."""

    def __init__(self, settings: Settings):
        from openai import OpenAI  # lazy import: paket yoksa import patlamasın

        self._s = settings
        self._client = OpenAI(
            api_key=settings.nvidia_api_key,
            base_url=settings.nvidia_base_url,
        )

    def embed(self, text: str, input_type: InputType = "passage") -> list[float]:
        resp = self._client.embeddings.create(
            model=self._s.nvidia_embed_model,
            input=[text],
            # nv-embedqa-e5-v5 retrieval parametreleri (OpenAI SDK extra_body):
            extra_body={"input_type": input_type, "truncate": "END"},
        )
        return resp.data[0].embedding

    def complete(self, system: str, user: str, json_mode: bool = False) -> str:
        kwargs: dict = {}
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        resp = self._client.chat.completions.create(
            model=self._s.nvidia_chat_model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.4,
            **kwargs,
        )
        return resp.choices[0].message.content or ""


class GeminiClient(LLMClient):
    """Gemini sağlayıcı — Sprint 2'de doldurulacak (şimdilik stub)."""

    def __init__(self, settings: Settings):
        self._s = settings

    def embed(self, text: str, input_type: InputType = "passage") -> list[float]:
        raise NotImplementedError(
            "GeminiClient.embed Sprint 2'de eklenecek. Şimdilik LLM_PROVIDER=nvidia kullanın."
        )

    def complete(self, system: str, user: str, json_mode: bool = False) -> str:
        raise NotImplementedError(
            "GeminiClient.complete Sprint 2'de eklenecek. Şimdilik LLM_PROVIDER=nvidia kullanın."
        )


@lru_cache
def get_llm_client() -> LLMClient:
    settings = get_settings()
    if settings.llm_provider == "gemini":
        return GeminiClient(settings)
    return NvidiaClient(settings)
