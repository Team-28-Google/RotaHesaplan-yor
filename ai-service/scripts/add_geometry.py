"""Seed rotalara gerçek yürüme geometrisi yazar (Google Routes API).

Ön koşul: supabase/migrations/0006_leg_geometry.sql çalıştırılmış olmalı.
Çalıştır:  py "ai-service/scripts/add_geometry.py"           → geometri
           py "ai-service/scripts/add_geometry.py" --photos  → geometri + Places foto/puan (3.2a)
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
from app.pipeline import enrich_photos, route_geometry  # noqa: E402


def main() -> None:
    photos = "--photos" in sys.argv or "--photos-only" in sys.argv
    geometry = "--photos-only" not in sys.argv
    env = load_env()
    url = env["SUPABASE_URL"].rstrip("/") + "/rest/v1/routes?select=id,title&order=created_at.asc"
    routes = _req(url, "GET", _sb_headers(env)) or []
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
