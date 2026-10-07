'use client';

import { LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAdmin } from '@/components/Shell';
import { api } from '@/lib/api';

type Customer = { id: string; phone: string; name: string; isBlocked: boolean; createdAt: string };

function LogoutEverywhere({ c }: { c: Customer }) {
  const [state, setState] = useState<'idle' | 'confirm' | 'busy' | 'done' | 'error'>('idle');
  async function run() {
    setState('busy');
    try {
      await api(`/admin/customers/${c.id}/logout-everywhere`, { method: 'POST' });
      setState('done');
    } catch {
      setState('error');
    }
  }
  if (state === 'done') return <span className="text-sm font-semibold text-leaf">Logged out everywhere ✓</span>;
  if (state === 'confirm' || state === 'busy')
    return (
      <span className="flex items-center justify-end gap-2 text-sm">
        <span className="text-muted">Sure?</span>
        <button onClick={() => setState('idle')} className="font-semibold text-muted hover:underline">
          No
        </button>
        <button onClick={run} disabled={state === 'busy'} className="font-bold text-vermilion hover:underline disabled:opacity-50">
          Yes, log out
        </button>
      </span>
    );
  return (
    <button
      onClick={() => setState('confirm')}
      title="For a lost phone or a suspicious login. They can log in again with an OTP."
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-wood hover:text-vermilion">
      <LogOut size={14} /> {state === 'error' ? 'Failed, try again' : 'Log out everywhere'}
    </button>
  );
}

export default function CustomersPage() {
  const admin = useAdmin();
  const isOwner = admin?.role === 'OWNER';
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Customer[]>('/admin/customers').then(setCustomers).catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-3xl text-maroon">Customers</h1>
      <p className="mb-4 text-sm text-muted">{customers ? `${customers.length} ${customers.length === 1 ? 'person has' : 'people have'} signed up` : 'Loading…'}</p>
      {error && <p className="mb-3 rounded-lg bg-vermilion-50 p-3 font-semibold text-vermilion">{error}</p>}
      <div className="overflow-hidden rounded-xl border border-line bg-card">
        <table className="w-full text-left">
          <thead className="bg-sand text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Joined</th>
              {isOwner && <th className="px-4 py-2 text-right">Sessions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {customers?.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2 font-semibold">{c.name || <span className="text-muted">(no name yet)</span>}</td>
                <td className="px-4 py-2">
                  <a href={`tel:${c.phone}`} className="text-turquoise">
                    {c.phone}
                  </a>
                </td>
                <td className="px-4 py-2 text-sm text-muted">{new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                {isOwner && (
                  <td className="px-4 py-2 text-right">
                    <LogoutEverywhere c={c} />
                  </td>
                )}
              </tr>
            ))}
            {customers?.length === 0 && (
              <tr>
                <td colSpan={isOwner ? 4 : 3} className="px-4 py-8 text-center text-muted">
                  No customers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
