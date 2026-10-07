// A Sikkimese gompa (inspired by Rumtek / Enchey) — architecture only, no sacred figures.
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';

import { colors, flagColors } from '@/theme';

const WALL = '#FBF4E6';
const WALL_SHADE = '#EADFCB';
const FRIEZE = '#4A0F17';
const WINDOW_FRAME = '#1A1110';

function TibetanWindow({ x, y, w = 18, h = 20 }: { x: number; y: number; w?: number; h?: number }) {
  // Black trapezoid surround (wider at the bottom) — signature of Himalayan monastery windows
  return (
    <G>
      <Polygon points={`${x - 5},${y + h + 5} ${x + w + 5},${y + h + 5} ${x + w + 2},${y - 3} ${x - 2},${y - 3}`} fill={WINDOW_FRAME} />
      <Rect x={x - 2} y={y - 6} width={w + 4} height={3} fill={colors.vermilion} />
      <Rect x={x} y={y} width={w} height={h} fill={colors.turquoise} />
      <Line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke={colors.gold} strokeWidth={1.2} />
      <Line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} stroke={colors.gold} strokeWidth={1.2} />
    </G>
  );
}

function Dentils({ x, y, w, n }: { x: number; y: number; w: number; n: number }) {
  const step = w / n;
  return (
    <G>
      {Array.from({ length: n }, (_, i) => (
        <Rect key={i} x={x + i * step + step * 0.25} y={y} width={step * 0.5} height={3} fill={colors.goldDeep} />
      ))}
    </G>
  );
}

/** Mountains + monastery. viewBox 300x260; scale via width/height props. */
export function MonasteryScene({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 300 260">
      <Defs>
        <LinearGradient id="roof" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.gold} />
          <Stop offset="1" stopColor={colors.goldDeep} />
        </LinearGradient>
        <LinearGradient id="snow" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.3" />
        </LinearGradient>
      </Defs>

      {/* Sun rising behind Kanchenjunga */}
      <Circle cx={210} cy={70} r={34} fill={colors.gold} opacity={0.22} />
      <Circle cx={210} cy={70} r={22} fill={colors.gold} opacity={0.35} />

      {/* Kanchenjunga range */}
      <Polygon points="0,170 0,120 40,92 70,110 120,50 150,78 175,58 215,96 255,62 300,104 300,170" fill="#9A3A45" />
      <Polygon points="120,50 104,70 116,66 122,74 130,64 140,70" fill="url(#snow)" />
      <Polygon points="175,58 164,72 174,69 182,76 190,70" fill="url(#snow)" />
      <Polygon points="255,62 244,76 254,73 262,80 270,74" fill="url(#snow)" />
      {/* Foreground hills */}
      <Path d="M0 190 Q60 150 120 172 T240 165 T300 172 L300 260 L0 260 Z" fill={colors.maroon700} />

      {/* Prayer-flag strings from the finial to the hills */}
      {[
        { x2: 8, y2: 150 },
        { x2: 292, y2: 150 },
      ].map(({ x2, y2 }, s) => (
        <G key={s}>
          <Line x1={150} y1={58} x2={x2} y2={y2} stroke="#E8DCC4" strokeWidth={0.6} opacity={0.7} />
          {Array.from({ length: 9 }, (_, i) => {
            const t = (i + 1) / 10;
            const fx = 150 + (x2 - 150) * t;
            const fy = 58 + (y2 - 58) * t;
            return <Rect key={i} x={fx - 3} y={fy} width={6} height={8} fill={flagColors[i % 5]} opacity={0.95} />;
          })}
        </G>
      ))}

      {/* Base platform and steps */}
      <Rect x={28} y={226} width={244} height={10} fill={WALL_SHADE} />
      <Rect x={20} y={234} width={260} height={8} fill="#D9CBB0" />
      <Rect x={128} y={218} width={44} height={8} fill={WALL_SHADE} />

      {/* Lower hall — tapered whitewashed walls */}
      <Polygon points="44,226 256,226 250,140 50,140" fill={WALL} />
      <Polygon points="230,226 256,226 250,140 232,140" fill={WALL_SHADE} />
      {/* Maroon frieze with gold dentils */}
      <Rect x={48} y={128} width={204} height={14} fill={FRIEZE} />
      <Dentils x={50} y={134} w={200} n={34} />

      <TibetanWindow x={66} y={160} />
      <TibetanWindow x={100} y={160} />
      <TibetanWindow x={182} y={160} />
      <TibetanWindow x={216} y={160} />

      {/* Main door with canopy */}
      <Rect x={133} y={168} width={34} height={50} fill={colors.maroon} stroke={colors.gold} strokeWidth={1.5} />
      <Line x1={150} y1={168} x2={150} y2={218} stroke={colors.goldDeep} strokeWidth={1} />
      <Circle cx={146} cy={194} r={1.4} fill={colors.gold} />
      <Circle cx={154} cy={194} r={1.4} fill={colors.gold} />
      <Path d="M124 166 L176 166 L170 156 L130 156 Z" fill="url(#roof)" />
      <Rect x={130} y={152} width={40} height={4} fill={FRIEZE} />

      {/* Lower roof eave (upturned corners) */}
      <Path d="M30 132 Q38 124 50 124 L250 124 Q262 124 270 132 L258 129 L42 129 Z" fill="url(#roof)" />

      {/* Upper storey */}
      <Polygon points="86,124 214,124 210,84 90,84" fill={WALL} />
      <Polygon points="196,124 214,124 210,84 197,84" fill={WALL_SHADE} />
      <Rect x={88} y={76} width={124} height={10} fill={FRIEZE} />
      <Dentils x={90} y={80} w={120} n={20} />
      <TibetanWindow x={104} y={96} w={14} h={16} />
      <TibetanWindow x={143} y={96} w={14} h={16} />
      <TibetanWindow x={182} y={96} w={14} h={16} />

      {/* Pagoda roof, two tiers */}
      <Path d="M64 82 Q76 72 96 70 L150 54 L204 70 Q224 72 236 82 L220 79 Q150 66 80 79 Z" fill="url(#roof)" />
      <Path d="M108 58 Q118 52 128 51 L150 42 L172 51 Q182 52 192 58 L178 56 Q150 50 122 56 Z" fill="url(#roof)" />

      {/* Gold finial */}
      <Rect x={146} y={34} width={8} height={9} rx={2} fill="url(#roof)" />
      <Circle cx={150} cy={31} r={4.5} fill={colors.gold} />
      <Path d="M148.5 27 L150 16 L151.5 27 Z" fill={colors.gold} />
    </Svg>
  );
}
