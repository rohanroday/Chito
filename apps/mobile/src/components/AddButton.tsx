import { Minus, Plus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useCart } from '@/state/cart';
import { colors, radius } from '@/theme';

import { Txt } from './Txt';

/** "+ Add" maroon pill that becomes a maroon stepper with gold numbers. */
export function AddButton({
  slug,
  disabled = false,
  size = 'md',
  block = false,
}: {
  slug: string;
  disabled?: boolean;
  size?: 'md' | 'lg';
  /** Stretch to the parent's width (compact 3-column cards). */
  block?: boolean;
}) {
  const qty = useCart((s) => s.items[slug] ?? 0);
  const add = useCart((s) => s.add);
  const remove = useCart((s) => s.remove);
  const h = size === 'lg' ? 46 : 34;
  const w = size === 'lg' ? 140 : 84;
  const widthStyle = block ? { alignSelf: 'stretch' as const } : { minWidth: w };

  if (disabled) {
    return (
      <View style={{ height: h, ...widthStyle, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
        <Txt variant="micro" color={colors.subtle}>
          SOLD OUT
        </Txt>
      </View>
    );
  }

  if (qty === 0) {
    return (
      <Pressable
        onPress={() => add(slug)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Add to jhola"
        style={({ pressed }) => ({
          height: h,
          ...widthStyle,
          borderRadius: radius.pill,
          borderWidth: 1.5,
          borderColor: colors.maroon,
          backgroundColor: pressed ? colors.maroon50 : colors.card,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          paddingHorizontal: 12,
        })}>
        <Plus size={16} color={colors.maroon} strokeWidth={2.5} />
        <Txt variant="button" color={colors.maroon}>
          Add
        </Txt>
      </Pressable>
    );
  }

  return (
    <View
      accessibilityLabel={`${qty} in jhola`}
      style={{
        height: h,
        ...widthStyle,
        borderRadius: radius.pill,
        backgroundColor: colors.maroon,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
      <Pressable onPress={() => remove(slug)} hitSlop={8} accessibilityLabel="Remove one" style={{ paddingHorizontal: 10, height: h, justifyContent: 'center' }}>
        <Minus size={16} color={colors.gold} strokeWidth={2.5} />
      </Pressable>
      <Txt variant="button" color={colors.gold}>
        {qty}
      </Txt>
      <Pressable onPress={() => add(slug)} hitSlop={8} accessibilityLabel="Add one more" style={{ paddingHorizontal: 10, height: h, justifyContent: 'center' }}>
        <Plus size={16} color={colors.gold} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}
