import * as Location from "expo-location";
import { useEffect, useState } from "react";

export interface UserLocation {
  lat: number;
  lng: number;
  /** Hareket yönü (derece, 0=kuzey); GPS duruyorken null/-1 olabilir */
  heading: number | null;
}

/** Foreground konum izni alır ve canlı konum + yön döndürür ("buradasın" + navigasyon). */
export function useUserLocation(enabled = true) {
  const [loc, setLoc] = useState<UserLocation | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    let sub: Location.LocationSubscription | undefined;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 15, timeInterval: 4000 },
          (p) => {
            if (mounted) {
              setLoc({ lat: p.coords.latitude, lng: p.coords.longitude, heading: p.coords.heading ?? null });
            }
          },
        );
      } catch { /* izin yok/hata → yoksay */ }
    })();
    return () => { mounted = false; sub?.remove(); };
  }, [enabled]);

  return loc;
}
