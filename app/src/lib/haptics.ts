import * as Haptics from "expo-haptics";

// Dokunsal geri bildirim sarmalayıcısı — hata durumunda sessizce yutar
// (web/emülatörde titreşim olmayabilir; app akışını asla bozmasın).

/** Hafif seçim tıkı — chip/buton/etkileşim. */
export const tap = () => { Haptics.selectionAsync().catch(() => {}); };

/** Orta vuruş — favori, ekleme gibi "bir şey oldu" anları. */
export const pop = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); };

/** Başarı bildirimi — varış, rozet, paylaşım tamam. */
export const success = () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); };
