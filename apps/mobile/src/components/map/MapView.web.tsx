import { useEffect, useMemo, useRef } from 'react';

import { type MapHtmlOptions, type MapMessage, mapHtml, parseMapMessage } from './map-html';

/** Web: same Leaflet page in an iframe; it talks back with postMessage. */
export function MapView({ onMessage, reloadKey = 0, ...opts }: MapHtmlOptions & { onMessage: (m: MapMessage) => void; reloadKey?: number }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => mapHtml(opts), [reloadKey]);
  const frame = useRef<HTMLIFrameElement>(null);
  const cb = useRef(onMessage);
  useEffect(() => {
    cb.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const listener = (e: MessageEvent<{ chitoMap?: string }>) => {
      if (e.source !== frame.current?.contentWindow || !e.data?.chitoMap) return;
      const m = parseMapMessage(e.data.chitoMap);
      if (m) cb.current(m);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);

  return <iframe key={reloadKey} ref={frame} title="Map" srcDoc={html} style={{ border: 0, width: '100%', height: '100%', flex: 1 }} />;
}
