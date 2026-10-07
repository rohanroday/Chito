// Decorative motifs from Sikkim's monastery architecture (DESIGN.md §5).
// Architecture, colour and landscape only — no sacred objects.
import { View } from 'react-native';
import Svg, { Path, Polygon, Rect } from 'react-native-svg';

import { colors, flagColors } from '@/theme';

/** Row of small carved squares, like the dentils under gompa eaves. */
export function DentilBorder({ color = colors.goldDeep, bg = colors.maroon700 }: { color?: string; bg?: string }) {
  const n = 60;
  return (
    <View style={{ height: 8, backgroundColor: bg, overflow: 'hidden' }} accessible={false}>
      <Svg width="100%" height={8} viewBox={`0 0 ${n * 8} 8`} preserveAspectRatio="xMinYMid slice">
        {Array.from({ length: n }, (_, i) => (
          <Rect key={i} x={i * 8 + 2} y={2} width={4} height={4} fill={color} />
        ))}
      </Svg>
    </View>
  );
}

/** Five-colour prayer-flag bunting on a gently sagging string. */
export function PrayerFlags({ width = 360, height = 28, count = 15 }: { width?: number; height?: number; count?: number }) {
  const sag = height * 0.35;
  const step = width / count;
  const yAt = (x: number) => 2 + sag * Math.sin((Math.PI * x) / width);
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <Path d={`M0 2 Q ${width / 2} ${2 + sag * 2} ${width} 2`} stroke={colors.line} strokeWidth={1} fill="none" />
      {Array.from({ length: count }, (_, i) => {
        const x = i * step + step * 0.15;
        const y = yAt(x + step * 0.35);
        const w = step * 0.7;
        const h = height * 0.5;
        return (
          <Rect
            key={i}
            x={x}
            y={y}
            width={w}
            height={h}
            fill={flagColors[i % 5]}
            stroke={flagColors[i % 5] === '#FFFFFF' ? colors.line : 'none'}
            strokeWidth={0.5}
          />
        );
      })}
    </Svg>
  );
}

/** Small cloud-scroll curl used beside section titles. */
export function CloudScroll({ size = 18, color = colors.goldDeep }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size * 0.6} viewBox="0 0 30 18">
      <Path
        d="M2 14 C2 6 12 4 14 10 C15 14 10 15 9 12 M14 10 C16 2 28 3 28 10 C28 15 21 16 21 12 C21 9 25 9 25 11"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Layered Kanchenjunga ridge for empty states and backgrounds. */
export function Mountains({ height = 120, back = colors.line, front = colors.sand }: { height?: number; back?: string; front?: string }) {
  return (
    <Svg width="100%" height={height} viewBox="0 0 360 120" preserveAspectRatio="none">
      <Polygon points="0,120 0,80 50,45 85,70 140,20 175,48 205,30 250,62 300,35 360,75 360,120" fill={back} />
      <Polygon points="140,20 128,34 140,30 152,36" fill={colors.white} opacity={0.9} />
      <Polygon points="205,30 196,40 206,37 214,42" fill={colors.white} opacity={0.9} />
      <Polygon points="0,120 0,95 60,70 120,92 190,66 260,90 320,72 360,88 360,120" fill={front} />
    </Svg>
  );
}

/** Thin carved wooden shelf line under home product rows. */
/** Light gold hairline under home shelves (a thin carved edge, not a heavy bar). */
export function ShelfLine() {
  return <View accessible={false} style={{ marginHorizontal: 16, marginTop: 4, height: 1, backgroundColor: colors.goldDeep, opacity: 0.35 }} />;
}
