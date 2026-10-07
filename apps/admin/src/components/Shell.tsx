'use client';

import { AlertTriangle, Banknote, Bike, CalendarDays, CheckCircle2, ClipboardList, FolderTree, IndianRupee, LogOut, type LucideIcon, Package, PackageOpen, Settings, ShoppingBag, Timer, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { api, getSession, logoutSession } from '@/lib/api';
import { rupees } from '@/lib/format';
import { useLive, useLiveEvent } from '@/lib/live';
import type { AdminUser, Stats, StoreSettings } from '@/lib/types';

const NAV: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: '/', label: 'Orders', Icon: ClipboardList },
  { href: '/reports', label: 'Day report', Icon: CalendarDays },
  { href: '/riders', label: 'Riders', Icon: Bike },
  { href: '/products', label: 'Products', Icon: ShoppingBag },
  { href: '/categories', label: 'Categories', Icon: FolderTree },
  { href: '/customers', label: 'Customers', Icon: Users },
  { href: '/settings', label: 'Settings', Icon: Settings },
];

const AdminContext = createContext<AdminUser | null>(null);
export const useAdmin = () => useContext(AdminContext);

function OpenSwitch() {
  const [store, setStore] = useState<StoreSettings | null>(null);
  const [closing, setClosing] = useState(false);
  const [opening, setOpening] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<StoreSettings>('/admin/store').then(setStore).catch(() => undefined);
  }, []);
  useLiveEvent<StoreSettings>('store:updated', setStore);

  async function set(isOpen: boolean) {
    setBusy(true);
    try {
      setStore(await api<StoreSettings>('/admin/store/open', { method: 'POST', body: { isOpen, closedMessage: isOpen ? '' : message } }));
      setClosing(false);
      setOpening(false);
      setMessage('');
    } finally {
      setBusy(false);
    }
  }

  if (!store) return null;
  const tm = store.testMode;
  const testRules = tm ? [tm.anyLocation && '3 km check OFF', tm.ignoreHours && 'store hours ignored', tm.fixedOtp && 'OTP is 1234'].filter(Boolean) : [];
  return (
    <div className="relative flex items-center gap-2">
      {testRules.length > 0 && (
        <span
          title="Set DEV_ALLOW_ANY_LOCATION / DEV_IGNORE_STORE_HOURS / OTP_DEV_MODE to false in apps/api/.env (they are ignored in production)"
          className="flex items-center gap-1.5 rounded-full border border-saffron/60 bg-gold-50 px-3 py-1 text-xs font-semibold text-wood">
          <AlertTriangle size={14} className="text-saffron" />
          Test mode: {testRules.join(' · ')}
        </span>
      )}
      {store.isOpen && !store.isOpenNow && (
        <span className="rounded-full bg-gold-50 px-2 py-0.5 text-xs font-semibold text-wood">
          Outside hours ({store.openTime}–{store.closeTime})
        </span>
      )}
      <button
        // Both directions ask first: a stray click shouldn't open or close the shop
        onClick={() => (store.isOpen ? setClosing((v) => !v) : setOpening((v) => !v))}
        disabled={busy}
        aria-pressed={store.isOpen}
        className={`flex h-10 items-center gap-2 rounded-full px-4 font-bold text-white shadow ${store.isOpen ? 'bg-leaf' : 'bg-vermilion'}`}>
        <span className={`h-3 w-3 rounded-full bg-white ${store.isOpen ? 'animate-pulse' : ''}`} />
        {store.isOpen ? 'Store OPEN' : 'Store CLOSED · tap to open'}
      </button>
      {opening && (
        <div className="absolute right-0 top-12 z-30 w-72 rounded-xl border border-line bg-card p-3 shadow-xl">
          <p className="text-sm font-semibold">Open the store now?</p>
          <p className="mt-1 text-xs text-muted">
            Customers can start ordering right away{store.closedMessage ? `. The message “${store.closedMessage}” will be removed` : ''}.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setOpening(false)} className="h-9 rounded-lg px-3 text-sm font-semibold text-muted">
              Keep closed
            </button>
            <button onClick={() => set(true)} disabled={busy} className="h-9 rounded-lg bg-leaf px-3 text-sm font-bold text-white">
              Open store
            </button>
          </div>
        </div>
      )}
      {closing && (
        <div className="absolute right-0 top-12 z-30 w-72 rounded-xl border border-line bg-card p-3 shadow-xl">
          <p className="text-sm font-semibold">Close the store now?</p>
          <input
            autoFocus
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message for customers, e.g. Heavy rain"
            className="mt-2 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setClosing(false)} className="h-9 rounded-lg px-3 text-sm font-semibold text-muted">
              Cancel
            </button>
            <button onClick={() => set(false)} disabled={busy} className="h-9 rounded-lg bg-vermilion px-3 text-sm font-bold text-white">
              Close store
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);
  const load = useCallback(() => {
    api<Stats>('/admin/stats/today').then(setStats).catch(() => undefined);
  }, []);
  useEffect(load, [load]);
  useLiveEvent('order:new', load);
  useLiveEvent('order:updated', load);

  if (!stats) return null;
  const items: { label: string; value: string; Icon: LucideIcon; tone: string; warn?: boolean }[] = [
    { label: 'Orders today', value: String(stats.orders), Icon: ClipboardList, tone: 'bg-maroon-50 text-maroon' },
    { label: 'In progress', value: String(stats.active), Icon: Timer, tone: 'bg-turquoise-50 text-turquoise' },
    { label: 'Delivered', value: String(stats.delivered), Icon: CheckCircle2, tone: 'bg-leaf-50 text-leaf' },
    { label: 'Sales today', value: rupees(stats.revenue), Icon: IndianRupee, tone: 'bg-gold-50 text-wood' },
    { label: 'Cash with riders', value: rupees(stats.codPending), Icon: Banknote, tone: 'bg-sand text-wood' },
    {
      label: 'Low stock',
      value: String(stats.lowStock),
      Icon: stats.lowStock > 0 ? PackageOpen : Package,
      tone: stats.lowStock > 0 ? 'bg-vermilion-50 text-vermilion' : 'bg-sand text-muted',
      warn: stats.lowStock > 0,
    },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ label, value, Icon, tone, warn }) => (
        <div key={label} className={`flex items-center gap-2.5 rounded-xl border bg-card py-1.5 pl-1.5 pr-4 shadow-sm ${warn ? 'border-vermilion/40' : 'border-line'}`}>
          <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
            <Icon size={18} />
          </span>
          <div>
            <div className="text-[11px] font-medium text-muted">{label}</div>
            <div className="text-base font-bold leading-tight tabular-nums">{value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { connected } = useLive();
  const [admin, setAdmin] = useState<AdminUser | null>(null);

  useEffect(() => {
    if (!getSession()) {
      router.replace('/login');
      return;
    }
    api<AdminUser>('/admin/me').then(setAdmin).catch(() => undefined);
  }, [router]);

  function logout() {
    logoutSession();
    router.replace('/login');
  }

  if (!admin) {
    return <div className="flex min-h-screen items-center justify-center text-muted">Loading dashboard…</div>;
  }

  return (
    <AdminContext.Provider value={admin}>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col bg-maroon text-white">
          <div className="flex items-center gap-3 px-5 pb-3 pt-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- small static logo */}
            <img src="/logo.png" alt="" className="h-11 w-11 rounded-xl" />
            <div>
              <div className="font-display text-2xl leading-none text-gold">Chito</div>
              <div className="text-xs opacity-80">Store dashboard</div>
            </div>
          </div>
          <div className="dentil" />
          <nav className="mt-3 flex-1 space-y-1 px-3">
            {NAV.map((n) => {
              const on = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 font-semibold transition ${on ? 'bg-gold text-maroon' : 'hover:bg-maroon-700'}`}>
                  <n.Icon size={18} aria-hidden />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="space-y-1 border-t border-maroon-700 px-5 py-4 text-sm">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${connected ? 'bg-leaf' : 'bg-vermilion'}`} />
              {connected ? 'Live' : 'Reconnecting…'}
            </div>
            <div className="truncate opacity-80">
              {admin.email} · {admin.role === 'OWNER' ? 'Owner' : 'Staff'}
            </div>
            <button onClick={logout} className="flex items-center gap-1.5 font-semibold text-gold hover:underline">
              <LogOut size={14} /> Log out
            </button>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-parchment/95 px-6 py-3 backdrop-blur">
            <StatsBar />
            <OpenSwitch />
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </AdminContext.Provider>
  );
}
