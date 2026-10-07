// Tiny in-memory limiter for guessable secrets (admin password, OTP).
// One API process is enough for Chito today; with several servers this would move to Redis/Mongo.
import { HttpError } from './http.js';

type Bucket = { failures: number; resetAt: number };

export function failureLimiter({ max, windowMs, message }: { max: number; windowMs: number; message: string }) {
  const buckets = new Map<string, Bucket>();

  // Forget old entries so memory can't grow forever
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }, windowMs).unref();

  return {
    /** Throws 429 if this key already failed too often. Call before checking the secret. */
    assertAllowed(key: string) {
      const b = buckets.get(key);
      if (b && b.resetAt > Date.now() && b.failures >= max) {
        const mins = Math.ceil((b.resetAt - Date.now()) / 60000);
        throw new HttpError(429, 'TOO_MANY_ATTEMPTS', `${message} Try again in ${mins} ${mins === 1 ? 'minute' : 'minutes'}.`);
      }
    },
    /** Count a wrong guess. */
    fail(key: string) {
      const now = Date.now();
      const b = buckets.get(key);
      if (!b || b.resetAt <= now) buckets.set(key, { failures: 1, resetAt: now + windowMs });
      else b.failures += 1;
    },
    /** A correct guess clears the slate. */
    succeed(key: string) {
      buckets.delete(key);
    },
  };
}
