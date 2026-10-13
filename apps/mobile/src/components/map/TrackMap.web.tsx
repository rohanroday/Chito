import { useEffect, useMemo, useRef } from 'react';

import { trackHtml, type TrackMapProps } from './track-html';

/** Web: same tracking map in an iframe; positions arrive by postMessage. */
export function TrackMap(props: TrackMapProps) {
  const { rider } = props;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => trackHtml(props), []);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (rider) frame.current?.contentWindow?.postMessage({ chitoRider: rider }, '*');
  }, [rider]);
  return <iframe ref={frame} title="Rider on the map" srcDoc={html} style={{ border: 0, width: '100%', height: '100%' }} />;
}
