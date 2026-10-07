import { Mukta_400Regular, Mukta_500Medium, Mukta_600SemiBold, Mukta_700Bold } from '@expo-google-fonts/mukta';
import { YatraOne_400Regular } from '@expo-google-fonts/yatra-one';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { api } from '@/api/client';
import { getSocket } from '@/api/socket';
import type { Me, StoreInfo } from '@/api/types';
import { AnimatedSplash } from '@/components/AnimatedSplash';
import { useAuth, useProfile } from '@/state/auth';
import { useCatalogStore, useStoreInfoStore } from '@/state/catalog';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    YatraOne_400Regular,
    Mukta_400Regular,
    Mukta_500Medium,
    Mukta_600SemiBold,
    Mukta_700Bold,
  });
  const sessionHydrated = useAuth((s) => s.hydrated);
  const profileHydrated = useProfile((s) => s.hydrated);
  const hydrated = sessionHydrated && profileHydrated;
  const loggedIn = useAuth((s) => !!s.phone);
  const [showIntro, setShowIntro] = useState(true);
  const ready = (fontsLoaded || !!fontError) && hydrated;

  useEffect(() => {
    // Hand over from the native maroon splash to the animated gompa splash
    if (ready) SplashScreen.hide();
  }, [ready]);

  // Fresh catalogue + store settings (prices, hours, open/closed) on launch and whenever the app returns
  useEffect(() => {
    const refresh = () => {
      useCatalogStore.getState().load();
      useStoreInfoStore.getState().load();
    };
    refresh();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && refresh());
    // Backup check every 2 min in case the live connection drops (open/close, hours ending)
    const poll = setInterval(() => AppState.currentState === 'active' && useStoreInfoStore.getState().load(), 120_000);
    return () => {
      sub.remove();
      clearInterval(poll);
    };
  }, []);

  // Keep the profile in step with the server (name changed on another phone; a removed or
  // logged-out-everywhere account gets a 401 here, and api() sends it back to login)
  useEffect(() => {
    if (!loggedIn) return;
    const sync = () =>
      api<Me>('/me')
        .then((me) => {
          if (me.name && me.name !== useAuth.getState().name) useAuth.getState().setName(me.name);
        })
        .catch(() => undefined); // offline: keep what we have
    sync();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && sync());
    return () => sub.remove();
  }, [loggedIn]);

  // Live: the admin flips Open/Closed → every logged-in phone updates instantly
  useEffect(() => {
    if (!loggedIn) return;
    const socket = getSocket();
    const onStore = (info: StoreInfo) => useStoreInfoStore.setState({ info, loadedAt: Date.now() });
    socket.on('store:updated', onStore);
    return () => {
      socket.off('store:updated', onStore);
    };
  }, [loggedIn]);

  const endIntro = useCallback(() => setShowIntro(false), []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.parchment }}>
      <StatusBar style={showIntro ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.parchment } }}>
          <Stack.Protected guard={loggedIn}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="product/[slug]" />
            <Stack.Screen name="search" options={{ animation: 'fade' }} />
            <Stack.Screen name="order/[id]" />
            <Stack.Screen name="address" />
            <Stack.Screen name="addresses" />
            <Stack.Screen name="payment-return/[id]" options={{ animation: 'none' }} />
            <Stack.Screen name="map-pick" options={{ animation: 'slide_from_bottom' }} />
          </Stack.Protected>
          <Stack.Protected guard={!loggedIn}>
            <Stack.Screen name="login" />
          </Stack.Protected>
        </Stack>
        {showIntro && <AnimatedSplash onDone={endIntro} />}
      </View>
    </GestureHandlerRootView>
  );
}
