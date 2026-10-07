# Chito: Product Requirements Document (PRD)

| | |
|---|---|
| **Product** | Chito, quick grocery and essentials delivery |
| **Location** | Singtam, East Sikkim, India |
| **Platforms** | Customer app (Android first, then iOS) built with React Native + Expo. Admin dashboard (web). |
| **Version** | v1.0 (MVP) |
| **Owner** | Rohan |
| **Last updated** | 2026-10-06 |
| **Store** | Singtam Bazaar, East Sikkim – 737134 · Open 6 AM – 10 PM |
| **Design** | "Gompa" monastery-inspired theme, see [DESIGN.md](DESIGN.md) |

---

## 1. Overview

### 1.1 Vision
Chito is a Blinkit-style quick-commerce app built for **Singtam**. Residents can order groceries, fresh produce, dairy, snacks and household essentials from their phone. Orders are delivered to their doorstep in **15–30 minutes** from a single Chito-run store (dark store) in town.

### 1.2 Problem
- Singtam has no reliable app-based quick delivery. Big players (Blinkit, Zepto, Swiggy Instamart) do not operate here.
- Residents walk or drive to the bazaar for small daily needs. This is hard during monsoon, for elderly people, and for families living uphill.
- Local shops take orders by phone or WhatsApp. These orders have no catalog, no price transparency and no order tracking.

### 1.3 Goals (first 6 months)
| Goal | Metric | Target |
|---|---|---|
| Adoption | Registered users | 1,500+ |
| Usage | Orders per day | 50+ by month 3, 100+ by month 6 |
| Speed | Median order-to-delivery time | ≤ 25 min |
| Reliability | Orders delivered without issue | ≥ 97% |
| Retention | Users ordering again within 30 days | ≥ 40% |
| Quality | Average order rating | ≥ 4.5 / 5 |

### 1.4 Non-goals (v1)
- A marketplace of third-party sellers. Chito sells from its own store only.
- A delivery partner app. Riders are managed by the admin (see §6).
- Delivery outside the 3 km service radius.
- Restaurant or cooked-food delivery.

---

## 2. Local context: Singtam, East Sikkim

These realities shape the product. **Every feature must respect them.**

| Reality | Product implication |
|---|---|
| **Hilly terrain.** Roads wind along NH10 and the Teesta and Rani Khola, so road distance is much longer than straight-line distance. | 3 km radius is the *maximum*. Admin can shrink it. ETA shown is conservative (see §5). Future: road-distance checks. |
| **Addresses lack house numbers.** People describe places by landmark ("near Singtam Hospital", "above SBI", "Golitar", "Lall Bazaar"). | Address form makes **landmark** and **directions note** prominent. A map pin is mandatory. Customer's phone number is always visible to the rider. |
| **Patchy 4G and low-end Android phones** | Small app size, compressed images, cached catalog, offline-tolerant cart, retry logic, and minimal animations. |
| **Languages:** Nepali, Hindi, English | i18n from day one. English at launch, with Nepali and Hindi strings in Phase 2. |
| **Monsoon (Jun–Sep), landslides, NH10 blockages, power cuts** | **Store open/closed switch** with custom message ("Closed due to heavy rain"). Admin can pause ASAP delivery and allow scheduled slots only. |
| **Cash is common, UPI is growing fast** | COD and UPI/online (Razorpay) both supported. |
| **Small town and trust** | Show the rider's name and phone number. Easy call/WhatsApp support. Friendly local tone in copy. |
| **Festivals** (Dashain, Tihar, Losar, Saga Dawa, Diwali) | Banner and coupon system for festive campaigns. |

### 2.1 Service area
- **Store location:** one Chito dark store in **Singtam Bazaar, East Sikkim – 737134**. The exact map pin is set by the admin in dashboard settings. The default seed value is Singtam Bazaar, approx. `27.234° N, 88.499° E`. The admin drops the pin on the actual shop door once.
- **Store hours:** **6:00 AM – 10:00 PM, every day** (`Asia/Kolkata`). ASAP orders are accepted only inside these hours. Outside them, the app shows "Closed now · Opens 6:00 AM". The admin can change hours per day and close the store any time.
- **Radius:** **3 km straight-line distance** from the store (`SERVICE_RADIUS_KM = 3`), stored in DB settings so admin can change it.
- **Check happens:**
  1. On first app open, after location permission. The app shows a "Delivering to you!" or "Not yet in your area" screen.
  2. When saving an address. Out-of-zone addresses can be saved but are flagged as non-deliverable.
  3. **At checkout, on the server.** This check is authoritative, and the order is rejected if the address is outside the radius.
- **Implementation:** MongoDB `2dsphere` index on the store location, plus `$geoNear` / `$nearSphere` with `$maxDistance: 3000` (meters). The server also computes the haversine distance and stores it on the order.
- **Out-of-zone UX:** friendly screen ("Chito isn't in your area yet!") with a **"Notify me"** waitlist. The waitlist stores phone and location, which helps decide where to expand.

---

## 3. Users and personas

| Persona | Description | Key needs |
|---|---|---|
| **Customer: household** (e.g. homemaker in Singtam Bazaar) | Orders daily vegetables, milk, atta, oil | Fast delivery, fair prices, COD, reorder |
| **Customer: student or young professional** | Snacks, instant food, toiletries | UPI, quick checkout, offers |
| **Customer: elderly or uphill resident** | Hard to walk to the bazaar | Simple UI, big text, phone support, landmark addresses |
| **Admin / store manager** (Rohan and staff) | Runs the store, packs orders, assigns riders | Live order queue, stock control, rider assignment, reports |
| **Rider** (operational actor, *no app in v1*) | Waits at the store and delivers orders | Gets the order slip and customer phone/address from the admin, collects COD |

---

## 4. Customer app: features (MVP)

### 4.1 Onboarding and auth
- Splash screen with Chito logo.
- **Phone number + OTP login** (Indian +91 numbers). No passwords.
- Name capture after the first login.
- Location permission prompt with a clear reason. A "Enter address manually" fallback is available.
- Serviceability check against the 3 km radius, followed by the home screen or the out-of-zone screen.

### 4.2 Addresses
- **Three ways to set the pin** (✅ built):
  - **Use my current location** (GPS), for when you are at the door.
  - **Pick on the map**: a full-screen map; drag it so the pin sits on the door. A circle shows the 3 km area, with a live "x km from our store" hint.
  - **Paste a shared location**: a WhatsApp "location" message, a Google Maps link (short links are expanded on the server) or plain "lat, lng".
- Fields: **House/building name**, **Landmark** (required), **Area/locality** (required), **Directions note** (optional, e.g. "2nd gate after the temple, blue house"), and a free-text **Label** ("Home", "Work", "Mom's house"…).
- **Who receives it:** "Me" or **"Someone else"** with their name and phone. This is for people living away who send groceries to family in Sikkim. The rider calls the receiver, and the order screen, admin card and rider slip show "Deliver to: Mom".
- Multiple saved addresses (stored on the phone). The one picked last is used for the next order. Edit and delete (with confirm).
- Each address shows its distance from the store and its deliverability status. A missing pin is flagged ("add pin").

### 4.3 Home and browsing
- Header: **delivery ETA + selected address chip** ("Delivery in 20 mins · Golitar ▾"). When the store is closed the ETA line says "Closed right now" / "Opens at 6 AM" instead (never a delivery promise).
- Search bar (sticky).
- Banner carousel (offers and festivals).
- Category grid. **Seeded** (24 categories, 179 products, see `apps/api/seed/`): Fruits & Vegetables, Dairy & Bread, Atta/Rice/Dal & Oil, Masala & Spices, Tea & Coffee, Instant Noodles, Snacks & Namkeen, Biscuits, Cold Drinks & Juices, Breakfast & Cereals, Ready to Eat, Pasta/Soups & Mixes, Dry Fruits & Seeds, Chocolates, Sauces & Spreads, Frozen Food, Health Drinks, Baby Care, Personal Care, Oral Care, Cleaning & Household, Home & Kitchen, Pet Care, Stationery. **Add later:** Pooja Items, Local Specials (churpi, dalle khursani, gundruk).
- "Buy again" row (from past orders) and "Bestsellers" row.
- Store-closed banner when the store is closed (shows the next opening time).

### 4.4 Category and product listing
- Left rail of sub-categories with a product grid on the right (Blinkit pattern).
- Product card: image, name, weight/unit, price, MRP strikethrough, discount tag, and an **ADD** button that turns into a −/+ stepper.
- Out-of-stock items are greyed out and sorted to the bottom.
- Sort (relevance, price) and simple filters (in stock, discount).

### 4.5 Search
- Instant search with debounce. Matches English names and **local/alternative names** (e.g. "aloo" / "potato", "pyaj" / "onion", "dalle").
- ✅ Aisle words in English, Nepali/Hindi in English letters ("dudh", "chiya", "tarkari") **and in Devanagari** ("दूध", "चिया", "तरकारी", "साबुन"). Whole matching aisles are shown first.
- Popular searches ("Popular in Sikkim").
- No-results state suggests other words and calling the store. *Phase 2:* a "Request this product" button logged for the admin (nothing is logged today, so the app must not promise it).

### 4.6 Product detail
- Image gallery, name, unit, price/MRP, description, shelf life, and country of origin (where required).
- Quantity stepper with a max quantity per order (set by admin).
- Similar products row.

### 4.7 Cart
- Persistent cart. It is stored locally and synced to the server.
- Line items with stepper, item total, savings.
- **Bill summary:** item total, delivery fee, small-cart fee (if below the minimum), handling fee (optional), coupon discount, **grand total**.
- **Minimum order value** (configurable, e.g. ₹99). Below it, show "Add ₹X more for free delivery" or block checkout. Admin decides.
- Server re-validates price and stock at checkout. If anything changed, show a "Prices updated" notice.

### 4.8 Checkout
- Select or confirm delivery address. Out-of-zone addresses are blocked.
- Delivery option: **ASAP** (default, shows ETA) or **Schedule a slot** (today/tomorrow, 1-hour slots within store hours). Slots are a Phase 2 feature.
- Payment method: **Cash on Delivery** or **Pay online (UPI / Card / Wallet / Netbanking via Razorpay)**.
- Delivery instructions (e.g. "Call before coming", "Leave at gate").
- Place order. Online payment opens **Razorpay's hosted payment page** (Payment Link: UPI, cards, net banking) in the phone's browser and returns to the app afterwards. The order reaches the store only after the server has verified the payment.
- When the address is for **someone else**, "Pay now" is pre-selected, so the receiver pays nothing at the door. Cash on delivery stays available ("Mom pays the rider").

### 4.9 Order tracking
- Status timeline: **Placed → Confirmed → Packed → Out for delivery → Delivered** (plus Cancelled).
- Live updates via Socket.io, with polling as a fallback on bad networks.
- Once out for delivery, the screen shows the **rider's name, photo and a "Call rider" button**.
- ETA countdown.
- "Need help?" opens a call or WhatsApp to Chito support.

### 4.10 Orders, profile and misc
- Order history with status, items and a **Reorder** button.
- Cancel an order while it is *Waiting for payment*, *Placed* or *Confirmed* (before packing). A paid online order is refunded automatically.
- Rate the order (1–5 stars plus an optional comment).
- Download/view invoice (GST invoice, PDF).
- Profile: name, phone, saved addresses, notifications toggle (language picker comes with i18n in Phase 2). The name is re-read from the server whenever the app opens.
- **Log out** ends the session on the server too, so a copied login can't be reused.
- Help & Support: FAQs, call, WhatsApp.
- Legal: Terms, Privacy Policy, Refund Policy.
- **Push notifications:** order status changes, offers (opt-in).

---

## 5. Admin dashboard: features (MVP)

Web app (Next.js), used on a desktop or tablet at the store.

### 5.1 Auth and roles
- Email + password login (admin accounts are created by the owner, with no public signup). 5 wrong passwords for an email → 15-minute wait. Dashboard sessions last at most 7 days.
- Roles: **Owner** (everything) and **Staff** (orders, stock; no settings or reports).

### 5.2 Live order queue (main screen)
- Kanban columns (✅ built): **New → Packing → Ready for rider → Out for delivery → Done today**. Each column has an icon, a live count and an empty-state hint.
- **Sound + browser notification** on every new order.
- Order card: order #, time elapsed (turns red after SLA), items count, total, payment (COD/Paid), area/landmark, distance.
- Order detail: a plain **packing list** (no tick boxes), customer name/phone, **receiver name/phone when ordered for someone else**, address + landmark + map link, notes, payment state (CASH / PAID / UNPAID / REFUNDED / REFUND DUE).
- Double clicks are safe: an order can only move once (e.g. "Delivered" twice adds the rider's cash once).
- Actions: Accept / Reject (with reason, auto-refund if prepaid), Mark packed, **Assign rider**, Mark delivered, Cancel.
- Printable **order slip** (for rider: items, address, landmark, phone, amount to collect if COD).

### 5.3 Rider management and allocation (no rider app in v1)
- Rider roster: name, phone, photo, vehicle (scooter/bike/on-foot), active/inactive.
- **Availability board:** each rider is *Available at store* / *On delivery* / *Off duty*.
- **Assign rider** modal shows riders currently *Available at store*, ordered by who has waited longest. Admin picks one, and the order becomes *Out for delivery* while the rider becomes *On delivery*.
- A rider can carry **multiple orders** (batching for orders in the same area).
- When admin marks the order *Delivered* (rider calls/returns), the rider goes back to *Available*.
- **COD collection ledger:** cash each rider must hand over, with a mark-as-settled action at the end of shift.

### 5.4 Catalog and inventory
- Categories and sub-categories (name, image, sort order, active). ✅ Reorder by **drag and drop**, by **typing a position**, or with **top/bottom** buttons, next to a **live phone preview** of the app's Home grid (first 9 visible categories). Hiding a category hides its products everywhere, including at checkout.
- Products: name, local/alt names (for search), images, unit (e.g. 500 g, 1 L, 1 pc), MRP, selling price, category, tags, max qty per order, active, HSN code & GST rate.
- **Stock:** current quantity and low-stock threshold. Stock is decremented on order placement and restored on cancellation. Price can never be above MRP (checked on add and on edit).
- Low-stock alerts list.
- Bulk import/export via CSV.

### 5.5 Store settings
- Store location (map pin) and **service radius (default 3 km)**.
- Operating hours per day (default **6:00 AM – 10:00 PM**). Closing time must be after opening time (overnight hours are not supported).
- **Open/Closed switch** with message (rain, landslide, festival holiday).
- Minimum order value, delivery fee rules (e.g. free above ₹199), small-cart fee, handling fee.
- Default ETA (e.g. 20 min) + extra minutes for distance bands (0–1 km, 1–2 km, 2–3 km).
- Cancellation window and support phone/WhatsApp number.

### 5.6 Marketing
- Banners (image, link to category/product, start/end date).
- Coupons: code, flat/percent, min order, max discount, usage limit per user/overall, validity, first-order-only flag.

### 5.7 Customers and reports
- Customer list: name, phone, orders count, total spent, last order, block user. ✅ Owner action: **"Log out everywhere"** (lost phone / suspicious login).
- Waitlist (out-of-zone sign-ups) on a map.
- Product requests (from "no results" searches).
- ✅ **Day report** (end-of-day tally, any date, printable):
  - Money: cash collected, online received, total takings, refunded and refund-due amounts.
  - Orders: received, delivered, cancelled, still open (with a warning to close them first).
  - Sales breakdown, cash to collect per rider, every order of the day, best sellers.
  - Last 30 days table.
  - Unpaid online attempts never count.
- Later: weekly sales, avg delivery time, rider performance.

---

## 6. Order lifecycle and rider allocation flow

```
Customer places order
   │  (server: validate radius ≤ 3 km, store open, stock, prices, coupon)
   ▼
PAYMENT_PENDING (online only, stock held ~16 min, hidden from the store)
   │ (payment verified)
   ▼
PLACED ──(admin accepts)──► CONFIRMED ──► PACKED ──(admin assigns available rider)──► OUT_FOR_DELIVERY ──► DELIVERED
   │                           │            │
   └────(customer/admin cancel)┴────────────┴──► CANCELLED  (stock restored, refund if prepaid)
```

**Online payment flow (✅ built with Razorpay Payment Links: no native SDK, works in Expo Go):**
1. App calls `POST /orders` with `paymentMethod: ONLINE` and its own `returnUrl`. The server holds the stock, creates the order as `PAYMENT_PENDING` and creates a Razorpay **Payment Link**.
2. The app opens the link in the phone's browser and the customer pays (UPI, card, net banking).
3. Razorpay redirects to `GET /payments/razorpay/callback`. The server verifies the HMAC signature, moves the order to `PLACED` and the store hears about it. The result page sends the customer back to the app (`chito://…`, `exp://…` while developing; no other targets allowed).
4. Backups: the signed **webhook** `payment_link.paid`, and `POST /orders/:id/payment/refresh`, which asks Razorpay directly.
5. Unpaid orders expire after ~16 min (Razorpay's minimum link life is 15) and their stock is released. A late payment on an expired order is refunded automatically.

**Rider allocation (v1, manual):**
1. Riders wait at the store. The admin board shows them as *Available*.
2. When an order is *Packed*, the admin clicks **Assign rider**, picks an available rider and hands over the order slip.
3. The customer gets a push notification: "Your order is on the way with *Pemba* 🛵", with a call button.
4. The rider delivers and collects COD if needed, then calls or returns to the store. The admin marks the order *Delivered*.
5. At end of shift, COD cash is reconciled per rider.

**Valid status transitions** (enforced on server):

| From | To |
|---|---|
| PAYMENT_PENDING | PLACED, CANCELLED |
| PLACED | CONFIRMED, CANCELLED |
| CONFIRMED | PACKED, CANCELLED |
| PACKED | OUT_FOR_DELIVERY, CANCELLED |
| OUT_FOR_DELIVERY | DELIVERED, DELIVERY_FAILED |
| DELIVERY_FAILED | OUT_FOR_DELIVERY, CANCELLED |

---

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| **Performance** | Home screen interactive in < 3 s on a ₹8–10k Android phone on 4G. APK < 40 MB. Product images served as WebP, ≤ 100 KB thumbnails (ImageKit URL transforms, `f-auto`). |
| **Network resilience** | Cached catalog (TanStack Query persist), retry with backoff, clear offline banner, idempotent order creation (idempotency key). |
| **Availability** | API uptime ≥ 99.5% during store hours. MongoDB Atlas automated backups. |
| **Security** | HTTPS only. Helmet, CORS, input validation (Zod), no card data stored. Admin routes role-protected. **Auth:** JWT access (15 min) + refresh tokens (30 days customer / 7 days admin) carrying a token version. Logout and "log out everywhere" revoke them, and refresh re-checks the account every time. Phone tokens live in SecureStore (Keychain / Keystore). **Guessing limits:** OTP send 3/10 min per number, 8 wrong OTPs per number per 10 min, 5 wrong admin passwords per email per 15 min (429). **Payments:** Razorpay signature + webhook secret verification, server-decided "paid". **Input:** coordinates range-checked, prices/stock/fees always from the DB, malformed ids or JSON answered with 4xx (never 500). **Concurrency:** atomic stock decrement, idempotent order creation (double taps return the same order), atomic status/rider/cash changes. |
| **Privacy** | Collect only phone, name, addresses, location. Privacy policy in app. Account deletion option (Play Store requirement). |
| **Accessibility** | 48dp touch targets, supports system font scaling, sufficient contrast (see DESIGN.md). |
| **Localization** | All strings in i18n files. Languages: English (launch), Nepali, Hindi. ₹ formatting `en-IN`. Time zone `Asia/Kolkata`. |
| **Observability** | Sentry (app + API + admin), structured logs (pino), basic uptime monitor. |
| **Compliance** | FSSAI registration (food business), GST registration and GST-compliant invoices, Legal Metrology (MRP, net qty on product pages), Play Store policies, Razorpay KYC. |

---

## 8. Tech stack

### 8.1 Summary

| Layer | Choice | Why |
|---|---|---|
| **Mobile app** | **React Native + Expo (latest SDK) + TypeScript** | One codebase for Android and iOS, fast iteration, OTA updates |
| Navigation | **Expo Router** (file-based) | Standard for Expo, deep linking built in |
| Styling | **NativeWind** (Tailwind for RN) | Fast, consistent with design tokens |
| Server state | **TanStack Query** (+ persist to AsyncStorage/MMKV) | Caching, retries, offline-friendly |
| Client state | **Zustand** (cart, selected address, session) | Tiny and simple |
| Forms & validation | **React Hook Form + Zod** | Shared schemas with backend |
| Maps & location | **react-native-maps** + **expo-location** | Address pin, current location |
| Images | **expo-image** | Caching, fast loading |
| Payments | **react-native-razorpay** | UPI/cards/wallets. Needs an **Expo dev build** (not Expo Go). |
| Notifications | **expo-notifications** (Expo Push / FCM) | Order status updates |
| Storage | **react-native-mmkv** or AsyncStorage; **expo-secure-store** for tokens | Fast local cache, secure tokens |
| i18n | **i18next + react-i18next + expo-localization** | EN / NE / HI |
| Icons | **lucide-react-native** | Clean, consistent icon set |
| Realtime | **socket.io-client** | Live order status |
| **Backend API** | **Node.js (LTS) + Express + TypeScript** | Same language as the app, simple |
| Database | **MongoDB Atlas + Mongoose** | Flexible schema, **geospatial queries (`2dsphere`) for the 3 km radius** |
| Validation | **Zod** (shared package) | One source of truth for types |
| Auth | **Phone OTP** via **MSG91** (or Firebase Auth phone) + **JWT** | Cheap Indian SMS, no passwords |
| Realtime | **Socket.io** | Push status changes to customer & admin |
| Payments | **Razorpay** Node SDK + webhooks | Best UPI support in India |
| Media | **ImageKit** (`@imagekit/nodejs` on server) | Image upload, CDN, on-the-fly resize & WebP/AVIF via URL transforms |
| Push | **Expo Server SDK** | Send push to app |
| Jobs/cron | **node-cron** (v1) → BullMQ + Redis (later) | Expire unpaid orders, daily reports |
| Logging | **pino** | Fast structured logs |
| **Admin dashboard** | **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui** | Quick to build good-looking admin UI |
| Admin data | **TanStack Query + TanStack Table**, **Recharts** for reports | Tables & charts |
| **Monorepo** | **pnpm workspaces + Turborepo** | Share types/schemas between app, admin, API |
| **Builds & releases** | **EAS Build + EAS Submit + EAS Update** | Play Store builds and OTA fixes |
| **Hosting** | API: **Render / Railway** (Mumbai/Singapore region) · Admin: **Vercel** · DB: **MongoDB Atlas (Mumbai, ap-south-1)** | Low latency to Sikkim, free/cheap tiers to start |
| **Monitoring** | **Sentry**, UptimeRobot | Crash & error tracking |
| **CI** | **GitHub Actions** (lint, typecheck, test) | Quality gate |
| **Testing** | **Jest + React Native Testing Library**, **Vitest/Jest + Supertest** (API), **mongodb-memory-server** | Unit & integration tests |

### 8.2 Third-party accounts needed
- MongoDB Atlas
- Razorpay (KYC with business PAN, bank account, GST)
- MSG91 (DLT-registered SMS template for OTP, mandatory in India) or Firebase
- ImageKit
- Expo / EAS account
- Google Play Console (one-time $25)
- Google Maps API key (for Android `react-native-maps`)
- Sentry
- Domain name (e.g. chito.in), used for privacy policy and support pages

---

## 9. Data model (MongoDB collections)

All money values are stored as **integer paise** (₹1 = 100). All timestamps are UTC (`createdAt`, `updatedAt` via Mongoose `timestamps`).

| Collection | Key fields | Indexes |
|---|---|---|
| **users** | `phone` (unique), `name`, `role` (`customer`), `language`, `pushTokens[]`, `isBlocked`, `defaultAddressId` | `phone` unique |
| **addresses** | `userId`, `label`, `houseName`, `landmark`, `area`, `directions`, `location` (GeoJSON Point `[lng, lat]`), `distanceKm`, `isServiceable` | `userId`; `location` 2dsphere |
| **stores** | `name`, `location` (GeoJSON Point), `serviceRadiusKm` (3), `isOpen`, `closedMessage`, `hours[]`, `minOrderValue`, `deliveryFeeRules`, `etaConfig`, `supportPhone` | `location` 2dsphere |
| **categories** | `name`, `slug`, `image`, `parentId`, `sortOrder`, `isActive` | `slug` unique; `parentId` |
| **products** | `name`, `altNames[]`, `slug`, `description`, `images[]`, `unit`, `mrp`, `price`, `categoryId`, `tags[]`, `maxPerOrder`, `stock`, `lowStockThreshold`, `hsn`, `gstRate`, `isActive` | text index on `name`+`altNames`; `categoryId`; `slug` unique |
| **carts** | `userId`, `items[{productId, qty}]` | `userId` unique |
| **orders** | `orderNumber` (e.g. CH-000123), `userId`, `items[{productId, name, unit, price, mrp, qty}]` (snapshot), `addressSnapshot`, `distanceKm`, `bill{itemTotal, deliveryFee, smallCartFee, handlingFee, discount, grandTotal}`, `couponCode`, `paymentMethod` (`COD`/`ONLINE`), `paymentStatus`, `status`, `statusHistory[{status, at, by}]`, `riderId`, `deliverySlot`, `instructions`, `rating`, `cancelReason`, `idempotencyKey` | `userId+createdAt`; `status`; `riderId`; `orderNumber` unique; `idempotencyKey` unique |
| **riders** | `name`, `phone`, `photo`, `vehicle`, `status` (`AVAILABLE`/`ON_DELIVERY`/`OFF_DUTY`), `availableSince`, `isActive`, `codBalance` | `status` |
| **payments** | `orderId`, `razorpayOrderId`, `razorpayPaymentId`, `amount`, `status`, `method`, `raw` | `razorpayOrderId` unique |
| **codSettlements** | `riderId`, `orders[]`, `amount`, `settledAt`, `settledBy` | `riderId` |
| **coupons** | `code`, `type`, `value`, `minOrder`, `maxDiscount`, `perUserLimit`, `totalLimit`, `usedCount`, `validFrom`, `validTo`, `firstOrderOnly`, `isActive` | `code` unique |
| **banners** | `image`, `link`, `sortOrder`, `startAt`, `endAt`, `isActive` | — |
| **admins** | `email`, `passwordHash`, `name`, `role` (`OWNER`/`STAFF`) | `email` unique |
| **otps** | `phone`, `codeHash`, `attempts`, `expiresAt` | TTL on `expiresAt` |
| **waitlist** | `phone`, `location`, `area` | `location` 2dsphere |
| **productRequests** | `query`, `userId`, `count` | `query` |

**Serviceability query example:**
```js
// Is this point within 3 km of the store?
db.stores.findOne({
  _id: storeId,
  location: {
    $nearSphere: {
      $geometry: { type: "Point", coordinates: [lng, lat] },
      $maxDistance: store.serviceRadiusKm * 1000,
    },
  },
});
```

---

## 10. API outline (REST, `/api/v1`)

| Group | Endpoints |
|---|---|
| **Auth** | `POST /auth/otp/send` · `POST /auth/otp/verify` · `POST /auth/refresh` · `POST /auth/logout` (ends all sessions of the account) |
| **Me** | `GET /me` · `PATCH /me` · `DELETE /me` · `POST /me/push-token` |
| **Serviceability** | `POST /serviceability/check` `{lat, lng}` → `{serviceable, withinRadius, distanceKm}` · ✅ `POST /geo/resolve` `{text}` (shared WhatsApp/Google Maps location → checked pin) · `POST /waitlist` (later) |
| **Addresses** | `GET/POST /addresses` · `PATCH/DELETE /addresses/:id` |
| **Catalog** | `GET /home` (banners, categories, rows) · `GET /categories` · `GET /categories/:slug/products` · `GET /products/:slug` · `GET /search?q=` |
| **Cart** | `GET /cart` · `PUT /cart` · `POST /cart/validate` (prices, stock, fees, coupon) |
| **Orders** | `POST /orders` (Idempotency-Key header; address may carry `recipientName/recipientPhone`; `returnUrl` for online) · `GET /orders` · `GET /orders/:id` · `POST /orders/:id/cancel` · ✅ `POST /orders/:id/payment/refresh` · `POST /orders/:id/rate` (later) · `GET /orders/:id/invoice` (later) |
| **Payments** | ✅ `GET /payments/razorpay/callback` (signed redirect from the Payment Link) · ✅ `POST /webhooks/razorpay` (`payment_link.paid`, raw-body signature check) |
| **Admin** | `POST /admin/auth/login` · `GET /admin/orders?status=` · `PATCH /admin/orders/:id/status` · `POST /admin/orders/:id/assign-rider` · `POST /admin/orders/:id/cancel` · CRUD `/admin/products`, `/admin/categories` (+ `POST /admin/categories/reorder`), `/admin/riders` · `POST /admin/riders/:id/settle-cod` · `GET/PATCH /admin/store` · `POST /admin/store/open` · ✅ `GET /admin/reports/day?date=` · ✅ `GET /admin/reports/days` · `GET /admin/stats/today` · `GET /admin/customers` · ✅ `POST /admin/customers/:id/logout-everywhere` · `POST /admin/uploads` · later: `/admin/coupons`, `/admin/banners` |
| **Realtime (Socket.io)** | Rooms: `user:{id}`, `order:{id}`, `admin`. Events: `order:new`, `order:updated`, `store:status` |

---

## 11. Release plan

| Phase | Scope | Rough duration |
|---|---|---|
| **Phase 0: Setup** | Monorepo, Expo app skeleton, API skeleton, Atlas, CI, design tokens, store location fixed | 1 week |
| **Phase 1: MVP (soft launch)** | OTP login, serviceability (3 km), addresses, catalog, search, cart, **COD** checkout, order tracking (polling), admin order queue, **manual rider assignment**, catalog & stock management, store settings | 4–6 weeks |
| **Phase 2: Public launch** | **Razorpay UPI/online**, push notifications, Socket.io live updates, coupons, banners, invoices, ratings, Nepali & Hindi, scheduled slots, Play Store release | 3–4 weeks |
| **Phase 3: Growth** | **Rider app** (Expo) with live GPS tracking and self-assignment, loyalty/Chito coins, subscriptions (daily milk), road-distance serviceability (Google Distance Matrix), iOS release, analytics | Ongoing |

**Soft launch plan:** start with friends, family and one or two localities near the store (e.g. Singtam Bazaar), with limited hours. Then expand to the full 3 km.

---

## 12. Risks and open questions

| # | Item | Status |
|---|---|---|
| 1 | **Store location** | ✅ Singtam Bazaar, 737134. Exact pin set by admin in settings. |
| 2 | **Operating hours** | ✅ 6 AM – 10 PM daily (editable by admin) |
| 3 | **Minimum order value**, delivery fee, free-delivery threshold | ✅ Managed by admin in dashboard (seed defaults: ₹99 min, ₹20 fee, free above ₹199) |
| 4 | Number of **riders** at launch and their vehicles | ✅ Managed by admin (rider roster) |
| 5 | Initial **catalog** | ✅ 179 products / 200 images seeded (2 batches). ⚠️ Images are AI-generated demos and prices are estimates. Replace with real photos and prices before public launch. |
| 6 | FSSAI & GST registration, Razorpay KYC timeline | Open |
| 7 | Straight-line 3 km may include places that are far by road (across the river, steep uphill) | Mitigation: admin can mark specific areas/pins as non-serviceable. Future road-distance check. |
| 8 | Monsoon disruptions and landslides | Store-closed switch and message. Scheduled-only mode. |
| 9 | SMS OTP delivery reliability in hills | Fallback: WhatsApp OTP or retry with voice OTP (MSG91 supports both) |
| 10 | Fake/prank COD orders | First-order phone call verification, block users, COD limit for new users |
| 11 | **Real SMS OTP not connected yet** | ⚠️ Test mode: every number logs in with OTP 1234. Needs MSG91 Auth Key + DLT sender/template, then `OTP_DEV_MODE=false` (the server refuses to start in production with it on). |
| 12 | **Map tiles** | ⚠️ The map uses OpenStreetMap's free tiles, which forbid heavy app traffic. Switch to Google Maps (key needed) before launch. |
| 13 | Dev-only switches | `DEV_IGNORE_STORE_HOURS` must be off in production (ignored there; the admin shows a TEST MODE chip while on). The 3 km rule has no switch: it always applies, in test mode too. |
| 14 | Admin login token in browser storage | Move to httpOnly cookies when the admin is deployed on its own domain. |
| 15 | Ending sessions on password change / staff removal | Not possible yet: there is no "change password" or "remove staff" screen. Add both, and make them log the person out everywhere. |
| 16 | Expo Go limits | Returning from Razorpay and the `chito://` link need a development build (`eas build`); in Expo Go the customer may need to tap "Back to Chito". |

---

## 13. Success definition for MVP
Phase 1 is complete when **a real Singtam customer can open the app, confirm they are within 3 km, browse, add to cart, place a COD order, and see it delivered**. The admin must be able to accept the order, pack it and assign a waiting rider from the dashboard, with stock and reports updating correctly.
