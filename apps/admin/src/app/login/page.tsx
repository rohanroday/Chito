'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { api, setSession } from '@/lib/api';
import type { AdminUser } from '@/lib/types';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<{ admin: AdminUser; accessToken: string; refreshToken: string }>('/admin/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      setSession({ accessToken: r.accessToken, refreshToken: r.refreshToken });
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-maroon p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-card shadow-xl">
        {/* eslint-disable-next-line @next/next/no-img-element -- small static logo */}
        <img src="/logo.png" alt="Chito" className="mx-auto mt-6 h-24 w-24 rounded-2xl" />
        <div className="px-6 pb-2 pt-4 text-center">
          <h1 className="font-display text-2xl text-maroon">Store dashboard</h1>
          <p className="text-sm text-muted">Tashi Delek 🙏 Log in to manage orders</p>
        </div>
        <form onSubmit={submit} className="space-y-3 px-6 pb-6 pt-2">
          <label className="block">
            <span className="text-sm font-semibold">Email</span>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 h-11 w-full rounded-lg border-[1.5px] border-line bg-white px-3 outline-none focus:border-maroon"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 h-11 w-full rounded-lg border-[1.5px] border-line bg-white px-3 outline-none focus:border-maroon"
            />
          </label>
          {error && <p className="rounded-lg bg-vermilion-50 px-3 py-2 text-sm font-semibold text-vermilion">{error}</p>}
          <button
            disabled={busy}
            className="h-11 w-full rounded-lg bg-maroon font-bold text-gold transition hover:bg-maroon-700 disabled:opacity-60">
            {busy ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <div className="dentil" />
      </div>
    </main>
  );
}
