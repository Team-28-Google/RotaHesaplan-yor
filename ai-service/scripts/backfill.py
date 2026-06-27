"""SANA backfill — seed_routes.json'u Supabase'e yazar ve her rotayı NVIDIA ile
embedleyip ai_memory_embeddings'e ekler (Social Memory'nin beslendiği yer).

Çalıştır:  py ai-service/scripts/backfill.py
Idempotent: mevcut seed rotalarını (is_seed=true) silip yeniden yazar.
"""
from __future__ import annotations

import json
import secrets

from sana_seed_lib import (
    SEED_JSON, load_env, nvidia_embed, sb_admin_create_user, sb_admin_find_user,
    sb_delete, sb_get, sb_insert,
)

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


def main():
    env = load_env()
    with open(SEED_JSON, encoding="utf-8") as f:
        routes = json.load(f)
    print(f"{len(routes)} rota yüklendi.")

    author_id = ensure_seed_author(env)

    # Eski seed rotalarını temizle (cascade: waypoints + embeddings silinir)
    print("Eski seed rotaları temizleniyor...")
    sb_delete(env, "routes", "is_seed=eq.true")

    for route in routes:
        waypoints = route.pop("waypoints")
        route["author_id"] = author_id

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
            "metadata": {"city": route["city"], "vibe_tags": route["vibe_tags"]},
        })
        print(f"  [ok] {route['title']}  ({len(waypoints)} durak, embed {len(vec)} boyut)")

    print("\nBackfill tamam.")


if __name__ == "__main__":
    main()
