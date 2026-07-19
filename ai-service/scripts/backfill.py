"""SANA backfill — seed_routes.json (TR) + seed_routes_en.json (EN) Supabase'e yazar
ve her rotayı NVIDIA ile embedleyip ai_memory_embeddings'e ekler (Social Memory).

Çalıştır:  py ai-service/scripts/backfill.py
Idempotent + VERİ-KORUYAN: mevcut seed rota (başlık+dil) eşleşirse SİLİNMEZ,
yerinde güncellenir → rota/waypoint id'leri korunur, testçilerin yorumları,
favorileri ve yolculuk kayıtları YAŞAR. Yalnız JSON'dan çıkarılan (ya da başlığı
değişen) rotalar silinir — bunlar uyarıyla listelenir.
ÖNKOŞUL: migration 0024 (routes.lang kolonu) uygulanmış olmalı.
EN dosyası yoksa yalnız TR yüklenir (önce: py translate_seed.py).
"""
from __future__ import annotations

import json
import os
import secrets
import urllib.parse

from sana_seed_lib import (
    SEED_JSON, load_env, nvidia_embed, sb_admin_create_user, sb_admin_find_user,
    sb_delete, sb_get, sb_insert, sb_patch,
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


def upsert_route(env: dict, route: dict, author_id: str, lang: str):
    """Rota (başlık+dil) mevcutsa YERİNDE günceller (id'ler korunur → topluluk
    verisi yaşar); yoksa ekler. Embedding her durumda tazelenir (kullanıcı verisi değil)."""
    waypoints = route.pop("waypoints")
    route["author_id"] = author_id
    route["lang"] = lang  # 0024: dile göre havuz

    title_q = urllib.parse.quote(route["title"], safe="")
    rows = sb_get(env, "routes",
                  f"is_seed=eq.true&lang=eq.{lang}&title=eq.{title_q}&select=id&limit=1")
    if rows:
        # 1a) mevcut rota — alanları güncelle (like_count vb. dokunulmaz)
        route_id = rows[0]["id"]
        sb_patch(env, "routes", f"id=eq.{route_id}", route)
        # 1b) waypoint'ler seq ile eşlenir: id korunur → durağa bağlı yorumlar yaşar
        old = sb_get(env, "waypoints", f"route_id=eq.{route_id}&select=id,seq")
        by_seq = {w["seq"]: w["id"] for w in old}
        for w in waypoints:
            w["route_id"] = route_id
            if w["seq"] in by_seq:
                wid = by_seq.pop(w["seq"])
                sb_patch(env, "waypoints", f"id=eq.{wid}",
                         {k: v for k, v in w.items() if k != "route_id"})
            else:
                sb_insert(env, "waypoints", w)
        for wid in by_seq.values():  # JSON'da artık olmayan fazla duraklar
            sb_delete(env, "waypoints", f"id=eq.{wid}")
        mode = "guncel"
    else:
        # 2) yeni rota
        inserted = sb_insert(env, "routes", route)
        route_id = inserted[0]["id"]
        for w in waypoints:
            w["route_id"] = route_id
        sb_insert(env, "waypoints", waypoints)
        mode = "yeni"

    # 3) embedding tazele (sadece experience durakları metne girer)
    sb_delete(env, "ai_memory_embeddings", f"route_id=eq.{route_id}&source_type=eq.route")
    content = embed_text({**route, "waypoints": waypoints})
    vec = nvidia_embed(env, content, input_type="passage")
    sb_insert(env, "ai_memory_embeddings", {
        "route_id": route_id,
        "source_type": "route",
        "content": content,
        "embedding": vec,
        "metadata": {"city": route["city"], "vibe_tags": route["vibe_tags"], "lang": lang},
    })
    print(f"  [{mode}/{lang}] {route['title']}  ({len(waypoints)} durak, embed {len(vec)} boyut)")


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

    for route in tr_routes:
        upsert_route(env, route, author_id, "tr")
    for route in en_routes:
        upsert_route(env, route, author_id, "en")

    # Artık JSON'da olmayan (silinen/başlığı değişen) seed rotaları temizle — UYARILI.
    # DİKKAT: cascade ile o rotanın yorum/favori/yolculukları da gider; başlık
    # değiştirirken bunu bilerek yap.
    wanted = {("tr", r["title"]) for r in tr_routes} | {("en", r["title"]) for r in en_routes}
    langs = ["tr"] + (["en"] if en_routes else [])
    for lg in langs:
        for r in sb_get(env, "routes", f"is_seed=eq.true&lang=eq.{lg}&select=id,title") or []:
            if (lg, r["title"]) not in wanted:
                print(f"  [SIL/{lg}] JSON'da yok: {r['title']} (yorum/favorileri de gider)")
                sb_delete(env, "routes", f"id=eq.{r['id']}")

    print(f"\nBackfill tamam. ({len(tr_routes)} TR + {len(en_routes)} EN — mevcutlar korunarak)")
    print("HATIRLATMA: yeni eklenen rotaların sokak geometrisi YOKTUR — harita düz çizgiye")
    print("düşmesin diye şimdi çalıştır:  py ai-service/scripts/add_geometry.py --missing-only")


if __name__ == "__main__":
    main()
