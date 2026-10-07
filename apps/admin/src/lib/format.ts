const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

/** Money is integer paise everywhere (₹1 = 100). */
export const rupees = (paise: number) => inr.format(Math.round(paise / 100));
export const toPaise = (rupeesValue: number) => Math.round(rupeesValue * 100);
export const toRupees = (paise: number) => Math.round(paise) / 100;

export function clock(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
}

export function minutesSince(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

export function imageUrl(path: string | undefined, width: number) {
  if (!path) return '';
  const base = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT ?? '';
  return `${base}${path}?tr=w-${width},f-auto,q-80`;
}

/** Short beep for new orders (no audio asset needed). */
export function chime() {
  try {
    const ctx = new AudioContext();
    [0, 0.18].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i ? 1046 : 784;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    });
  } catch {
    // audio blocked until the page gets a click — fine
  }
}
