import * as Location from "expo-location";
import { Alert, Linking } from "react-native";

/** Konum izni garantile — kullanıcıya HER ZAMAN bir yol göster:
 *  1) Sorulabiliyorsa sistem izin penceresi açılır.
 *  2) Kalıcı reddedilmişse (Android "bir daha sorma") sistem penceresi HİÇ çıkmaz —
 *     bu durumda "Ayarları Aç" yönlendirmesi gösterilir (eskiden sessizce düşüyordu,
 *     kullanıcı "izin sormuyor" sanıyordu).
 *  Kullanıcı az önce reddettiyse üstelemez (false döner, ek pencere yok). */
export async function ensureLocationPermission(
  t: (key: string, params?: Record<string, string | number>) => string,
): Promise<boolean> {
  const cur = await Location.getForegroundPermissionsAsync();
  if (cur.status === "granted") return true;
  if (cur.canAskAgain) {
    const req = await Location.requestForegroundPermissionsAsync();
    if (req.status === "granted") return true;
    if (req.canAskAgain) return false; // şimdi reddetti — saygı duy, üsteleme
  }
  Alert.alert(t("city.permTitle"), t("common.permSettingsBody"), [
    { text: t("common.cancel"), style: "cancel" },
    { text: t("common.openSettings"), onPress: () => { Linking.openSettings().catch(() => {}); } },
  ]);
  return false;
}
