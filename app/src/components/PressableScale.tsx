import { useRef, type ReactNode } from "react";
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

/** Basılınca yayla hafifçe küçülen dokunma alanı — kartlar için premium his. */
export default function PressableScale({
  style, children, onPressIn, onPressOut, ...rest
}: Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        Animated.spring(scale, { toValue: 0.97, speed: 50, bounciness: 0, useNativeDriver: true }).start();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        Animated.spring(scale, { toValue: 1, speed: 40, bounciness: 6, useNativeDriver: true }).start();
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
