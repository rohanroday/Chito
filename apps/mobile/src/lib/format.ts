const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** Money is always integer paise (₹1 = 100). */
export function rupees(paise: number): string {
  return inr.format(Math.round(paise / 100));
}

export function timeOfDay(date: Date): string {
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}
