import { Tabs } from 'expo-router';

import { ChitoTabBar } from '@/components/ChitoTabBar';
import { StoreClosedPopup } from '@/components/StoreClosedStrip';
import { colors } from '@/theme';

export default function TabLayout() {
  return (
    <>
      <Tabs
        tabBar={(props) => <ChitoTabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.parchment } }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="categories" />
        <Tabs.Screen name="jhola" />
        <Tabs.Screen name="orders" />
        <Tabs.Screen name="me" />
      </Tabs>
      {/* Tells customers clearly when the store is closed, on any tab */}
      <StoreClosedPopup />
    </>
  );
}
