import { Pressable, View } from 'react-native';

import { colors } from '@/theme';

import { CloudScroll } from './ornaments';
import { Txt } from './Txt';

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10, gap: 8 }}>
      <CloudScroll />
      <Txt variant="h2" style={{ flex: 1 }}>
        {title}
      </Txt>
      {action && (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="link">
          <Txt variant="strong" color={colors.turquoise}>
            {action} ›
          </Txt>
        </Pressable>
      )}
    </View>
  );
}
