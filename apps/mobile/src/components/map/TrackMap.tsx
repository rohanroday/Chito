import { useEffect, useMemo, useRef } from 'react';
import { WebView } from 'react-native-webview';

import { trackHtml, type TrackMapProps } from './track-html';

/** Phone: read-only map with the store, the delivery pin and the rider moving towards it. */
export function TrackMap(props: TrackMapProps) {
  const { rider } = props;
  const ref = useRef<WebView>(null);
  // Built once; later positions are pushed into the page
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => trackHtml(props), []);
  useEffect(() => {
    if (rider) ref.current?.injectJavaScript(`window.moveRider && window.moveRider(${rider.lat},${rider.lng}); true;`);
  }, [rider]);
  return <WebView ref={ref} originWhitelist={['*']} source={{ html, baseUrl: 'https://chito.app/' }} style={{ flex: 1 }} scrollEnabled={false} />;
}
