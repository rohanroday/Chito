import { Alert, Linking } from 'react-native';

import { useStoreInfoStore } from '@/state/catalog';

// Support number comes from the store settings (admin dashboard), with the .env value as fallback.
function supportPhone() {
  const fromStore = useStoreInfoStore.getState().info.supportPhone;
  return (fromStore || process.env.EXPO_PUBLIC_SUPPORT_PHONE || '').replace(/[^\d+]/g, '');
}

function notSet() {
  Alert.alert('Support number not set', 'Add the support phone in the admin dashboard → Settings.');
}

export function callSupport() {
  const phone = supportPhone();
  if (!phone) return notSet();
  Linking.openURL(`tel:${phone}`);
}

export function whatsappSupport(message = 'Tashi Delek Chito! I need help with my order.') {
  const phone = supportPhone();
  if (!phone) return notSet();
  Linking.openURL(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`);
}
