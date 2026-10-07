import { useMemo } from 'react';
import { WebView } from 'react-native-webview';

import { type MapHtmlOptions, type MapMessage, mapHtml, parseMapMessage } from './map-html';

/** Phone: Leaflet map in a WebView. Reports moves (map centre = pin), "ready" and load errors. */
export function MapView({ onMessage, reloadKey = 0, ...opts }: MapHtmlOptions & { onMessage: (m: MapMessage) => void; reloadKey?: number }) {
  // Build the page once per reload; later moves happen inside the map
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => mapHtml(opts), [reloadKey]);
  return (
    <WebView
      key={reloadKey}
      originWhitelist={['*']}
      source={{ html, baseUrl: 'https://chito.app/' }}
      onMessage={(e) => {
        const m = parseMapMessage(e.nativeEvent.data);
        if (m) onMessage(m);
      }}
      onError={(e) => onMessage({ type: 'error', message: e.nativeEvent.description || 'Map could not load' })}
      javaScriptEnabled
      domStorageEnabled
      nestedScrollEnabled
      setSupportMultipleWindows={false}
      style={{ flex: 1, backgroundColor: 'transparent' }}
    />
  );
}
