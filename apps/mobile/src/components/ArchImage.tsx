import { Image } from 'expo-image';
import { View, type ViewStyle } from 'react-native';

import { imageUrl } from '@/lib/image';
import { colors } from '@/theme';

/** Product image inside a gompa-window arch (rounded top, square-ish bottom). */
export function ArchImage({
  path,
  size,
  width,
  dim = false,
  style,
}: {
  path: string;
  size: number;
  width?: number;
  dim?: boolean;
  style?: ViewStyle;
}) {
  const w = width ?? size;
  return (
    <View
      style={[
        {
          width: w,
          height: size,
          borderTopLeftRadius: w / 2,
          borderTopRightRadius: w / 2,
          borderBottomLeftRadius: 8,
          borderBottomRightRadius: 8,
          borderWidth: 1.5,
          borderColor: colors.goldDeep,
          backgroundColor: colors.white,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'flex-end',
        },
        style,
      ]}>
      <Image
        source={{ uri: imageUrl(path, Math.round(w * 2)) }}
        style={{ width: w * 0.86, height: size * 0.78, marginBottom: size * 0.04, opacity: dim ? 0.45 : 1 }}
        contentFit="contain"
        transition={150}
        cachePolicy="memory-disk"
      />
    </View>
  );
}
