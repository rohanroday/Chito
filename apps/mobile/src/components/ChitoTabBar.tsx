import { router, type Tabs } from 'expo-router';
import { ChevronRight, House, LayoutGrid, Package, ShoppingBag, User } from 'lucide-react-native';
import { type ComponentProps, useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { rupees } from '@/lib/format';
import { cartLines, cartTotals, useCart } from '@/state/cart';
import { useProductMap } from '@/state/catalog';
import { colors, radius, shadow } from '@/theme';

import { Txt } from './Txt';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: Record<string, { label: string; Icon: typeof House }> = {
  index: { label: 'Home', Icon: House },
  categories: { label: 'Categories', Icon: LayoutGrid },
  jhola: { label: 'Jhola', Icon: ShoppingBag },
  orders: { label: 'Orders', Icon: Package },
  me: { label: 'Me', Icon: User },
};

function useCartSummary() {
  const items = useCart((s) => s.items);
  const products = useProductMap();
  return cartTotals(cartLines(items, products));
}

/** Bottom nav with the raised centre "Jhola" (cart) and a floating maroon checkout pill. */
export function ChitoTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { count, itemTotal } = useCartSummary();
  const current = state.routes[state.index]?.name;

  // Bounce the jhola when the count changes
  const bounce = useSharedValue(1);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    bounce.value = withSequence(withSpring(1.15, { damping: 6 }), withSpring(1));
  }, [count, bounce]);
  const jholaStyle = useAnimatedStyle(() => ({ transform: [{ scale: bounce.value }] }));

  return (
    <View pointerEvents="box-none">
      {count > 0 && current !== 'jhola' && (
        <Pressable
          onPress={() => router.navigate('/jhola')}
          accessibilityRole="button"
          accessibilityLabel={`${count} items, ${rupees(itemTotal)}. Checkout`}
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 74 + insets.bottom + 12,
            height: 52,
            backgroundColor: colors.maroon,
            borderTopLeftRadius: 26,
            borderBottomLeftRadius: 26,
            borderTopRightRadius: radius.md,
            borderBottomRightRadius: radius.md,
            borderWidth: 1.5,
            borderColor: colors.goldDeep,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 18,
            ...shadow,
          }}>
          <ShoppingBag size={20} color={colors.gold} />
          <Txt variant="button" color={colors.gold} style={{ marginLeft: 10, flex: 1 }}>
            {count} {count === 1 ? 'item' : 'items'} · {rupees(itemTotal)}
          </Txt>
          <Txt variant="button" color={colors.gold}>
            Checkout
          </Txt>
          <ChevronRight size={18} color={colors.gold} />
        </Pressable>
      )}

      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.line,
          paddingBottom: insets.bottom,
          height: 66 + insets.bottom,
        }}>
        {state.routes.map((route, i) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === i;
          const onPress = () => {
            const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
          };

          if (route.name === 'jhola') {
            return (
              <Pressable key={route.key} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={`Jhola, ${count} items`} style={{ flex: 1, alignItems: 'center' }}>
                <Animated.View
                  style={[
                    {
                      marginTop: -24,
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: colors.maroon,
                      borderWidth: 3,
                      borderColor: colors.gold,
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...shadow,
                    },
                    jholaStyle,
                  ]}>
                  <ShoppingBag size={26} color={colors.gold} />
                  {count > 0 && (
                    <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.maroon, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                      <Txt variant="micro" color={colors.maroon}>
                        {count}
                      </Txt>
                    </View>
                  )}
                </Animated.View>
                <Txt variant="micro" color={focused ? colors.maroon : colors.muted} style={{ marginTop: 2 }}>
                  Jhola
                </Txt>
              </Pressable>
            );
          }

          const { Icon, label } = tab;
          return (
            <Pressable key={route.key} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={label} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              {focused && <View style={{ position: 'absolute', top: 0, width: 28, height: 3, borderRadius: 2, backgroundColor: colors.gold }} />}
              <Icon size={22} color={focused ? colors.maroon : colors.muted} strokeWidth={focused ? 2.4 : 2} />
              <Txt variant="micro" color={focused ? colors.maroon : colors.muted}>
                {label}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
