// One-container deploy (see the repo's Dockerfile): the API also serves the three web apps from WEB_DIR.
//   /        customer web app (Expo export)   ← WEB_DIR/web
//   /admin   store dashboard (Next.js export)  ← WEB_DIR/admin
//   /rider   rider web app (Expo export)       ← WEB_DIR/rider
// The two Expo apps are single-page apps, so any unknown path inside them gets their index.html.
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const isApiPath = (p: string) => p.startsWith('/api/') || p === '/api' || p === '/health' || p.startsWith('/socket.io');

export function mountWebApps(app: Express, webDir: string) {
  const sites = [
    { base: '/admin', dir: join(webDir, 'admin'), spa: false },
    { base: '/rider', dir: join(webDir, 'rider'), spa: true },
    { base: '/', dir: join(webDir, 'web'), spa: true },
  ].filter((s) => existsSync(join(s.dir, 'index.html')));
  // Next.js static export: the browser prefetches "<page>/__next.<seg>.<seg>.__PAGE__.txt", but the files are saved
  // nested, "<page>/__next.<seg>/<seg>/__PAGE__.txt". Point those requests at the nested file.
  const admin = sites.find((s) => s.base === '/admin');
  if (admin) {
    app.use('/admin', (req: Request, _res: Response, next: NextFunction) => {
      const m = /^(.*\/)__next\.([^/]+)\.txt$/.exec(req.path);
      if (m && !existsSync(join(admin.dir, req.path))) {
        const [first, ...rest] = m[2].split('.');
        if (rest.length) req.url = `${m[1]}__next.${first}/${rest.join('/')}.txt${req.url.slice(req.path.length)}`;
      }
      next();
    });
  }
  for (const s of sites) {
    // Hashed bundles can be cached for long; index.html must always be fresh so updates reach people
    app.use(
      s.base,
      express.static(s.dir, {
        index: 'index.html',
        setHeaders: (res, file) => res.setHeader('Cache-Control', file.endsWith('.html') ? 'no-cache' : 'public, max-age=604800'),
      }),
    );
  }
  // Single-page apps: their own routes (/order/…, /rider/order/…) load index.html and route in the browser
  app.use((req: Request, res: Response, next: NextFunction) => {
    // The dashboard is plain pages (no client routing), so its unknown paths stay 404
    if (req.method !== 'GET' || isApiPath(req.path) || req.path.startsWith('/admin') || !req.accepts('html')) return next();
    const site = sites.find((s) => s.spa && (s.base === '/' || req.path === s.base || req.path.startsWith(`${s.base}/`)));
    if (!site) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(join(site.dir, 'index.html'));
  });
  return sites.map((s) => s.base);
}

export { isApiPath };
