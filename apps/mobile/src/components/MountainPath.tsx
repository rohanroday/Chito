import { Bike } from 'lucide-react-native';
import { View } from 'react-native';
import Svg, { Circle, G, Path, Polygon, Rect } from 'react-native-svg';

import type { Order } from '@/api/types';
import { timeOfDay } from '@/lib/format';
import { ORDER_STEPS, STATUS_LABEL, stepIndex } from '@/state/orders';
import { colors } from '@/theme';

import { Mountains } from './ornaments';
import { Txt } from './Txt';

// Milestones climb from the bazaar (bottom) up the hill road to the customer (top)
const POINTS = [
  { x: 40, y: 272 },
  { x: 222, y: 228 },
  { x: 70, y: 170 },
  { x: 230, y: 108 },
  { x: 118, y: 46 },
];
const LEGS = [
  'M40 272 C140 284 236 262 222 228',
  'M222 228 C206 196 60 206 70 170',
  'M70 170 C80 134 240 146 230 108',
  'M230 108 C220 72 130 78 118 46',
];

/** Stepped marker (a simple terraced silhouette — no religious detail). */
function Marker({ x, y, fill }: { x: number; y: number; fill: string }) {
  return (
    <G>
      <Rect x={x - 9} y={y + 2} width={18} height={5} fill={fill} />
      <Rect x={x - 6} y={y - 3} width={12} height={5} fill={fill} />
      <Polygon points={`${x - 4},${y - 3} ${x + 4},${y - 3} ${x},${y - 12}`} fill={fill} />
    </G>
  );
}

export function MountainPath({ order, width }: { order: Pick<Order, 'status' | 'statusHistory'>; width: number }) {
  const scale = width / 300;
  const current = stepIndex(order.status);
  const failed = order.status === 'DELIVERY_FAILED';
  // Latest time each step was reached (a re-attempt after a failed delivery repeats OUT_FOR_DELIVERY)
  const timeFor = (s: string) => [...order.statusHistory].reverse().find((h) => h.status === s)?.at;
  const cur = POINTS[Math.max(0, current)];

  return (
    <View style={{ width, height: width }}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <Mountains height={70 * scale} />
      </View>
      <Svg width={width} height={width} viewBox="0 0 300 300">
        {LEGS.map((d, i) => (
          <Path
            key={i}
            d={d}
            stroke={i < current ? colors.leaf : colors.line}
            strokeWidth={i < current ? 5 : 4}
            strokeDasharray={i < current ? undefined : '2 8'}
            strokeLinecap="round"
            fill="none"
          />
        ))}
        {POINTS.map((p, i) => {
          const fill = i < current ? colors.leaf : i === current ? colors.goldDeep : colors.subtle;
          return (
            <G key={i}>
              {i === current && <Circle cx={p.x} cy={p.y} r={18} fill={failed ? colors.vermilion : colors.gold} opacity={0.35} />}
              <Marker x={p.x} y={p.y} fill={fill} />
            </G>
          );
        })}
      </Svg>

      {/* Labels */}
      {POINTS.map((p, i) => {
        const step = ORDER_STEPS[i];
        const at = timeFor(step);
        const right = p.x < 150;
        return (
          <View
            key={step}
            style={{
              position: 'absolute',
              top: p.y * scale - 12,
              ...(right ? { left: p.x * scale + 22 } : { right: (300 - p.x) * scale + 22 }),
              alignItems: right ? 'flex-start' : 'flex-end',
            }}>
            <Txt variant="strong" color={failed && i === current ? colors.vermilion : i <= current ? colors.ink : colors.subtle} style={{ fontSize: 14 }}>
              {failed && i === current ? STATUS_LABEL.DELIVERY_FAILED : STATUS_LABEL[step]}
            </Txt>
            {at && (
              <Txt variant="caption" color={colors.muted}>
                ✓ {timeOfDay(new Date(at))}
              </Txt>
            )}
          </View>
        );
      })}

      {/* The rider's scooter sits at the current step */}
      {current >= 0 && current < ORDER_STEPS.length - 1 && (
        <View
          style={{
            position: 'absolute',
            left: cur.x * scale - 16,
            top: cur.y * scale - 44,
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: failed ? colors.vermilion : colors.maroon,
            borderWidth: 2,
            borderColor: colors.gold,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Bike size={18} color={colors.gold} />
        </View>
      )}
    </View>
  );
}
