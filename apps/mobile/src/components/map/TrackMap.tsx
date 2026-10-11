import { useEffect, useMemo, useRef } from 'react';
import { WebView } from 'react-native-webview';

import type { Pin } from '@/state/auth';

import { trackHtml } from './track-html';

/** Phone: read-only map with the delivery pin and the rider moving towards it. */
export function TrackMap({ home, rider }: { home: Pin; rider: Pin | null }) {
  const ref = useRef<WebView>(null);
  // Built once; later positions are pushed into the page
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => trackHtml({ home, rider }), []);
  useEffect(() => {
    if (rider) ref.current?.injectJavaScript(`window.moveRider && window.moveRider(${rider.lat},${rider.lng}); true;`);
  }, [rider]);
  return <WebView ref={ref} originWhitelist={['*']} source={{ html, baseUrl: 'https://chito.app/' }} style={{ flex: 1 }} scrollEnabled={false} />;
}
