// In-app payment page: Razorpay's standard Checkout on a full screen (never a Modal: WebViews in Modals are unreliable
// on Android). Used when the native Razorpay module isn't available. The server confirms every payment.
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ShieldCheck } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { Button } from '@/components/Button';
import { DentilBorder } from '@/components/ornaments';
import { PayCheckoutView, type PayOutcome } from '@/components/PayCheckoutView';
import { Txt } from '@/components/Txt';
import { rupees } from '@/lib/format';
import { type CheckoutOptions, getCheckoutOptions, refreshPayment } from '@/lib/payment';
import { colors } from '@/theme';

export default function PayScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [opts, setOpts] = useState<CheckoutOptions | null>(null);
  const [error, setError] = useState('');
  const [finishing, setFinishing] = useState(false);
  const done = useRef(false);

  const load = useCallback(() => {
    getCheckoutOptions(id)
      .then(setOpts)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not start the payment. Check your connection and try again.'));
  }, [id]);
  useEffect(load, [load]);

  const back = useCallback(() => (router.canGoBack() ? router.back() : router.replace({ pathname: '/order/[id]', params: { id } })), [id]);

  // Whatever happened, ask the server (it checks with Razorpay) and go back to the order, which shows the result
  const finish = useCallback(
    async (outcome: PayOutcome, message?: string) => {
      if (done.current) return;
      if (outcome === 'error') {
        setError(message ? `Payment window problem: ${message}` : 'Could not open the payment window.');
        return;
      }
      done.current = true;
      setFinishing(true);
      await refreshPayment(id).catch(() => null);
      back();
    },
    [id, back],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.parchment }}>
      <View style={{ backgroundColor: colors.maroon, paddingTop: insets.top + 8, paddingHorizontal: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable onPress={() => finish('dismissed')} hitSlop={12} accessibilityLabel="Back" style={{ padding: 4 }}>
          <ChevronLeft size={26} color={colors.gold} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Txt variant="h2" color={colors.gold}>
            {opts ? `Pay ${rupees(opts.amount)}` : 'Payment'}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <ShieldCheck size={14} color={colors.white} />
            <Txt variant="caption" color={colors.white} style={{ opacity: 0.85 }}>
              Secured by Razorpay
            </Txt>
          </View>
        </View>
      </View>
      <DentilBorder />

      {opts && !finishing && !error && <PayCheckoutView opts={opts} onOutcome={finish} />}

      {(!opts || finishing) && !error && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color={colors.maroon} size="large" />
          <Txt color={colors.muted}>{finishing ? 'Checking your payment…' : 'Opening Razorpay…'}</Txt>
        </View>
      )}

      {!!error && (
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12, paddingBottom: insets.bottom + 24 }}>
          <Txt variant="strong" color={colors.vermilion} style={{ textAlign: 'center' }}>
            {error}
          </Txt>
          <Button
            title="Try again"
            onPress={() => {
              setError('');
              setOpts(null);
              load();
            }}
          />
          <Button title="Back to my order" variant="ghost" onPress={() => finish('dismissed')} />
        </View>
      )}
    </View>
  );
}
