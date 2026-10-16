import { useEffect } from 'react';

import type { CheckoutOptions } from '@/lib/payment';

export type PayOutcome = 'paid' | 'failed' | 'dismissed' | 'error';

/** Web opens Razorpay's Checkout on the order page itself (lib/payment.ts), so this page just steps back. */
export function PayCheckoutView({ onOutcome }: { opts: CheckoutOptions; onOutcome: (o: PayOutcome, message?: string) => void }) {
  useEffect(() => onOutcome('dismissed'), [onOutcome]);
  return null;
}
