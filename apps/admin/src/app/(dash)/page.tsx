'use client';

import { Bell, Bike, CheckCircle2, Clock, Inbox, type LucideIcon, MapPin, Package, PackageCheck, RefreshCw, Truck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '@/lib/api';
import { chime, clock, imageUrl, minutesSince, rupees } from '@/lib/format';
import { useLiveEvent } from '@/lib/live';
import { useNow } from '@/lib/use-now';
import { type Order, type OrderStatus, type Rider, STATUS_LABEL } from '@/lib/types';

// The order's journey through the store, left to right
const COLUMNS: { key: string; title: string; hint: string; statuses: OrderStatus[]; Icon: LucideIcon; accent: string }[] = [
  { key: 'new', title: 'New', hint: 'New orders appear here', statuses: ['PLACED'], Icon: Bell, accent: 'text-saffron bg-gold-50' },
  { key: 'confirmed', title: 'Packing', hint: 'Accepted orders being packed', statuses: ['CONFIRMED'], Icon: Package, accent: 'text-turquoise bg-turquoise-50' },
  { key: 'packed', title: 'Ready for rider', hint: 'Packed orders waiting for a rider', statuses: ['PACKED'], Icon: PackageCheck, accent: 'text-maroon bg-maroon-50' },
  { key: 'out', title: 'Out for delivery', hint: 'Orders on the way', statuses: ['OUT_FOR_DELIVERY', 'DELIVERY_FAILED'], Icon: Truck, accent: 'text-turquoise bg-turquoise-50' },
  { key: 'done', title: 'Done today', hint: 'Delivered and cancelled orders', statuses: ['DELIVERED', 'CANCELLED'], Icon: CheckCircle2, accent: 'text-leaf bg-leaf-50' },
];

// What the rider collects, and whether an online order's money is safe
type PayKey = 'COD' | Order['paymentStatus'];
const payKey = (o: Order): PayKey => (o.paymentMethod === 'COD' ? 'COD' : o.paymentStatus);
const PAY_BADGE: Record<PayKey, { label: string; long: string; tone: string }> = {
  COD: { label: 'CASH', long: 'cash on delivery', tone: 'bg-sand text-wood' },
  PENDING: { label: 'UNPAID', long: 'online, not paid', tone: 'bg-vermilion-50 text-vermilion' },
  PAID: { label: 'PAID', long: 'paid online · collect nothing', tone: 'bg-leaf-50 text-leaf' },
  REFUNDED: { label: 'REFUNDED', long: 'paid online · refunded', tone: 'bg-sand text-wood' },
  REFUND_FAILED: { label: 'REFUND DUE', long: 'refund failed · refund it from the Razorpay dashboard', tone: 'bg-vermilion-50 text-vermilion' },
};

function timerTone(mins: number) {
  if (mins < 10) return 'bg-leaf-50 text-leaf';
  if (mins < 20) return 'bg-gold-50 text-saffron';
  return 'bg-vermilion-50 text-vermilion';
}

function OrderCard({ o, now, fresh, onOpen }: { o: Order; now: number; fresh: boolean; onOpen: () => void }) {
  const mins = minutesSince(o.createdAt, now);
  const finished = o.status === 'DELIVERED' || o.status === 'CANCELLED';
  const pay = PAY_BADGE[payKey(o)];
  const items = o.items.reduce((s, i) => s + i.qty, 0);
  return (
    <button
      onClick={onOpen}
      className={`w-full rounded-xl border bg-card p-3 text-left shadow-sm transition hover:-translate-y-px hover:border-maroon/40 hover:shadow-md ${
        o.status === 'DELIVERY_FAILED' ? 'border-vermilion/50' : 'border-line'
      } ${fresh ? 'flash-new' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold tracking-tight">{o.orderNumber}</span>
        {finished ? (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${o.status === 'DELIVERED' ? 'bg-leaf-50 text-leaf' : 'bg-vermilion-50 text-vermilion'}`}>
            {STATUS_LABEL[o.status]}
          </span>
        ) : (
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${timerTone(mins)}`}>
            <Clock size={11} /> {mins} min
          </span>
        )}
      </div>
      <div className="mt-1.5 text-sm font-medium">
        {o.address.recipientName ? `For ${o.address.recipientName}` : o.customer?.name || 'Customer'}
        <span className="font-normal text-muted">
          {' '}
          · {items} {items === 1 ? 'item' : 'items'}
        </span>
      </div>
      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted">
        <MapPin size={12} className="shrink-0" />
        <span className="truncate">
          {o.address.landmark}
          {o.address.area ? `, ${o.address.area}` : ''}
        </span>
        <span className="shrink-0">· {o.distanceKm} km</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-line/70 pt-2">
        <span className="font-bold tabular-nums text-maroon">{rupees(o.bill.grandTotal)}</span>
        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${pay.tone}`}>{pay.label}</span>
      </div>
      {o.rider && !finished && (
        <div className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-turquoise">
          <Bike size={12} /> {o.rider.name}
        </div>
      )}
      {o.status === 'DELIVERY_FAILED' && <div className="mt-1.5 text-xs font-semibold text-vermilion">Delivery failed · re-assign or cancel</div>}
    </button>
  );
}

function AssignRider({ order, onDone, onClose }: { order: Order; onDone: (o: Order) => void; onClose: () => void }) {
  const [riders, setRiders] = useState<Rider[] | null>(null);
  const [error, setError] = useState('');
  const now = useNow();
  useEffect(() => {
    api<Rider[]>('/admin/riders').then(setRiders).catch((e: Error) => setError(e.message));
  }, []);
  const available = (riders ?? [])
    .filter((r) => r.status === 'AVAILABLE')
    .sort((a, b) => new Date(a.availableSince ?? 0).getTime() - new Date(b.availableSince ?? 0).getTime());
  const busy = (riders ?? []).filter((r) => r.status === 'ON_DELIVERY');

  async function assign(r: Rider) {
    try {
      onDone(await api<Order>(`/admin/orders/${order.id}/assign-rider`, { method: 'POST', body: { riderId: r.id } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not assign');
    }
  }

  const row = (r: Rider, note: string) => (
    <button
      key={r.id}
      onClick={() => assign(r)}
      className="flex w-full items-center gap-3 rounded-xl border border-line bg-card p-3 text-left hover:border-maroon">
      <span className="arch flex h-11 w-10 items-end justify-center bg-maroon-50 pb-1 font-display text-lg text-maroon">{r.name[0]}</span>
      <span className="flex-1">
        <span className="block font-bold">{r.name}</span>
        <span className="text-sm text-muted">{note}</span>
      </span>
      <span className="font-bold text-maroon">Assign →</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-parchment p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl text-maroon">Assign a rider · {order.orderNumber}</h2>
        <p className="text-sm text-muted">Hand over the packed jhola and the printed slip.</p>
        {error && <p className="mt-2 rounded-lg bg-vermilion-50 px-3 py-2 text-sm font-semibold text-vermilion">{error}</p>}
        <div className="mt-3 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wide text-leaf">At the store ({available.length})</div>
          {riders === null && <p className="text-sm text-muted">Loading riders…</p>}
          {riders && available.length === 0 && <p className="text-sm text-muted">No rider is waiting. Mark a rider available on the Riders page.</p>}
          {available.map((r) => row(r, `Waiting ${r.availableSince ? minutesSince(r.availableSince, now) : 0} min · ${r.vehicle.toLowerCase().replace('_', ' ')}`))}
          {busy.length > 0 && <div className="pt-2 text-xs font-bold uppercase tracking-wide text-muted">Out on delivery (can carry one more)</div>}
          {busy.map((r) => row(r, `${r.activeOrders ?? 0} order(s) on the way`))}
        </div>
        <button onClick={onClose} className="mt-4 h-10 w-full rounded-lg font-semibold text-muted hover:bg-sand">
          Cancel
        </button>
      </div>
    </div>
  );
}

function OrderDrawer({ o, onClose, onChange }: { o: Order; onClose: () => void; onChange: (o: Order) => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');

  async function run(fn: () => Promise<Order>) {
    setBusy(true);
    setError('');
    try {
      onChange(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }
  const setStatus = (status: OrderStatus) => run(() => api<Order>(`/admin/orders/${o.id}/status`, { method: 'PATCH', body: { status } }));
  const cancel = () => run(() => api<Order>(`/admin/orders/${o.id}/cancel`, { method: 'POST', body: { reason } }));

  const packing = o.status === 'CONFIRMED'; // accepted, being packed
  const canCancel = ['PLACED', 'CONFIRMED', 'PACKED', 'DELIVERY_FAILED'].includes(o.status);
  const mapUrl = o.address.location ? `https://www.google.com/maps?q=${o.address.location.lat},${o.address.location.lng}` : null;
  const btn = 'h-11 flex-1 rounded-lg font-bold disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/30" onClick={onClose}>
      <aside className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-parchment shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="bg-maroon px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl text-gold">{o.orderNumber}</h2>
            <button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-gold">
              ×
            </button>
          </div>
          <div className="text-sm opacity-90">
            {STATUS_LABEL[o.status]} · placed {clock(o.createdAt)} · {o.paymentMethod === 'COD' ? `collect ${rupees(o.bill.grandTotal)} cash` : PAY_BADGE[payKey(o)].long}
          </div>
        </div>
        <div className="dentil" />

        <div className="space-y-4 p-5">
          <section className="rounded-xl border border-line bg-card p-4">
            {o.address.recipientName && (
              <div className="mb-3 rounded-lg border border-gold-deep bg-gold-50 p-3">
                <h3 className="font-display text-lg">Deliver to (receives the order)</h3>
                <div className="font-semibold">{o.address.recipientName}</div>
                <a href={`tel:${o.address.recipientPhone}`} className="font-bold text-turquoise">
                  📞 {o.address.recipientPhone}
                </a>
                <div className="text-xs text-wood">Rider calls this person. The customer below placed the order.</div>
              </div>
            )}
            <h3 className="font-display text-lg">{o.address.recipientName ? 'Ordered by' : 'Customer'}</h3>
            <div className="font-semibold">{o.customer?.name || '—'}</div>
            <a href={`tel:${o.customer?.phone}`} className="font-bold text-turquoise">
              📞 {o.customer?.phone}
            </a>
            <div className="mt-2 text-sm">
              <div>
                <b>{o.address.label}:</b> {[o.address.house, o.address.landmark, o.address.area].filter(Boolean).join(', ')}
              </div>
              {o.address.directions && <div className="text-muted">🧭 {o.address.directions}</div>}
              {o.instructions && <div className="text-muted">📝 {o.instructions}</div>}
              <div className="text-muted">{o.distanceKm} km from store</div>
              {mapUrl && (
                <a href={mapUrl} target="_blank" rel="noreferrer" className="font-semibold text-turquoise">
                  Open pin in Google Maps ↗
                </a>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-line bg-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg">{packing ? 'Packing list' : 'Items'}</h3>
              <span className="text-sm text-muted">{o.items.reduce((s, i) => s + i.qty, 0)} items</span>
            </div>
            {packing && <p className="text-xs text-muted">Put these in the jhola, then press “Mark packed”.</p>}
            <ul className="mt-2 divide-y divide-line">
              {o.items.map((i) => (
                <li key={i.slug} className="flex items-center gap-3 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- ImageKit already resizes */}
                  <img src={imageUrl(i.image, 80)} alt="" className="h-10 w-10 rounded bg-white object-contain" />
                  <span className="flex-1">
                    <b>{i.qty} ×</b> {i.name} <span className="text-muted">({i.unit})</span>
                  </span>
                  <span className="font-semibold tabular-nums">{rupees(i.price * i.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 space-y-0.5 border-t border-dashed border-line pt-2 text-sm">
              <div className="flex justify-between">
                <span>Items</span>
                <span>{rupees(o.bill.itemTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery</span>
                <span>{o.bill.deliveryFee ? rupees(o.bill.deliveryFee) : 'FREE'}</span>
              </div>
              <div className="flex justify-between">
                <span>Handling</span>
                <span>{rupees(o.bill.handlingFee)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-maroon">
                <span>Total</span>
                <span>{rupees(o.bill.grandTotal)}</span>
              </div>
            </div>
          </section>

          {o.rider && (
            <section className="rounded-xl border border-line bg-card p-4">
              <h3 className="font-display text-lg">Rider</h3>
              <div>
                🛵 <b>{o.rider.name}</b> ·{' '}
                <a href={`tel:${o.rider.phone}`} className="font-semibold text-turquoise">
                  {o.rider.phone}
                </a>
              </div>
            </section>
          )}

          {o.cancelReason && <p className="rounded-lg bg-vermilion-50 p-3 text-sm text-vermilion">Cancelled: {o.cancelReason}</p>}
          {error && <p className="rounded-lg bg-vermilion-50 p-3 text-sm font-semibold text-vermilion">{error}</p>}

          {/* Actions follow the server's allowed transitions */}
          <div className="flex flex-wrap gap-2">
            {o.status === 'PLACED' && (
              <button disabled={busy} onClick={() => setStatus('CONFIRMED')} className={`${btn} bg-maroon text-gold`}>
                Accept order
              </button>
            )}
            {o.status === 'CONFIRMED' && (
              <button disabled={busy} onClick={() => setStatus('PACKED')} className={`${btn} bg-maroon text-gold`}>
                Mark packed
              </button>
            )}
            {(o.status === 'PACKED' || o.status === 'DELIVERY_FAILED') && (
              <button disabled={busy} onClick={() => setAssigning(true)} className={`${btn} bg-gold text-maroon`}>
                {o.status === 'PACKED' ? 'Assign rider' : 'Re-assign rider'}
              </button>
            )}
            {o.status === 'OUT_FOR_DELIVERY' && (
              <>
                <button disabled={busy} onClick={() => setStatus('DELIVERED')} className={`${btn} bg-leaf text-white`}>
                  Delivered ✓
                </button>
                <button disabled={busy} onClick={() => setStatus('DELIVERY_FAILED')} className={`${btn} border-[1.5px] border-vermilion text-vermilion`}>
                  Delivery failed
                </button>
              </>
            )}
            <button onClick={() => window.print()} className={`${btn} border-[1.5px] border-maroon text-maroon`}>
              Print slip
            </button>
          </div>

          {canCancel &&
            (cancelling ? (
              <div className="rounded-xl border border-vermilion bg-card p-3">
                <input
                  autoFocus
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason, e.g. customer asked / item not available"
                  className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm"
                />
                <div className="mt-2 flex gap-2">
                  <button onClick={() => setCancelling(false)} className="h-10 flex-1 rounded-lg font-semibold text-muted hover:bg-sand">
                    Keep order
                  </button>
                  <button
                    disabled={busy || reason.trim().length < 2}
                    onClick={cancel}
                    className="h-10 flex-1 rounded-lg bg-vermilion font-bold text-white disabled:opacity-50">
                    Cancel order
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setCancelling(true)} className="text-sm font-semibold text-vermilion hover:underline">
                Cancel this order…
              </button>
            ))}

          <section className="text-xs text-muted">
            {o.statusHistory.map((h, i) => (
              <div key={i}>
                {clock(h.at)} · {STATUS_LABEL[h.status]}
              </div>
            ))}
          </section>
        </div>
      </aside>

      {assigning && (
        <AssignRider
          order={o}
          onClose={() => setAssigning(false)}
          onDone={(updated) => {
            setAssigning(false);
            onChange(updated);
          }}
        />
      )}

      {/* Printed rider slip */}
      <div className="print-slip">
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>CHITO · {o.orderNumber}</h1>
        {o.address.recipientName ? (
          <p>
            DELIVER TO: {o.address.recipientName} · {o.address.recipientPhone} (ordered by {o.customer?.name} · {o.customer?.phone})
          </p>
        ) : (
          <p>
            {o.customer?.name} · {o.customer?.phone}
          </p>
        )}
        <p>
          {o.address.label}: {[o.address.house, o.address.landmark, o.address.area].filter(Boolean).join(', ')}
        </p>
        {o.address.directions && <p>Directions: {o.address.directions}</p>}
        <hr />
        {o.items.map((i) => (
          <p key={i.slug}>
            {i.qty} × {i.name} ({i.unit}) — {rupees(i.price * i.qty)}
          </p>
        ))}
        <hr />
        <p style={{ fontSize: 18, fontWeight: 700 }}>
          {o.paymentMethod === 'COD' ? `COLLECT CASH: ${rupees(o.bill.grandTotal)}` : `PAID ONLINE: ${rupees(o.bill.grandTotal)} · collect nothing`}
        </p>
        {o.rider && <p>Rider: {o.rider.name}</p>}
      </div>
    </div>
  );
}

export default function OrdersBoard() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Record<string, boolean>>({});
  const now = useNow();

  const load = useCallback(() => {
    api<Order[]>('/admin/orders')
      .then((o) => {
        setOrders(o);
        setError('');
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const upsert = (o: Order) => setOrders((prev) => (prev ? [o, ...prev.filter((x) => x.id !== o.id)] : [o]));

  useLiveEvent<Order>('order:new', (o) => {
    upsert(o);
    chime();
    setFresh((f) => ({ ...f, [o.id]: true }));
    setTimeout(() => setFresh((f) => ({ ...f, [o.id]: false })), 5000);
  });
  useLiveEvent<Order>('order:updated', upsert);

  const byColumn = useMemo(() => {
    const sorted = [...(orders ?? [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return COLUMNS.map((c) => ({
      ...c,
      // Finished orders: newest first
      orders: c.key === 'done' ? sorted.filter((o) => c.statuses.includes(o.status)).reverse() : sorted.filter((o) => c.statuses.includes(o.status)),
    }));
  }, [orders]);

  const open = orders?.find((o) => o.id === openId) ?? null;

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-maroon">Orders</h1>
          <p className="text-sm text-muted">New orders arrive live with a chime. Open a card to accept, pack and send it out.</p>
        </div>
        <button
          onClick={load}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-sm font-semibold text-wood shadow-sm hover:border-maroon/50">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
      {error && <p className="mb-3 rounded-lg bg-vermilion-50 p-3 font-semibold text-vermilion">{error}</p>}
      {orders === null && !error && <p className="text-muted">Loading orders…</p>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {byColumn.map((c) => (
          <section key={c.key} className="flex min-h-64 flex-col rounded-2xl border border-line bg-sand/40 p-2.5">
            <h2 className="mb-2.5 flex items-center gap-2 px-1 pt-0.5">
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${c.accent}`}>
                <c.Icon size={15} />
              </span>
              <span className="flex-1 text-sm font-bold text-ink">{c.title}</span>
              <span
                className={`min-w-6 rounded-full px-2 text-center text-xs font-bold tabular-nums ${c.orders.length ? 'bg-maroon text-gold' : 'bg-card text-muted'}`}>
                {c.orders.length}
              </span>
            </h2>
            <div className="space-y-2">
              {c.orders.map((o) => (
                <OrderCard key={o.id} o={o} now={now} fresh={!!fresh[o.id]} onOpen={() => setOpenId(o.id)} />
              ))}
              {c.orders.length === 0 && (
                <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-line px-3 py-8 text-center">
                  <Inbox size={20} className="text-subtle" />
                  <span className="text-xs text-subtle">{c.hint}</span>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
      {open && <OrderDrawer o={open} onClose={() => setOpenId(null)} onChange={upsert} />}
    </div>
  );
}
