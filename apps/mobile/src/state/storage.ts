import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

export const persistStorage = createJSONStorage(() => AsyncStorage);

// Login tokens live in the phone's encrypted keystore (SecureStore). Web has no keystore,
// so it falls back to AsyncStorage (localStorage) there.
const secure: StateStorage = {
  getItem: (k) => SecureStore.getItemAsync(k),
  setItem: (k, v) => SecureStore.setItemAsync(k, v),
  removeItem: (k) => SecureStore.deleteItemAsync(k),
};
export const securePersistStorage = createJSONStorage(() => (Platform.OS === 'web' ? AsyncStorage : secure));
