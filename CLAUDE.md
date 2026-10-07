# CLAUDE.md

Guidance for Claude Code (and any AI assistant) working in this repo.

## Project
**Chito** is a Blinkit-style quick grocery delivery app for **Singtam, East Sikkim, India**.
- **Own store model:** one Chito-run dark store in **Singtam Bazaar, East Sikkim – 737134**. No third-party sellers.
- **Store hours: 6:00 AM – 10:00 PM** (Asia/Kolkata), editable by admin. Fees, minimum order, radius, hours and riders all come from **admin settings in the DB**, never hard-coded.
- **Design:** "Gompa" monastery-inspired theme (maroon + gold + turquoise, parchment background, arched cards, left category rail with prayer-flag edges, raised "Jhola" cart tab). It must **not** look like Blinkit. Respect the cultural rules in DESIGN.md §5.1.
- **Delivery only within 3 km** (straight-line) of the store. This is enforced **server-side**.
- **Apps:** Customer app (React Native + Expo, Android-first) and Admin dashboard (Next.js web).
- **No rider app in v1.** Riders wait at the store and the **admin assigns orders to riders** from the dashboard.
- **Payments:** Cash on Delivery + Razorpay (UPI/cards/wallets).
- **Backend:** Node.js + Express + TypeScript + MongoDB Atlas (Mongoose).

Full requirements are in [PRD.md](PRD.md). The visual system is in [DESIGN.md](DESIGN.md). Read them before building a feature.

## Repo layout (planned monorepo: pnpm workspaces + Turborepo)
```
apps/
  mobile/     # Expo app (Expo Router, Zustand, socket.io-client)
  admin/      # Next.js 16 App Router + Tailwind v4
  api/        # Express + Mongoose + Socket.io
    seed/     # ✅ categories.json (24), products.json (179), images/<folder>/*.jpg (200)
packages/
  shared/     # Zod schemas, TS types, enums (OrderStatus etc.), money/format utils
  config/     # shared tsconfig, eslint, tailwind preset (design tokens)
```

## Current state (2026-10-05)
Three standalone npm projects (not yet a pnpm workspace). All three are built, connected and tested end to end.

- ✅ **`apps/api`**: Express 5 + Mongoose 9 + Socket.io on MongoDB Atlas (db `chito`).
  - Routes: `src/routes/customer.ts`, `src/routes/admin.ts`.
  - Business rules: `src/services/orders.ts` (create with transaction + atomic stock, cancel, advance, assignRider) and `src/services/store.ts` (hours in IST, serviceability, bill).
  - Status map: `src/lib/order-status.ts`.
  - Seeded by `scripts/seed.ts`. `scripts/e2e.ts` runs 93 checks (`npm run e2e`) and `scripts/edge.ts` 61 edge-case/abuse checks (`npm run edge`) against a running server. Both clean up after themselves; run both after any API change.
  - Robustness rules (keep them):
    - Library errors map to 4xx in `src/lib/http.ts` (bad JSON → 400, too big → 413, bad ObjectId → 404, duplicate key → 409).
    - Order status, rider assignment and COD settlement are atomic conditional updates (double clicks can't double-count).
    - The same `Idempotency-Key` sent twice at once returns one order.
    - A hidden category's products can't be ordered.
    - Guessing limits for admin password / OTP live in `src/lib/rate-limit.ts` (in-memory; move to Redis with more than one server).
  - **Online payments** use Razorpay **Payment Links** (`src/services/razorpay.ts`): an ONLINE order is created as `PAYMENT_PENDING` (stock held, hidden from the admin board), the customer pays on Razorpay's page, and the order becomes `PLACED` only via the signed callback (`GET /payments/razorpay/callback`), the signed webhook (`POST /webhooks/razorpay`, `payment_link.paid`) or `POST /orders/:id/payment/refresh` (asks Razorpay). Unpaid orders expire after ~16 min (`expireUnpaidOrders`, every minute). Cancelling a paid order refunds it (`REFUNDED`, or `REFUND_FAILED` → owner refunds from the Razorpay dashboard). `PUBLIC_API_URL` must be reachable by the phone for the callback.
  - **Ordering for someone else:** order addresses carry `recipientName` / `recipientPhone` (rider calls them). `POST /geo/resolve` turns a pasted WhatsApp/Google Maps location (or "lat, lng") into a checked pin; only Google short-link hosts are ever fetched (`src/lib/maplink.ts`).
  - **Auth:** JWT (`src/lib/auth.ts`) with separate secrets.
    - Access tokens last 15 min (no DB lookup).
    - Refresh tokens last 30 days for customers and 7 days for admins (`JWT_ADMIN_REFRESH_EXPIRES_IN`), and carry the account's `tokenVersion`.
    - `POST /auth/refresh` re-checks the account every time (deleted, blocked or version mismatch → 401; admin role is read from the DB). A missing `tokenVersion` counts as 0.
    - `POST /auth/logout` and the owner's `POST /admin/customers/:id/logout-everywhere` bump the version, which ends every session.
    - Mobile keeps tokens in SecureStore. Admin uses localStorage (move to httpOnly cookies at deployment).
  - Dev-only flags `DEV_ALLOW_ANY_LOCATION` / `DEV_IGNORE_STORE_HOURS` are ignored in production. `OTP_DEV_MODE` makes the OTP 1234. Active flags are exposed as `testMode` on `GET /store`; the admin shows an orange "TEST MODE" chip and the app never shows "We deliver here" for an out-of-range pin (`/serviceability/check` returns the true `withinRadius` + `testModeBypass`).
- ✅ **`apps/admin`**: **Next.js 16** (read `apps/admin/AGENTS.md`: check `node_modules/next/dist/docs` before using Next APIs), Tailwind v4 with Gompa tokens in `src/app/globals.css`.
  - Pages: login, live Orders board (`(dash)/page.tsx`: drawer, packing list, assign rider, print slip), **Day report** (`(dash)/reports`: cash collected / online received / refunds for any IST day, cash by rider, all orders, best sellers, last 30 days, printable; API `GET /admin/reports/day?date=` and `/admin/reports/days`; unpaid online attempts are excluded), Riders (status, COD settle), Products (add product with photo upload, inline price/stock/category, Visible/Hidden toggle), Categories (add, rename, reorder, hide, delete-when-empty), Settings, Customers. Photos upload via `POST /admin/uploads` (ImageKit key stays on the server).
  - Token in localStorage (`src/lib/api.ts`). Live updates via `src/lib/live.tsx`.
- ✅ **`apps/mobile`**: Expo **SDK 57**, Expo Router (`src/app/`).
  - Data comes from the API via `src/api/client.ts` (auto token refresh). Live order updates via `src/api/socket.ts`.
  - Catalogue + store settings live in Zustand stores (`src/state/catalog.ts`), cached in AsyncStorage for offline start and refreshed on launch, app foreground and Jhola open.
  - Tokens are in SecureStore (`src/state/storage.ts`; AsyncStorage on web). Saved addresses (many, each with an optional receiver name/phone) + the selected one are in `useProfile` (`useSelectedAddress()`).
  - Address pins come from GPS, a full-screen map (`src/app/map-pick.tsx` + `src/components/map/`: Leaflet + OpenStreetMap tiles in a WebView, iframe on web; never put the WebView in a Modal (unreliable on Android); swap for Google Maps before launch, OSM's tile policy forbids heavy app use) or a pasted shared location.
  - Online payment: `src/lib/payment.ts` opens the Razorpay page (expo-web-browser) and then asks the server; the tracking screen shows "Pay now" while `PAYMENT_PENDING`. The app sends `returnUrl` (= `Linking.createURL('payment-return/ORDER_ID')`, so `exp://…` in Expo Go and `chito://…` in builds) with ONLINE orders; the server only accepts `chito://` (plus `exp://` outside production) and the result page redirects there → `src/app/payment-return/[id].tsx` goes back to the order screen.
  - Home shelves (`src/components/Shelf.tsx`) show a peeking card, an arrow, "See all" and a one-time nudge so sideways scrolling is obvious.
- Product images live on ImageKit under `/chito/products/<category>/<file>` (uploaded by `apps/api/scripts/upload-seed-images.mjs`). The API returns these paths; clients add `?tr=…`.
- **Branding is "Sikkim"** (expansion planned). The single store stays "Singtam Bazaar, 737134"; radius copy says "of our store". Multi-store is a future step.

Run locally (`.claude/launch.json` has all three):
- **API:** `cd apps/api && npm run dev` (port 4000). Also `npm run seed`, `npm run e2e`, `npm run typecheck`.
- **Admin:** `cd apps/admin && npm run dev` (port 3000). Also `npm run build`, `npm run lint`.
- **Mobile:** `cd apps/mobile && npx expo start` (Expo Go) or `npm run web`. Also `npx expo lint`, `npx tsc --noEmit`. Always add packages with `npx expo install`.
- A real phone reaches the API at `EXPO_PUBLIC_API_URL` = the PC's Wi-Fi IP. Windows Firewall must allow inbound port 4000.

## Commands (target monorepo, once scaffolded)
```bash
pnpm install
pnpm dev                    # all apps via turbo
pnpm --filter mobile start  # Expo dev server (use a dev build, NOT Expo Go — Razorpay & maps need native code)
pnpm --filter api dev       # API on :4000
pnpm --filter admin dev     # Admin on :3000
pnpm --filter api seed      # upload seed images to ImageKit + upsert categories/products
pnpm lint && pnpm typecheck && pnpm test
eas build -p android --profile preview   # test APK
```

## Conventions
- **TypeScript strict** everywhere. No `any` without a comment explaining why.
- **Shared Zod schemas** in `packages/shared` are the single source of truth for request/response shapes. Infer types from them.
- **Money is integer paise** (`number`, ₹1 = 100). Never use floats for money. Format with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.
- **Time:** store UTC in DB, display in `Asia/Kolkata`.
- **Coordinates:** GeoJSON order is **`[lng, lat]`**. Double-check this every time.
- Mobile: Expo Router file routes in `apps/mobile/src/app/`. All server calls go through `api()` in `apps/mobile/src/api/client.ts`. Shared server data (catalogue, store settings) lives in Zustand stores in `src/state/catalog.ts`; use the hooks (`useProducts`, `useProduct`, `useStoreInfo`…), not ad-hoc fetches. Screen-local data (orders) is fetched in the screen. Cart, session and profile are Zustand stores too.
- The server is the source of truth for prices, stock, fees, hours and serviceability. Mobile `computeBill` (`src/lib/store-config.ts`) mirrors the server formula for display only.
- Styling (mobile): React Native styles using the tokens in `apps/mobile/src/theme/index.ts` (mirrors DESIGN.md §2–§4). Don't hard-code hex values in screens. Text goes through `<Txt variant=…>`. Fonts: Yatra One (headings only) + Mukta (everything else). Monastery motifs live in `src/components/ornaments.tsx` and `MonasteryScene.tsx`.
- Web gotchas: never nest Pressables (renders `<button>` in `<button>`), and don't pass `accessible` to `<Svg>`.
- Product images are **never bundled in the app**. The seed script uploads `apps/api/seed/images` to **ImageKit** and the app loads URLs from the API. Uploads always go through the API, because the ImageKit private key is server-only. Clients request sizes with URL transforms (`?tr=w-300,f-auto`) via a shared `imageUrl(path, width)` helper. Seed images are AI-generated demos and must be replaced with real photos before launch.
- All user-facing strings go through i18next (`t('key')`). Languages: en (launch), ne, hi.
- API: routes → controllers → services → models. Validate every input with Zod middleware. Return errors as `{ error: { code, message } }`.
- Keep the app light for low-end Android and patchy 4G: use `expo-image`, ImageKit-resized images (`f-auto`), paginated lists (`FlashList`), and avoid heavy animation libs.

## Domain rules (must not be broken)
1. **Serviceability is server-side.** `POST /orders` must recompute the distance from the store (`$nearSphere` / haversine) and reject if `> store.serviceRadiusKm` (default 3). The client check is for UX only.
2. **Never trust client prices.** On order creation, re-read product price/stock from the DB, recompute the bill (fees, coupon) and snapshot items into the order.
3. **Store must be open** (`store.isOpen` and within hours) to accept ASAP orders.
4. **Stock:** decrement atomically on order placement (`findOneAndUpdate` with `stock: { $gte: qty }`, inside a transaction). Restore on cancellation/payment expiry.
5. **Order status transitions** only via the allowed map in `packages/shared` (see PRD §6):
   `PAYMENT_PENDING → PLACED → CONFIRMED → PACKED → OUT_FOR_DELIVERY → DELIVERED`, plus `CANCELLED` / `DELIVERY_FAILED`. Every change is appended to `statusHistory` and emitted via Socket.io.
6. **Rider assignment is admin-only.** Assigning sets the order to `OUT_FOR_DELIVERY` and the rider to `ON_DELIVERY`. Delivering sets the rider back to `AVAILABLE` (if no other active orders). COD amount is added to the rider's `codBalance` until settled.
7. **Online payments:** the order becomes `PLACED` only after a verified Razorpay signature (payment-link callback or `payment_link.paid` webhook) or a server-side status check with Razorpay. Never trust the client. Always verify the webhook signature. `PAYMENT_PENDING` orders expire after ~16 min (Razorpay's minimum link expiry is 15).
8. **Order creation is idempotent** (`Idempotency-Key` header, unique index).
9. Customers can cancel only in `PAYMENT_PENDING` / `PLACED` / `CONFIRMED`.

## Environment variables
`apps/api/.env`:
```
PORT=4000
MONGODB_URI=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
MSG91_AUTH_KEY=
MSG91_OTP_TEMPLATE_ID=
OTP_DEV_MODE=true       # dev: no SMS, OTP is always 1234. MUST be false in production
ADMIN_EMAIL=            # first OWNER admin, created by seed script
ADMIN_PASSWORD=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
IMAGEKIT_PUBLIC_KEY=
IMAGEKIT_PRIVATE_KEY=
IMAGEKIT_URL_ENDPOINT=
EXPO_ACCESS_TOKEN=
# Seed defaults only — after first run, the store doc in MongoDB (admin settings) is the source of truth
STORE_LAT=27.234        # Singtam Bazaar, 737134 (admin sets exact pin)
STORE_LNG=88.499
SERVICE_RADIUS_KM=3
STORE_OPEN_TIME=06:00
STORE_CLOSE_TIME=22:00
SENTRY_DSN=
```
`apps/mobile/.env`: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_RAZORPAY_KEY_ID`, `EXPO_PUBLIC_SENTRY_DSN`. The Google Maps key goes in `app.config.ts`.
Never commit `.env` files. Keep `.env.example` files up to date.

## Local context to keep in mind
- Singtam is hilly, so road distance is greater than straight-line distance. Addresses rely on **landmarks**, so the landmark field is required.
- Users speak Nepali, Hindi and English. Copy should be simple and friendly.
- Monsoon/landslides can close the store. Always handle `store.isOpen === false` gracefully in the UI.
- Phase plan: Phase 1 = COD MVP, Phase 2 = Razorpay + push + i18n, Phase 3 = rider app with live GPS.
