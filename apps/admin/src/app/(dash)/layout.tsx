'use client';

import { Shell } from '@/components/Shell';
import { LiveProvider } from '@/lib/live';

export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <LiveProvider>
      <Shell>{children}</Shell>
    </LiveProvider>
  );
}
