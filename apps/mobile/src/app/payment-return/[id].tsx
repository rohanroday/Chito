import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { colors } from '@/theme';

/**
 * Razorpay's result page sends the customer here (chito://payment-return/<id>, or exp://… in Expo Go).
 * Usually the order screen is right underneath, so just go back to it; otherwise open it.
 */
export default function PaymentReturn() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/order/[id]', params: { id } });
  }, [id]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.maroon} />
    </View>
  );
}
