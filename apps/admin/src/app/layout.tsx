import type { Metadata } from 'next';
import { Mukta, Yatra_One } from 'next/font/google';

import './globals.css';

const yatra = Yatra_One({ weight: '400', subsets: ['latin', 'devanagari'], variable: '--font-yatra' });
const mukta = Mukta({ weight: ['400', '500', '600', '700'], subsets: ['latin', 'devanagari'], variable: '--font-mukta' });

export const metadata: Metadata = {
  title: 'Chito Admin',
  description: 'Chito store dashboard: orders, riders, products and settings',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // Browser extensions (Grammarly, ColorZilla, password managers…) add attributes to <html>/<body>
    // before React loads; ignore those two tags only, so the dev overlay doesn't flag a fake error
    <html lang="en" className={`${yatra.variable} ${mukta.variable}`} suppressHydrationWarning>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
