import { Platform, Text, type TextProps, type TextStyle } from 'react-native';

import { colors, fonts } from '@/theme';

// Yatra One needs ~1.48× its size per line. Any less and Android cuts off the tails of
// g, j, p, q, y (e.g. a name like "Jay"), so its line heights stay at ≥ 1.5×.
const variants = {
  display: { fontFamily: fonts.display, fontSize: 30, lineHeight: 45 },
  h1: { fontFamily: fonts.display, fontSize: 24, lineHeight: 36 },
  h2: { fontFamily: fonts.display, fontSize: 19, lineHeight: 29 },
  h3: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  strong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  price: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  micro: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14 },
  button: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20 },
} satisfies Record<string, TextStyle>;

export type TxtVariant = keyof typeof variants;

// Android measures Yatra One a few px too narrow, so a heading that sizes itself to its text
// loses its last letters. A little side padding gives it the room back.
const displayFix: TextStyle | undefined = Platform.OS === 'android' ? { paddingHorizontal: 2 } : undefined;
const usesDisplayFont = (v: TxtVariant) => v === 'display' || v === 'h1' || v === 'h2';

export function Txt({
  variant = 'body',
  color = colors.ink,
  style,
  ...rest
}: TextProps & { variant?: TxtVariant; color?: string }) {
  return <Text {...rest} style={[variants[variant], usesDisplayFont(variant) && displayFix, { color }, style]} />;
}
