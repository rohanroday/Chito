import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, type ViewStyle } from 'react-native';

import { colors, radius } from '@/theme';

import { Txt } from './Txt';

const styles = {
  primary: { bg: colors.maroon, fg: colors.gold, border: colors.maroon },
  gold: { bg: colors.gold, fg: colors.maroon, border: colors.gold },
  secondary: { bg: colors.card, fg: colors.maroon, border: colors.maroon },
  ghost: { bg: 'transparent', fg: colors.turquoise, border: 'transparent' },
  danger: { bg: colors.card, fg: colors.vermilion, border: colors.vermilion },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: keyof typeof styles;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
}) {
  const s = styles[variant];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      style={({ pressed }) => [
        {
          height: 50,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: off ? colors.sand : s.border,
          backgroundColor: off ? colors.sand : s.bg,
          opacity: pressed ? 0.85 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingHorizontal: 16,
        },
        style,
      ]}>
      {loading ? <ActivityIndicator color={s.fg} /> : icon}
      <Txt variant="button" color={off ? colors.subtle : s.fg}>
        {title}
      </Txt>
    </Pressable>
  );
}
