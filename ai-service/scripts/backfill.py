"""SANA backfill — seed_routes.json (TR) + seed_routes_en.json (EN) Supabase'e yazar
ve her rotayı NVIDIA ile embedleyip ai_memory_embeddings'e ekler (Social Memory).

Çalıştır:  py ai-service/scripts/backfill.py
Idempotent: mevcut TÜM seed rotalarını (is_seed=true) silip yeniden yazar.
ÖNKOŞUL: migration 0024 (routes.lang kolonu) uygulanmış olmalı.
EN dosyası yoksa yalnız TR yüklenir (önce: py translate_seed.py).
"""
from __future__ import annotations

import json
import os
import secrets

from sana_seed_lib import (
    SEED_JSON, load_env, nvidia_embed, sb_admin_create_user, sb_admin_find_user,
    sb_delete, sb_get, sb_insert,
)

SEED_EN = os.path.join(os.path.dirname(SEED_JSON), "seed_routes_en.json")
SEED_EMAIL = "seed@sana.app"
SEED_USERNAME = "sana_seed"


def ensure_seed_author(env: dict) -> str:
    """Seed rotalarının yazarı olacak sistem kullanıcısını (auth + profile) garanti eder."""
    # 1) profil zaten var mı?
    rows = sb_get(env, "profiles", f"username=eq.{SEED_USERNAME}&select=id")
    if rows:
        print(f"  seed profili mevcut: {rows[0]['id']}")
        return rows[0]["id"]

    # 2) auth kullanıcısı (varsa bul, yoksa oluştur)
    user = sb_admin_find_user(env, SEED_EMAIL)
    if user:
        uid = user["id"]
        print(f"  seed auth kullanıcısı mevcut: {uid}")
    else:
        created = sb_admin_create_user(env, SEED_EMAIL, secrets.token_urlsafe(16))
        uid = created["id"]
        print(f"  seed auth kullanıcısı oluşturuldu: {uid}")

    # 3) profil oluştur
    sb_insert(env, "profiles", {
        "id": uid,
        "username": SEED_USERNAME,
        "full_name": "SANA Seed",
        "home_city": "Istanbul",
        "bio": "Topluluğun başlangıç rotaları (demo/seed).",
    })
    print(f"  seed profili oluşturuldu: {uid}")
    return uid


def embed_text(route: dict) -> str:
    exp = [w for w in route["waypoints"] if w["kind"] == "experience"]
    stops = "; ".join(f"{w['name']} ({w['note']})" for w in exp)
    tags = ", ".join(route["vibe_tags"])
    return f"{route['title']}. {route['description']} Etiketler: {tags}. Duraklar: {stops}."


def insert_route(env: dict, route: dict, author_id: str, lang: str):
    """Tek rotayı + waypoint'lerini + embedding'ini yazar (lang etiketiyle)."""
    waypoints = route.pop("waypoints")
    route["author_id"] = author_id
    route["lang"] = lang  # 0024: dile göre havuz

    # 1) rota
    inserted = sb_insert(env, "routes", route)
    route_id = inserted[0]["id"]

    # 2) waypoint'ler
    for w in waypoints:
        w["route_id"] = route_id
    sb_insert(env, "waypoints", waypoints)

    # 3) embedding (sadece experience durakları metne girer)
    content = embed_text({**route, "waypoints": waypoints})
    vec = nvidia_embed(env, content, input_type="passage")
    sb_insert(env, "ai_memory_embeddings", {
        "route_id": route_id,
        "source_type": "route",
        "content": content,
        "embedding": vec,
        "metadata": {"city": route["city"], "vibe_tags": route["vibe_tags"], "lang": lang},
    })
    print(f"  [ok/{lang}] {route['title']}  ({len(waypoints)} durak, embed {len(vec)} boyut)")


def main():
    env = load_env()
    with open(SEED_JSON, encoding="utf-8") as f:
        tr_routes = json.load(f)
    en_routes = []
    if os.path.exists(SEED_EN):
        with open(SEED_EN, encoding="utf-8") as f:
            en_routes = json.load(f)
        print(f"{len(tr_routes)} TR + {len(en_routes)} EN rota yüklendi.")
    else:
        print(f"{len(tr_routes)} TR rota yüklendi (EN dosyası yok — önce translate_seed.py).")

    author_id = ensure_seed_author(env)

    # Eski seed rotalarını temizle (cascade: waypoints + embeddings silinir) — tüm diller
    print("Eski seed rotaları temizleniyor...")
    sb_delete(env, "routes", "is_seed=eq.true")

    for route in tr_routes:
        insert_route(env, route, author_id, "tr")
    for route in en_routes:
        insert_route(env, route, author_id, "en")

    print(f"\nBackfill tamam. ({len(tr_routes)} TR + {len(en_routes)} EN)")


if __name__ == "__main__":
    main()
