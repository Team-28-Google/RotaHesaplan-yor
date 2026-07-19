"""Seed rotalara gerçek yürüme geometrisi yazar (Google Routes API).

Ön koşul: supabase/migrations/0006_leg_geometry.sql çalıştırılmış olmalı.
Çalıştır:  py "ai-service/scripts/add_geometry.py"                → geometri (TÜM rotalar)
           py "ai-service/scripts/add_geometry.py" --missing-only → YALNIZ geometrisi eksik
             rotalar (backfill sonrası standart adım — mevcut geometri yeniden hesaplanmaz)
           py "ai-service/scripts/add_geometry.py" --photos       → geometri + Places foto/puan (3.2a)
           py "ai-service/scripts/add_geometry.py" --photos-only
İdempotent: geometri yeniden hesaplanır; fotoğrafta fotolu duraklar atlanır.
"""
from __future__ import annotations

import os
import sys

# ai-service kökünü path'e ekle → app.clients/app.pipeline stdlib importları çalışsın
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from app.clients import _req, _sb_headers, load_env  # noqa: E402
from app.pipeline import _WALKISH, enrich_photos, route_geometry  # noqa: E402


def routes_missing_geometry(env: dict) -> set:
    """Yürünebilir bacağı olup leg_geometry'si NULL kalan rotaların id'leri.
    (İlk durak asla bacak taşımaz, transit bacaklar geometri almaz — sayılmaz.)"""
    url = (env["SUPABASE_URL"].rstrip("/")
           + "/rest/v1/waypoints?kind=eq.experience"
           + "&select=route_id,seq,leg_geometry,transport_mode&limit=5000")
    wps = _req(url, "GET", _sb_headers(env)) or []
    by_route: dict = {}
    for w in wps:
        by_route.setdefault(w["route_id"], []).append(w)
    need = set()
    for rid, items in by_route.items():
        items.sort(key=lambda w: w.get("seq") or 0)
        for w in items[1:]:  # ilk deneyim durağının bacağı yoktur
            mode = (w.get("transport_mode") or "walk").lower()
            if mode in _WALKISH and not w.get("leg_geometry"):
                need.add(rid)
                break
    return need


def main() -> None:
    photos = "--photos" in sys.argv or "--photos-only" in sys.argv
    geometry = "--photos-only" not in sys.argv
    missing_only = "--missing-only" in sys.argv
    env = load_env()
    url = env["SUPABASE_URL"].rstrip("/") + "/rest/v1/routes?select=id,title&order=created_at.asc"
    routes = _req(url, "GET", _sb_headers(env)) or []
    if missing_only:
        need = routes_missing_geometry(env)
        routes = [r for r in routes if r["id"] in need]
        print(f"--missing-only: geometrisi eksik {len(routes)} rota bulundu.")
    if not routes:
        print("Rota bulunamadı.")
        return
    print(f"{len(routes)} rota işleniyor (geometri={geometry}, foto={photos})...\n")
    ok = 0
    for r in routes:
        if geometry:
            res = route_geometry(r["id"])
            if res.get("ok"):
                ok += 1
                print(f"  OK  {r['title']}: {res['legs_updated']} bacak, "
                      f"{res['total_distance_m']} m, ~{res['total_duration_min']} dk")
            else:
                print(f"  ATLA {r['title']}: {res.get('reason')}")
        if photos:
            pres = enrich_photos(r["id"])
            if pres.get("ok"):
                if not geometry:
                    ok += 1
                print(f"  FOTO {r['title']}: {pres['updated']} durak güncellendi"
                      + (" + kapak" if pres.get("cover_set") else ""))
            else:
                print(f"  FOTO-ATLA {r['title']}: {pres.get('reason')}")
    print(f"\nBitti: {ok}/{len(routes)} rota güncellendi.")


if __name__ == "__main__":
    main()
