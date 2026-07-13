import Ionicons from "@expo/vector-icons/Ionicons";

/** Ionicons sarmalayıcı — ui.ts'in string döndürdüğü ikon adlarını tipe uydurur
 *  (emoji chrome'unun kaldırılmasıyla tüm kategori/araç ikonları buradan geçer). */
export default function Icon({ name, size = 14, color }: { name: string; size?: number; color?: string }) {
  return <Ionicons name={name as keyof typeof Ionicons.glyphMap} size={size} color={color} />;
}
