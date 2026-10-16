import { Mukta_400Regular, Mukta_500Medium, Mukta_600SemiBold, Mukta_700Bold } from '@expo-google-fonts/mukta';
import { YatraOne_400Regular } from '@expo-google-fonts/yatra-one';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { closeSocket, getSocket } from '@/api/socket';
import type { RiderOrder } from '@/api/types';
import { startSharing, stopSharing } from '@/lib/location-share';
import { useAuth } from '@/state/auth';
import { activeOrders, useDeliveries } from '@/state/deliveries';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ YatraOne_400Regular, Mukta_400Regular, Mukta_500Medium, Mukta_600SemiBold, Mukta_700Bold });
  const hydrated = useAuth((s) => s.hydrated);
  const loggedIn = useAuth((s) => !!s.rider);
  const ready = (fontsLoaded || !!fontError) && hydrated;
  const orders = useDeliveries((s) => s.orders);
  const status = useDeliveries((s) => s.me?.status);
  const delivering = activeOrders(orders).length > 0 && status !== 'OFF_DUTY';

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  // Live: new deliveries from the store, and changes (e.g. the admin cancels one)
  useEffect(() => {
    if (!loggedIn) return;
    const { load, upsert } = useDeliveries.getState();
    load();
    const socket = getSocket();
    const onAssigned = (o: RiderOrder) => upsert(o, true);
    const onUpdated = (o: RiderOrder) => upsert(o);
    socket.on('order:assigned', onAssigned);
    socket.on('order:updated', onUpdated);
    // Back from the background (or a dropped connection): catch up
    const sub = AppState.addEventListener('change', (st) => st === 'active' && load());
    return () => {
      socket.off('order:assigned', onAssigned);
      socket.off('order:updated', onUpdated);
      sub.remove();
    };
  }, [loggedIn]);

  // Share location only while there's an order on the way
  useEffect(() => {
    if (loggedIn && delivering) startSharing();
    else stopSharing();
  }, [loggedIn, delivering]);

  // Logged out (by the rider or because the store ended the session): forget everything
  useEffect(() => {
    if (loggedIn) return;
    stopSharing();
    closeSocket();
    useDeliveries.getState().reset();
  }, [loggedIn]);

  if (!ready) return null;
  return (
    // Keeps the field you're typing in above the keyboard (Android draws edge-to-edge, so the screen no longer resizes)
    <KeyboardProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.parchment } }}>
        <Stack.Protected guard={loggedIn}>
          <Stack.Screen name="index" />
          <Stack.Screen name="order/[id]" />
        </Stack.Protected>
        <Stack.Protected guard={!loggedIn}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </KeyboardProvider>
  );
}
