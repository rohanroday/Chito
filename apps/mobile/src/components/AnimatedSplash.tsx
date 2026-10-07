import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { colors } from '@/theme';

import { MonasteryScene } from './MonasteryScene';
import { DentilBorder } from './ornaments';
import { Txt } from './Txt';

const SHOW_MS = 2600;
const FADE_MS = 450;

/** In-app splash shown after the native (maroon + logo) splash: the gompa at dawn. */
export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);
  const sceneW = Math.min(width, 480);

  useEffect(() => {
    const show = reduced ? 1200 : SHOW_MS;
    opacity.value = withDelay(show, withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.quad) }));
    const t = setTimeout(onDone, show + FADE_MS);
    return () => clearTimeout(t);
  }, [onDone, opacity, reduced]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, fade]} accessibilityLabel="Chito, Sikkim's own quick bazaar">
      <DentilBorder />
      <View style={styles.center}>
        <Animated.View entering={reduced ? undefined : FadeInUp.duration(900).easing(Easing.out(Easing.cubic))}>
          <MonasteryScene width={sceneW} height={sceneW * (260 / 300)} />
        </Animated.View>

        <Animated.View entering={reduced ? undefined : ZoomIn.delay(500).springify().damping(14)} style={styles.logoWrap}>
          <Image source={require('@/assets/images/logo-tile.png')} style={styles.logo} contentFit="contain" />
        </Animated.View>

        <Animated.View entering={reduced ? undefined : FadeInDown.delay(900).duration(600)} style={{ alignItems: 'center' }}>
          <Txt variant="h1" color={colors.gold} style={{ textAlign: 'center' }}>
            Sikkim&apos;s own quick bazaar
          </Txt>
          <Txt variant="strong" color={colors.white} style={{ marginTop: 4, opacity: 0.9 }}>
            Tashi Delek 🙏
          </Txt>
        </Animated.View>
      </View>
      <Animated.View entering={reduced ? undefined : FadeIn.delay(1200)} style={styles.footer}>
        <Txt variant="caption" color={colors.white} style={{ opacity: 0.7 }}>
          Singtam Bazaar · East Sikkim
        </Txt>
      </Animated.View>
      <DentilBorder />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.maroon, zIndex: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  logoWrap: {
    marginTop: -28,
    marginBottom: 16,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: colors.gold,
    padding: 2,
    backgroundColor: colors.maroon700,
  },
  logo: { width: 104, height: 104, borderRadius: 24 },
  footer: { alignItems: 'center', paddingBottom: 18 },
});
