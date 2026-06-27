import * as Location from "expo-location";
import { useEffect, useState } from "react";

/** Foreground konum izni alır ve canlı konumu döndürür ("buradasın"). */
export function useUserLocation(enabled = true) {
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);

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
          (p) => { if (mounted) setLoc({ lat: p.coords.latitude, lng: p.coords.longitude }); },
        );
      } catch { /* izin yok/hata → yoksay */ }
    })();
    return () => { mounted = false; sub?.remove(); };
  }, [enabled]);

  return loc;
}
