'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAdmin } from '@/components/Shell';
import { api } from '@/lib/api';
import { minutesSince, rupees } from '@/lib/format';
import { useLiveEvent } from '@/lib/live';
import { useNow } from '@/lib/use-now';
import type { Rider } from '@/lib/types';

const STATUS_STYLE: Record<Rider['status'], string> = {
  AVAILABLE: 'bg-leaf-50 text-leaf',
  ON_DELIVERY: 'bg-turquoise-50 text-turquoise',
  OFF_DUTY: 'bg-sand text-muted',
};
const STATUS_TEXT: Record<Rider['status'], string> = { AVAILABLE: 'At the store', ON_DELIVERY: 'On delivery', OFF_DUTY: 'Off duty' };

export default function RidersPage() {
  const admin = useAdmin();
  const [riders, setRiders] = useState<Rider[] | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', vehicle: 'SCOOTER' as Rider['vehicle'] });
  const [adding, setAdding] = useState(false);
  const now = useNow();

  const load = useCallback(() => {
    api<Rider[]>('/admin/riders').then(setRiders).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);
  useLiveEvent('rider:updated', load);
  useLiveEvent('order:updated', load);

  async function act(fn: () => Promise<unknown>) {
    setError('');
    try {
      await fn();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    }
  }

  const setStatus = (r: Rider, status: 'AVAILABLE' | 'OFF_DUTY') => act(() => api(`/admin/riders/${r.id}`, { method: 'PATCH', body: { status } }));
  const settle = (r: Rider) => {
    if (confirm(`Did ${r.name} hand over ${rupees(r.codBalance)} cash?`)) act(() => api(`/admin/riders/${r.id}/settle-cod`, { method: 'POST' }));
  };
  const remove = (r: Rider) => {
    if (confirm(`Remove ${r.name} from the rider list?`)) act(() => api(`/admin/riders/${r.id}`, { method: 'PATCH', body: { isActive: false } }));
  };

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const digits = form.phone.replace(/\D/g, '').slice(-10);
    await act(() => api('/admin/riders', { method: 'POST', body: { ...form, phone: `+91${digits}` } }));
    setForm({ name: '', phone: '', vehicle: 'SCOOTER' });
    setAdding(false);
  }

  const totalCash = (riders ?? []).reduce((s, r) => s + r.codBalance, 0);

  return (
    <div className="max-w-5xl">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl text-maroon">Riders</h1>
          <p className="text-sm text-muted">
            Mark riders “at the store” when they arrive. Cash still with riders: <b>{rupees(totalCash)}</b>
          </p>
        </div>
        {admin?.role === 'OWNER' && (
          <button onClick={() => setAdding((v) => !v)} className="h-10 rounded-lg bg-maroon px-4 font-bold text-gold">
            + Add rider
          </button>
        )}
      </div>
      {error && <p className="mb-3 rounded-lg bg-vermilion-50 p-3 font-semibold text-vermilion">{error}</p>}

      {adding && (
        <form onSubmit={add} className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-4">
          <label className="text-sm font-semibold">
            Name
            <input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 block h-10 rounded-lg border border-line bg-white px-3" />
          </label>
          <label className="text-sm font-semibold">
            Mobile (10 digits)
            <input required pattern="[6-9][0-9]{9}" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 block h-10 rounded-lg border border-line bg-white px-3" />
          </label>
          <label className="text-sm font-semibold">
            Vehicle
            <select value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value as Rider['vehicle'] })} className="mt-1 block h-10 rounded-lg border border-line bg-white px-3">
              <option value="SCOOTER">Scooter</option>
              <option value="BIKE">Bike</option>
              <option value="ON_FOOT">On foot</option>
            </select>
          </label>
          <button className="h-10 rounded-lg bg-leaf px-4 font-bold text-white">Save rider</button>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-card">
        <table className="w-full text-left">
          <thead className="bg-sand text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2">Rider</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Cash collected</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {riders?.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3">
                  <div className="font-bold">{r.name}</div>
                  <a href={`tel:${r.phone}`} className="text-sm text-turquoise">
                    {r.phone}
                  </a>{' '}
                  <span className="text-xs text-muted">· {r.vehicle.toLowerCase().replace('_', ' ')}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-sm font-bold ${STATUS_STYLE[r.status]}`}>{STATUS_TEXT[r.status]}</span>
                  <div className="mt-1 text-xs text-muted">
                    {r.status === 'AVAILABLE' && r.availableSince && `waiting ${minutesSince(r.availableSince, now)} min`}
                    {r.status === 'ON_DELIVERY' && `${r.activeOrders ?? 0} order(s) out`}
                  </div>
                </td>
                <td className="px-4 py-3 font-bold">{rupees(r.codBalance)}</td>
                <td className="space-x-2 px-4 py-3 text-right">
                  {r.status === 'OFF_DUTY' && (
                    <button onClick={() => setStatus(r, 'AVAILABLE')} className="h-9 rounded-lg bg-leaf px-3 text-sm font-bold text-white">
                      Arrived at store
                    </button>
                  )}
                  {r.status === 'AVAILABLE' && (
                    <button onClick={() => setStatus(r, 'OFF_DUTY')} className="h-9 rounded-lg border border-line px-3 text-sm font-semibold">
                      Off duty
                    </button>
                  )}
                  {r.codBalance > 0 && (
                    <button onClick={() => settle(r)} className="h-9 rounded-lg bg-gold px-3 text-sm font-bold text-maroon">
                      Settle cash
                    </button>
                  )}
                  {admin?.role === 'OWNER' && r.status !== 'ON_DELIVERY' && (
                    <button onClick={() => remove(r)} className="h-9 px-2 text-sm font-semibold text-vermilion hover:underline">
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {riders?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">
                  No riders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
