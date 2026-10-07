'use client';

import { AlertTriangle, Banknote, ChevronLeft, ChevronRight, ClipboardList, Printer, RotateCcw, Smartphone, Wallet } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { clock, rupees } from '@/lib/format';
import { type DayReport, type DaySummary, type Order, STATUS_LABEL } from '@/lib/types';

// Days are Asia/Kolkata calendar days ("2026-10-06")
const shiftDay = (day: string, by: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
};
const longDate = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDate = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

function payLabel(o: Order) {
  if (o.paymentMethod === 'COD') return { text: 'Cash', tone: 'bg-sand text-wood' };
  if (o.paymentStatus === 'PAID') return { text: 'Online · paid', tone: 'bg-leaf-50 text-leaf' };
  if (o.paymentStatus === 'REFUNDED') return { text: 'Online · refunded', tone: 'bg-sand text-muted' };
  if (o.paymentStatus === 'REFUND_FAILED') return { text: 'Online · refund due', tone: 'bg-vermilion-50 text-vermilion' };
  return { text: 'Online · unpaid', tone: 'bg-vermilion-50 text-vermilion' };
}

function statusTone(o: Order) {
  if (o.status === 'DELIVERED') return 'text-leaf';
  if (o.status === 'CANCELLED' || o.status === 'DELIVERY_FAILED') return 'text-vermilion';
  return 'text-saffron';
}

function MoneyCard({ Icon, title, amount, note, tone }: { Icon: typeof Banknote; title: string; amount: number; note: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
          <Icon size={18} />
        </span>
        <span className="text-sm font-semibold text-muted">{title}</span>
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums">{rupees(amount)}</div>
      <div className="mt-0.5 text-xs text-muted">{note}</div>
    </div>
  );
}

const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div className={`flex justify-between py-1 ${strong ? 'border-t border-line pt-2 font-bold text-maroon' : ''}`}>
    <span>{label}</span>
    <span className="tabular-nums">{value}</span>
  </div>
);

export default function DayReportPage() {
  const [today, setToday] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [report, setReport] = useState<DayReport | null>(null);
  const [days, setDays] = useState<DaySummary[]>([]);
  const [error, setError] = useState('');

  /** Show one day's report. */
  const pick = useCallback((d: string) => {
    setDay(d);
    setReport(null);
    api<DayReport>(`/admin/reports/day?date=${d}`)
      .then((r) => {
        setReport(r);
        setError('');
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  // The server knows "today" in IST; start there
  useEffect(() => {
    api<{ today: string; days: DaySummary[] }>('/admin/reports/days')
      .then((r) => {
        setToday(r.today);
        setDays(r.days);
        pick(r.today);
      })
      .catch((e: Error) => setError(e.message));
  }, [pick]);

  const r = report;
  const takings = r ? r.cash.collected + r.online.received : 0;

  return (
    <div className="print-area">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-maroon">Day report</h1>
          <p className="text-sm text-muted">{day ? longDate(day) : 'Loading…'} · use it at closing time to tally the cash and online money.</p>
        </div>
        <div className="no-print flex items-center gap-2">
          <button
            onClick={() => day && pick(shiftDay(day, -1))}
            aria-label="Previous day"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-card hover:border-maroon/50">
            <ChevronLeft size={16} />
          </button>
          <input
            type="date"
            value={day ?? ''}
            max={today ?? undefined}
            onChange={(e) => e.target.value && pick(e.target.value)}
            className="h-9 rounded-lg border border-line bg-card px-2 text-sm font-semibold"
          />
          <button
            onClick={() => day && pick(shiftDay(day, 1))}
            disabled={!day || day === today}
            aria-label="Next day"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-card hover:border-maroon/50 disabled:opacity-40">
            <ChevronRight size={16} />
          </button>
          {day !== today && (
            <button onClick={() => today && pick(today)} className="h-9 rounded-lg border border-line bg-card px-3 text-sm font-semibold hover:border-maroon/50">
              Today
            </button>
          )}
          <button onClick={() => window.print()} className="flex h-9 items-center gap-1.5 rounded-lg bg-maroon px-3 text-sm font-bold text-gold shadow-sm hover:bg-maroon-700">
            <Printer size={15} /> Print
          </button>
        </div>
      </div>

      {error && <p className="mb-3 rounded-lg bg-vermilion-50 p-3 font-semibold text-vermilion">{error}</p>}
      {!r && !error && <p className="text-muted">Loading report…</p>}

      {r && (
        <div className="space-y-5">
          {r.counts.open > 0 && day === today && (
            <div className="no-print flex items-center gap-2 rounded-xl border border-saffron/50 bg-gold-50 px-4 py-3 text-sm font-semibold text-wood">
              <AlertTriangle size={16} className="text-saffron" />
              {r.counts.open} {r.counts.open === 1 ? 'order is' : 'orders are'} still open. Finish or cancel them before closing the day.
            </div>
          )}

          {/* Money */}
          <div className="grid gap-3 md:grid-cols-3">
            <MoneyCard
              Icon={Banknote}
              title="Cash collected"
              amount={r.cash.collected}
              tone="bg-sand text-wood"
              note={`${r.cash.orders} cash ${r.cash.orders === 1 ? 'order' : 'orders'} delivered${r.cash.stillOutOrders ? ` · ${rupees(r.cash.stillOut)} more on ${r.cash.stillOutOrders} open` : ''}`}
            />
            <MoneyCard
              Icon={Smartphone}
              title="Online received"
              amount={r.online.received}
              tone="bg-leaf-50 text-leaf"
              note={`${r.online.orders} paid ${r.online.orders === 1 ? 'order' : 'orders'} · in your Razorpay account`}
            />
            <MoneyCard Icon={Wallet} title="Total takings" amount={takings} tone="bg-maroon-50 text-maroon" note="Cash collected + online received" />
          </div>

          {(r.online.refunded > 0 || r.online.refundDue > 0) && (
            <div className="flex flex-wrap gap-3 text-sm">
              {r.online.refunded > 0 && (
                <span className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-2">
                  <RotateCcw size={14} className="text-muted" /> Refunded: <b className="tabular-nums">{rupees(r.online.refunded)}</b> ({r.online.refundedOrders})
                </span>
              )}
              {r.online.refundDue > 0 && (
                <span className="flex items-center gap-1.5 rounded-lg border border-vermilion/40 bg-vermilion-50 px-3 py-2 text-vermilion">
                  <AlertTriangle size={14} /> Refund due: <b className="tabular-nums">{rupees(r.online.refundDue)}</b> ({r.online.refundDueOrders}). Refund it from the
                  Razorpay dashboard.
                </span>
              )}
            </div>
          )}

          {/* Orders summary + breakdowns */}
          <div className="grid gap-3 lg:grid-cols-3">
            <section className="rounded-2xl border border-line bg-card p-4">
              <h2 className="mb-2 flex items-center gap-2 font-bold">
                <ClipboardList size={16} className="text-maroon" /> Orders
              </h2>
              <Row label="Received" value={String(r.counts.total)} />
              <Row label="Delivered" value={String(r.counts.delivered)} />
              <Row label="Cancelled" value={String(r.counts.cancelled)} />
              <Row label="Still open" value={String(r.counts.open)} />
            </section>

            <section className="rounded-2xl border border-line bg-card p-4">
              <h2 className="mb-2 font-bold">Sales (delivered orders)</h2>
              <Row label="Items" value={rupees(r.sales.items)} />
              <Row label="Delivery fees" value={rupees(r.sales.deliveryFees)} />
              <Row label="Handling fees" value={rupees(r.sales.handlingFees)} />
              {r.sales.discounts > 0 && <Row label="Discounts" value={`− ${rupees(r.sales.discounts)}`} />}
              <Row label="Total sales" value={rupees(r.sales.total)} strong />
            </section>

            <section className="rounded-2xl border border-line bg-card p-4">
              <h2 className="mb-2 font-bold">Cash by rider</h2>
              {r.riders.length === 0 ? (
                <p className="text-sm text-muted">No deliveries this day.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted">
                    <tr>
                      <th className="pb-1 font-medium">Rider</th>
                      <th className="pb-1 text-right font-medium">Delivered</th>
                      <th className="pb-1 text-right font-medium">Cash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.riders.map((x) => (
                      <tr key={x.name} className="border-t border-line">
                        <td className="py-1.5 font-semibold">{x.name}</td>
                        <td className="py-1.5 text-right tabular-nums">{x.deliveries}</td>
                        <td className="py-1.5 text-right font-semibold tabular-nums">{rupees(x.cash)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="mt-2 text-xs text-muted">Collect this cash from each rider, then press “Settle cash” on the Riders page.</p>
            </section>
          </div>

          {/* Every order of the day */}
          <section className="overflow-hidden rounded-2xl border border-line bg-card">
            <h2 className="border-b border-line px-4 py-3 font-bold">All orders ({r.orders.length})</h2>
            {r.orders.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">No orders on this day.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-sand/60 text-left text-xs text-muted">
                    <tr>
                      <th className="px-4 py-2 font-medium">Time</th>
                      <th className="px-4 py-2 font-medium">Order</th>
                      <th className="px-4 py-2 font-medium">Customer</th>
                      <th className="px-4 py-2 text-right font-medium">Items</th>
                      <th className="px-4 py-2 font-medium">Payment</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Rider</th>
                      <th className="px-4 py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.orders.map((o) => {
                      const pay = payLabel(o);
                      return (
                        <tr key={o.id} className={`border-t border-line ${o.status === 'CANCELLED' ? 'text-muted' : ''}`}>
                          <td className="whitespace-nowrap px-4 py-2 tabular-nums">{clock(o.createdAt)}</td>
                          <td className="px-4 py-2 font-semibold">{o.orderNumber}</td>
                          <td className="px-4 py-2">
                            {o.customer?.name || '—'}
                            {o.address.recipientName && <span className="text-muted"> → {o.address.recipientName}</span>}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">{o.items.reduce((s, i) => s + i.qty, 0)}</td>
                          <td className="px-4 py-2">
                            <span className={`whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-semibold ${pay.tone}`}>{pay.text}</span>
                          </td>
                          <td className={`whitespace-nowrap px-4 py-2 font-semibold ${statusTone(o)}`}>{STATUS_LABEL[o.status]}</td>
                          <td className="px-4 py-2">{o.rider?.name ?? '—'}</td>
                          <td className={`px-4 py-2 text-right font-semibold tabular-nums ${o.status === 'CANCELLED' ? 'line-through' : ''}`}>
                            {rupees(o.bill.grandTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {r.topItems.length > 0 && (
            <section className="rounded-2xl border border-line bg-card p-4">
              <h2 className="mb-2 font-bold">Best sellers</h2>
              <div className="grid gap-x-6 sm:grid-cols-2">
                {r.topItems.map((i) => (
                  <div key={i.name + i.unit} className="flex justify-between border-t border-line py-1.5 text-sm">
                    <span>
                      {i.name} <span className="text-muted">({i.unit})</span>
                    </span>
                    <span className="tabular-nums">
                      <b>{i.qty}</b> · {rupees(i.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recent days */}
          {days.length > 0 && (
            <section className="no-print rounded-2xl border border-line bg-card p-4">
              <h2 className="mb-2 font-bold">Last 30 days</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted">
                    <tr>
                      <th className="pb-1 font-medium">Day</th>
                      <th className="pb-1 text-right font-medium">Orders</th>
                      <th className="pb-1 text-right font-medium">Delivered</th>
                      <th className="pb-1 text-right font-medium">Cash</th>
                      <th className="pb-1 text-right font-medium">Online</th>
                      <th className="pb-1 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((d) => (
                      <tr
                        key={d.date}
                        onClick={() => pick(d.date)}
                        className={`cursor-pointer border-t border-line hover:bg-sand/50 ${d.date === day ? 'bg-gold-50 font-semibold' : ''}`}>
                        <td className="py-1.5">{shortDate(d.date)}</td>
                        <td className="py-1.5 text-right tabular-nums">{d.orders}</td>
                        <td className="py-1.5 text-right tabular-nums">{d.delivered}</td>
                        <td className="py-1.5 text-right tabular-nums">{rupees(d.cash)}</td>
                        <td className="py-1.5 text-right tabular-nums">{rupees(d.online)}</td>
                        <td className="py-1.5 text-right font-semibold tabular-nums">{rupees(d.cash + d.online)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
