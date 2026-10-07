'use client';

import { useEffect, useState } from 'react';

/** Current time that re-renders every `ms` — keeps "waiting 5 min" style labels pure. */
export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
