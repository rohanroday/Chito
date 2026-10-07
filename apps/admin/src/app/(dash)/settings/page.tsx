'use client';

import { useEffect, useState } from 'react';

import { useAdmin } from '@/components/Shell';
import { api } from '@/lib/api';
import { toPaise, toRupees } from '@/lib/format';
import type { StoreSettings } from '@/lib/types';

type Form = {
  openTime: string;
  closeTime: string;
  serviceRadiusKm: string;
  minOrderValue: string;
  deliveryFee: string;
  freeDeliveryAbove: string;
  handlingFee: string;
  baseEtaMin: string;
  supportPhone: string;
  lat: string;
  lng: string;
  closedMessage: string;
};

const toForm = (s: StoreSettings): Form => ({
  openTime: s.openTime,
  closeTime: s.closeTime,
  serviceRadiusKm: String(s.serviceRadiusKm),
  minOrderValue: String(toRupees(s.minOrderValue)),
  deliveryFee: String(toRupees(s.deliveryFee)),
  freeDeliveryAbove: String(toRupees(s.freeDeliveryAbove)),
  handlingFee: String(toRupees(s.handlingFee)),
  baseEtaMin: String(s.baseEtaMin),
  supportPhone: s.supportPhone,
  lat: String(s.location.lat),
  lng: String(s.location.lng),
  closedMessage: s.closedMessage,
});

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export default function SettingsPage() {
  const admin = useAdmin();
  const owner = admin?.role === 'OWNER';
  const [store, setStore] = useState<StoreSettings | null>(null);
  const [f, setF] = useState<Form | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<StoreSettings>('/admin/store')
      .then((s) => {
        setStore(s);
        setF(toForm(s));
      })
      .catch((e: Error) => setMsg({ ok: false, text: e.message }));
  }, []);

  if (!f || !store) return <p className="text-muted">{msg?.text ?? 'Loading settings…'}</p>;

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const input = 'h-10 w-full rounded-lg border border-line bg-white px-3 disabled:bg-sand';

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f) return;
    setBusy(true);
    setMsg(null);
    try {
      const s = await api<StoreSettings>('/admin/store', {
        method: 'PATCH',
        body: {
          openTime: f.openTime,
          closeTime: f.closeTime,
          serviceRadiusKm: Number(f.serviceRadiusKm),
          minOrderValue: toPaise(Number(f.minOrderValue)),
          deliveryFee: toPaise(Number(f.deliveryFee)),
          freeDeliveryAbove: toPaise(Number(f.freeDeliveryAbove)),
          handlingFee: toPaise(Number(f.handlingFee)),
          baseEtaMin: Number(f.baseEtaMin),
          supportPhone: f.supportPhone.trim(),
          location: { lat: Number(f.lat), lng: Number(f.lng) },
          closedMessage: f.closedMessage,
        },
      });
      setStore(s);
      setF(toForm(s));
      setMsg({ ok: true, text: 'Saved. The app picks this up on its next refresh.' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setBusy(false);
    }
  }

  const mapUrl = `https://www.google.com/maps?q=${f.lat},${f.lng}`;

  return (
    <form onSubmit={save} className="max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-3xl text-maroon">Store settings</h1>
        <p className="text-sm text-muted">
          {store.name} · {store.address}
          {!owner && ' · Only the owner can change these.'}
        </p>
      </div>

      <fieldset disabled={!owner} className="grid grid-cols-1 gap-4 rounded-xl border border-line bg-card p-5 sm:grid-cols-2">
        <legend className="px-1 font-display text-lg">Hours & delivery area</legend>
        <Field label="Opens at" hint="Asia/Kolkata time">
          <input type="time" required value={f.openTime} onChange={set('openTime')} className={input} />
        </Field>
        <Field label="Closes at">
          <input type="time" required value={f.closeTime} onChange={set('closeTime')} className={input} />
        </Field>
        <Field label="Delivery radius (km)" hint="Straight-line distance from the store">
          <input type="number" step="0.1" min="0.5" max="10" required value={f.serviceRadiusKm} onChange={set('serviceRadiusKm')} className={input} />
        </Field>
        <Field label="Base delivery time (min)" hint="+3 min per km is added">
          <input type="number" min="5" max="120" required value={f.baseEtaMin} onChange={set('baseEtaMin')} className={input} />
        </Field>
        <Field label="Store latitude">
          <input type="number" step="any" required value={f.lat} onChange={set('lat')} className={input} />
        </Field>
        <Field label="Store longitude" hint="Stand at the shop door and copy from Google Maps">
          <input type="number" step="any" required value={f.lng} onChange={set('lng')} className={input} />
        </Field>
        <a href={mapUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-turquoise sm:col-span-2">
          Check this pin in Google Maps ↗
        </a>
      </fieldset>

      <fieldset disabled={!owner} className="grid grid-cols-1 gap-4 rounded-xl border border-line bg-card p-5 sm:grid-cols-2">
        <legend className="px-1 font-display text-lg">Fees (₹)</legend>
        <Field label="Minimum order">
          <input type="number" min="0" step="1" required value={f.minOrderValue} onChange={set('minOrderValue')} className={input} />
        </Field>
        <Field label="Delivery fee">
          <input type="number" min="0" step="1" required value={f.deliveryFee} onChange={set('deliveryFee')} className={input} />
        </Field>
        <Field label="Free delivery above">
          <input type="number" min="0" step="1" required value={f.freeDeliveryAbove} onChange={set('freeDeliveryAbove')} className={input} />
        </Field>
        <Field label="Handling fee">
          <input type="number" min="0" step="1" required value={f.handlingFee} onChange={set('handlingFee')} className={input} />
        </Field>
      </fieldset>

      <fieldset disabled={!owner} className="grid grid-cols-1 gap-4 rounded-xl border border-line bg-card p-5 sm:grid-cols-2">
        <legend className="px-1 font-display text-lg">Customer support</legend>
        <Field label="Support phone" hint="Used by the app’s Call / WhatsApp buttons, e.g. +919800000000">
          <input value={f.supportPhone} onChange={set('supportPhone')} placeholder="+91…" className={input} />
        </Field>
        <Field label="Closed message" hint="Shown when the store is switched off">
          <input value={f.closedMessage} onChange={set('closedMessage')} placeholder="e.g. Closed for Losar, back tomorrow" className={input} />
        </Field>
      </fieldset>

      {msg && <p className={`rounded-lg p-3 font-semibold ${msg.ok ? 'bg-leaf-50 text-leaf' : 'bg-vermilion-50 text-vermilion'}`}>{msg.text}</p>}
      {owner && (
        <button disabled={busy} className="h-11 rounded-lg bg-maroon px-6 font-bold text-gold disabled:opacity-60">
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      )}
    </form>
  );
}
