# Chito: Design System, "Gompa" theme

Chito's look is inspired by the **monasteries (gompas) of Sikkim**: Rumtek, Enchey and Phodong. It uses deep maroon robes, gold roof finials, turquoise and lapis painted woodwork, carved arched windows, the five-colour prayer flags strung across the hills, and Kanchenjunga on the horizon.

It must **look and feel nothing like Blinkit**. Blinkit is flat, yellow-and-green, with a left-rail grid. Chito is warm, crafted and local, while staying fast and easy to use on a cheap Android phone.

The logo (yellow tile, black cart and wordmark, green leaf) stays as is. Its yellow becomes our **gold**, and its green becomes our **leaf** success colour.

---

## 1. How Chito differs from Blinkit

| Element | Blinkit | **Chito (Gompa)** |
|---|---|---|
| Background | Flat white / grey | **Parchment** cream (`#FBF4E6`), like thangka paper |
| Header | Flat yellow | **Maroon carved lintel** with a prayer-flag bunting edge and a greeting ("Tashi Delek, Rohan 🙏") |
| Primary colour | Yellow + green | **Monastery maroon + gold**, with turquoise as secondary |
| Product card | Square, flat white | **Arched "gompa window"** image frame, gold hairline border, warm card |
| Add button | Green outline "ADD" | **Maroon "+ Add" pill**, which becomes a maroon stepper with gold numbers |
| Categories | Left rail of flat icons + grid | Left rail of **arched aisle tiles** with a prayer-flag colour edge on the selected aisle + arched product cards |
| Home layout | Grid of tiles + carousels | **"Bazaar shelves"**: product rows resting on a thin carved wooden shelf line |
| Cart access | Full-width green bar | **Raised centre tab "Jhola"** (bag) with gold ring + floating maroon checkout pill |
| Order tracking | Map / plain timeline | **Mountain path**: a winding trail with chorten-shaped milestones and a scooter climbing up |
| Fonts | Generic sans | **Yatra One** (hand-painted signboard feel) + **Mukta** (clean, with full Devanagari) |
| Dividers | Grey lines | **Dentil border** (the carved square pattern under monastery eaves) and small cloud scrolls |

---

## 2. Colour

### 2.1 Core palette
| Token | Hex | Inspired by | Use |
|---|---|---|---|
| `maroon` | `#7B1E28` | Monk robes, temple pillars | **Primary**: header, primary buttons, stepper, selected states |
| `maroon-700` | `#5E141D` | Shadowed wood | Pressed states, status bar |
| `maroon-50` | `#F7E9EA` | — | Selected chip background, soft highlights |
| `gold` | `#FFD60A` | Roof finials, **logo yellow** | Accents on maroon (text, icons, rings), price highlights, CTA on dark |
| `gold-deep` | `#C99700` | Gilded carvings | Hairline borders and ornaments (decorative only, not for text) |
| `gold-50` | `#FFF7D1` | — | Offer strips, banners background |
| `turquoise` | `#0F7C80` | Painted window frames | **Secondary**: links, info, "Out for delivery", toggles |
| `turquoise-50` | `#E3F3F3` | — | Info backgrounds |
| `lapis` | `#22408F` | Lapis pigment in murals | Tags, badges, charts |
| `leaf` | `#2E9E3E` | **Logo leaf** | Success, "Delivered", in stock, savings |
| `leaf-50` | `#EAF7EC` | — | Savings strip |
| `vermilion` | `#D63A2A` | Red flag / pillars | Errors, discount tags, out of stock, cancel |
| `vermilion-50` | `#FCEBE9` | — | Error backgrounds |
| `saffron` | `#E98A15` | Marigold garlands | Warnings ("Closing soon", rain alert) |

### 2.2 Neutrals (warm, never cold grey)
| Token | Hex | Use |
|---|---|---|
| `parchment` | `#FBF4E6` | App background |
| `card` | `#FFFDF7` | Cards, sheets, inputs |
| `sand` | `#F2E8D5` | Section backgrounds, skeleton loaders |
| `line` | `#E8DCC4` | Borders, dividers |
| `wood` | `#5A3A26` | Shelf lines, carved-wood details, dark icons |
| `ink` | `#24150F` | Primary text (warm near-black) |
| `muted` | `#7A6A5E` | Secondary text, units, struck MRP |
| `subtle` | `#A99B8E` | Placeholders, disabled |

### 2.3 Prayer-flag stripe (decorative only)
Traditional order, left to right: **blue `#2563C9` · white `#FFFFFF` · red `#D63A2A` · green `#2E9E3E` · yellow `#FFD60A`** (sky, air/cloud, fire, water, earth).
These colours are used for the bunting edge under the header and to **colour-code category tabs**, cycling through the five.

### 2.4 Dark mode, "Lamp-lit night" (Phase 2)
| Token | Dark |
|---|---|
| `parchment` (bg) | `#17100D` |
| `card` | `#221813` |
| `sand` | `#2E211A` |
| `line` | `#3B2C23` |
| `ink` (text) | `#F6EEDF` |
| `muted` | `#BBA997` |
| `maroon` | `#A8323F` (lifted for contrast) |
| `gold` | `#FFD60A` (unchanged) |
| `turquoise` | `#3FB3B7` |

### 2.5 Contrast rules
- **On maroon:** use `gold` or white text (gold on maroon ≈ 8.7:1 ✅).
- **On gold:** use `ink` or `maroon` text. **Never white on gold.**
- `gold-deep` is too light for text. Use it only for lines and ornaments.
- Body text is `ink` on `parchment`/`card`, and secondary text is `muted` on `parchment` (≈ 4.8:1, AA ✅).

---

## 3. Typography

| Role | Font | Why |
|---|---|---|
| **Display / headings** | **Yatra One** (Google Fonts, 400) | Hand-painted signboard character, like the painted shop signs in Singtam Bazaar and monastery inscriptions. It includes **Devanagari**, so Nepali and Hindi headings match. |
| **Body / UI** | **Mukta** (400 / 500 / 600 / 700) | Very legible at small sizes, designed for Latin + **Devanagari**, so one font family covers English, Nepali and Hindi |
| Numbers (prices) | Mukta 700, tabular figures | Prices line up in carts and bills |

Install with `@expo-google-fonts/yatra-one` and `@expo-google-fonts/mukta` (admin: `next/font/google`).

| Style | Font | Size / LH | Use |
|---|---|---|---|
| `display` | Yatra One | 30 / 38 | Splash greeting, big ETAs ("12 mins") |
| `h1` | Yatra One | 24 / 30 | Screen titles |
| `h2` | Yatra One | 19 / 26 | Section titles ("Daily needs shelf") |
| `h3` | Mukta 700 | 16 / 22 | Card titles, bill total |
| `body` | Mukta 400 | 15 / 22 | Default text (15, not 14: Mukta runs small) |
| `body-strong` | Mukta 600 | 15 / 22 | Product names |
| `price` | Mukta 700 | 16 / 20 | Selling price |
| `caption` | Mukta 400 | 13 / 18 | Units, MRP, timestamps |
| `micro` | Mukta 600 | 11 / 14 | Tags and badges (UPPERCASE allowed here only) |
| `button` | Mukta 700 | 15 / 20 | Buttons (sentence case) |

Yatra One is used **only for headings and big numbers**, never for paragraphs or buttons. Support font scaling up to 1.3×.

---

## 4. Shape, spacing and elevation

### 4.1 The gompa arch
The signature shape is an **arched window**: a rounded top with a small flat "lintel" step at each shoulder. It is used for product image frames, category tiles, banners and empty-state frames.
- In React Native, implement it with `react-native-svg` as a reusable `<ArchFrame>` mask/border, or approximate it with `borderTopLeftRadius`/`borderTopRightRadius = width/2` plus a 2px gold hairline.
- Bottom corners: radius `md` (10).

### 4.2 Radius
| Token | Value | Use |
|---|---|---|
| `sm` | 6 | Tags |
| `md` | 10 | Inputs, buttons, card bottoms |
| `lg` | 16 | Cards, sheets |
| `arch` | 50% of width (top only) | Gompa arch frames |
| `pill` | 999 | Add button, chips, checkout pill |

### 4.3 Spacing
4-pt grid: `4, 8, 12, 16, 20, 24, 32, 40, 48`. Screen padding is **16**, and the gap between cards is **12**. Touch targets are **≥ 48 dp**.

### 4.4 Elevation
Keep it light for low-end phones.
- Cards: 1px `line` border, no shadow.
- Floating checkout pill, raised Jhola tab and bottom sheets: one warm shadow (`0 4 12 rgba(90,58,38,0.18)`, Android `elevation: 6`).

---

## 5. Motifs and ornaments

All motifs are **simple geometric SVGs** (a few KB each) in `apps/mobile/assets/ornaments/`.

| Motif | Where | Notes |
|---|---|---|
| **Prayer-flag bunting** | Bottom edge of the home header, splash, order-placed screen | 5-colour small rectangles on a gently sagging line. Can sway slightly (2°) on the splash screen only. |
| **Dentil border** | Under the header, as section dividers | A row of small `gold-deep` squares on `maroon` or `wood`, like carved eaves |
| **Gompa arch** | Product images, category tiles, banners | See §4.1 |
| **Cloud scroll** | Small ornament beside section titles | Tibetan-style curl, `gold-deep`, 16 px |
| **Wooden shelf line** | Under each home product row | 3px `wood` line with 1px `gold-deep` highlight, like a bazaar shop shelf |
| **Mountain silhouette** | Empty states, order tracking background, out-of-zone screen | Layered Kanchenjunga ridge in `sand` / `line` tones |

### 5.1 Cultural respect (important)
Monasteries and their symbols are sacred to many people in Sikkim. We draw on **architecture, colour and landscape**, not on religious objects.
- ❌ No Buddha, deity, Guru Rinpoche or lama images. No mantras (e.g. "Om Mani Padme Hum") as decoration.
- ❌ Don't use a **prayer wheel**, dharma wheel, butter lamp or the eight auspicious symbols as UI controls (cart button, loader, delete icon, etc.).
- ❌ Never put motifs on discount tags, the trash/delete icon, footwear/toilet-cleaner product areas, or anything "thrown away".
- ✅ Prayer-flag **colours** are fine as a decorative stripe, and they are common across Sikkim's public design.
- ✅ Have the final designs reviewed by a few local people (Bhutia, Lepcha and Nepali community members) before launch.

---

## 6. Iconography and imagery
- **Icons:** `lucide-react-native`, stroke 2, rounded joins, size 22. Colours: `ink` default, `maroon` active, `gold` on maroon.
- **Product images:** 1:1 on white, shown inside the arch frame with a `card` background. Served via ImageKit with auto format (`?tr=w-300,f-auto` for lists, `?tr=w-800,f-auto` for detail).
- **Illustrations:** flat, warm style with Singtam scenes: the Teesta river, hill roads, the bazaar street, a scooter, Kanchenjunga, and prayer flags on a ridge.

---

## 7. Motion
Motion is calm and short, like the slow sway of flags.
- Add → stepper: 150 ms scale.
- Jhola tab: a small **bounce** and the count badge pops when an item is added (200 ms).
- **Loader:** the Chito cart's speed lines pulse (the brand logo, not a sacred object). Use skeletons (`sand` shimmer) for lists.
- Order placed: bunting drops in from the top, then "Order placed!". ≤ 1.5 s.
- Order tracking: the scooter moves along the mountain path to the current milestone.
- Respect the OS **reduce motion** setting (disable sway, bounce and path animation).

---

## 8. Components

### 8.1 Home header ("carved lintel")
```
┌──────────────────────────────────────────────┐  maroon background
│ Tashi Delek, Rohan 🙏                  (👤)  │  Yatra One, gold
│ 🛵 Delivery in 18 mins                       │  Mukta 700, white
│ Home · Near Singtam Hospital ▾               │  caption, white 80%
│ ┌──────────────────────────────────────────┐ │
│ │ 🔍 Search "chiya", "dudh", "Wai Wai"…    │ │  card bg, radius pill
│ └──────────────────────────────────────────┘ │
├▪▫▪▫▪▫▪▫▪▫▪▫▪▫▪▫▪▫▪▫▪▫▪▫▪▫▪▫▪▫▪▫▪▫▪▫▪▫▪▫▪▫▪┤  dentil border (gold-deep)
 ▬ ▬ ▬ ▬ ▬ ▬ ▬ ▬ ▬ ▬ ▬ ▬ ▬ ▬ ▬ ▬ ▬ ▬ ▬ ▬ ▬ ▬    prayer-flag bunting (5 colours)
```
- The greeting alternates between **"Tashi Delek"** and **"Namaste"** (configurable). Use only these two.
- When the store is closed, a saffron strip appears under the bunting: "Closed now · Opens 6:00 AM" (hours 6 AM – 10 PM).

### 8.2 Product card (arched)
```
  ╭──────────────╮
 ╭╯              ╰╮   ← gompa arch, 1.5px gold-deep hairline
 │   (product)    │
 │    image       │
 │ [12% OFF]      │   ← vermilion tag, bottom-left of image
 ├────────────────┤
 │ Amul Taaza Milk│   ← body-strong, 2 lines max
 │ 500 ml         │   ← caption, muted
 │ ₹27  ~₹29~     │   ← price (Mukta 700, maroon) + struck MRP
 │      ( + Add ) │   ← maroon outline pill
 ╰────────────────╯   card bg, radius md bottom
```
- **+ Add pill:** `card` fill, 1.5px `maroon` border, `maroon` text, 36 dp tall (hit area 48).
- **Stepper:** `maroon` fill with `gold` "−  2  +".
- **Out of stock:** image 45% opacity with a `vermilion` "Sold out" ribbon across the arch. The pill becomes "Notify me" (turquoise).

### 8.3 Bazaar shelf (home rows)
A section title (Yatra One h2 + cloud scroll ornament) with "See all ›" in turquoise. Below it, a horizontal row of arched product cards resting on a **wooden shelf line**. Shelves are named in a local tone: "Morning chiya & dudh", "Daily kitchen", "Evening khaja", "Buy again", "Bazaar bestsellers".

### 8.4 Category rail (left side)
Changed on 2026-10-05 at Rohan's request, from top prayer-flag tabs to a left rail, because it's easier to scan on a phone. It keeps the Gompa look:
- An 88 dp rail on `sand`. Each aisle has a small **arched** cover image (52 dp) and a 2-line label (Mukta 12).
- Selected aisle: `card` background, `maroon` bold label, and a 4 dp **prayer-flag colour edge** on the left. The edge colour cycles blue/white/red/green/yellow by position; the white flag uses `goldDeep` so it stays visible.
- To the right is a 2-column grid of arched product cards (3 columns would be too narrow beside the rail).
- The selected aisle lives in the URL (`/categories?cat=…`), so Home tiles open the right aisle and it scrolls into view.

### 8.5 Category tile (home)
Arched tile, `gold-50` or `turquoise-50` tint background, product image, label in Mukta 600 below. 3 per row (bigger and friendlier than Blinkit's 4).

### 8.6 Bottom navigation with the Jhola
```
┌─────────────────────────────────────────────┐
│  🏠        ▦          ( 🛍 3 )        📦     👤 │
│ Home   Categories     Jhola        Orders  Me │
└─────────────────────────────────────────────┘
                 raised maroon circle, 64 dp,
                 2px gold ring, gold bag icon, gold count badge
```
- The **Jhola** (cart, from the cloth bag everyone carries to the bazaar) sits raised in the centre.
- When the cart has items, a **floating checkout pill** appears above the nav. It is maroon with gold text, "3 items · ₹245 · Checkout ›", with an arched left end.

### 8.7 Buttons
| Variant | Style | Use |
|---|---|---|
| Primary | `maroon` bg, `gold` text | Main CTAs ("Place order", "Continue") |
| Gold | `gold` bg, `maroon` text | CTAs on maroon or dark surfaces, "Pay ₹245" |
| Secondary | `card` bg, 1.5px `maroon` border, `maroon` text | "+ Add", "Change address" |
| Turquoise | `turquoise` text (ghost) | Links, "See all", "Notify me" |
| Danger | `vermilion` text/outline | Cancel order |

Height 48, radius `md` (forms) or `pill` (Add, chips). Disabled buttons use `sand` bg with `subtle` text.

### 8.8 Bill summary ("receipt scroll")
A `card` sheet with a **dentil border top and bottom**, like a paper scroll. Rows: Item total, Delivery fee ("FREE" in leaf with the amount struck), Handling fee, Coupon (leaf), dotted divider, then **To pay** (Yatra One 20, maroon). A savings ribbon in `leaf-50` sits at the top: "You saved ₹34 🎉".

### 8.9 Order tracking: mountain path
```
        ⛰ Kanchenjunga silhouette (sand)
                         ▲ Delivered        ○
                    ╱
              ▲ Out for delivery    ● 🛵  ← scooter at current step (gold glow)
          ╱
     ▲ Packed            ✓ 7:42 PM
    ╱
  ▲ Confirmed             ✓ 7:35 PM
  │
  ▲ Placed                ✓ 7:34 PM
```
- Milestones are small **chorten-shaped markers** (simple stepped-triangle silhouettes, no religious detail). They are `leaf` when done, `gold` for current and `line` for upcoming.
- Top of the screen: "Arriving in **12 mins**" (Yatra One display, maroon).
- Rider card (when out for delivery): avatar in an arch frame, "Pemba is on the way 🛵", and a turquoise **Call** button.

### 8.10 Address card and form
- Card: label icon, house name, **landmark in bold**, area, "1.4 km from store", and a badge: leaf "Deliverable" or vermilion "Outside 3 km".
- Form: map at the top with a fixed maroon pin (drag the map). A **3 km circle** is drawn faintly in turquoise. Fields: House/Building, **Landmark (required)**, Area (free text, e.g. Singtam Bazaar, Golitar), Directions note, and Label chips (Home/Work/Other).

### 8.11 Feedback
- **Skeletons:** `sand` shimmer, arch-shaped for product cards.
- **Toasts:** bottom, radius pill. Success `leaf`, error `vermilion`, info `ink`, all with white text.
- **Offline:** an `ink` strip reading "No network. Showing saved items."
- **Empty states:** mountain illustration in an arch frame, an h2 and one CTA. Example for an empty cart: "Your jhola is empty" with "Go to bazaar".

---

## 9. Screens (customer app)

| Screen | Gompa treatment |
|---|---|
| **Splash** | Maroon background with the logo tile centred and a slowly swaying prayer-flag bunting across the top. |
| **Login** | Top half: maroon with mountain silhouette, logo, and the tagline "Sikkim's own quick bazaar" (Yatra One, gold). Bottom sheet (`card`, dentil top edge): "+91" phone input and a primary button. |
| **OTP** | 6 arch-topped boxes, auto-read SMS, 30 s resend, "Get OTP on call". |
| **Location permission** | Illustration of a hill road with a scooter. "Allow location" (primary) and "Enter address manually" (turquoise). |
| **Out of zone** | Mountain illustration: "Chito doesn't reach here yet. We deliver within 3 km of our store." Buttons: "Notify me" and "Try another address". |
| **Home** | Header (8.1) → banner arch carousel → "Shop by category" (3-col arched tiles) → bazaar shelves (8.3) → local specials shelf → footer "Made with ❤️ in Sikkim" with mountain silhouette. |
| **Categories** | Left category rail (8.4) + 2-col arched product grid. |
| **Search** | Auto-focus. Recent/popular chips in `maroon-50`. Results grid. No results: "Request this product". |
| **Product detail** | Large arched image carousel, name (Yatra One h1), unit, price, stepper, details accordion, "Goes well with" shelf. Sticky bottom: gold "Add to jhola". |
| **Jhola (cart)** | ETA card, items with steppers, "Forgot something?" shelf, coupon row, receipt-scroll bill (8.8), delivery instruction chips, address strip, sticky bottom with gold "Pay ₹245" or maroon "Place order (Cash)". |
| **Payment** | Option cards in arch-top frames: **Cash on Delivery** and **UPI / Online (Razorpay)**. Selected card has a 2px maroon border and gold check. |
| **Order placed** | Bunting drops in, then "Order placed! 🎉" (Yatra One) with ETA and "Track order". |
| **Order tracking** | Mountain path (8.9). |
| **Orders** | Cards with a status pill, date, total, "Reorder" and "Rate". |
| **Me (profile)** | Name/phone, Addresses, Language (English / नेपाली / हिन्दी), Notifications, Help (Call / WhatsApp), Terms/Privacy, Logout, Delete account. |

**Tabs:** Home · Categories · **Jhola** (raised centre) · Orders · Me.

---

## 10. Admin dashboard (web)
The same family, tuned for speed at a busy counter.
- **Sidebar:** `maroon` background, gold active item with a small dentil marker, white labels. Items: Orders (live), Riders, Products, Categories, Inventory, Coupons, Banners, Customers, Reports, Settings.
- **Content:** `parchment` background, `card` panels, Yatra One page titles, and Mukta for everything else.
- **Top bar:** a big **Open / Closed** toggle (leaf/vermilion), store hours shown (6 AM – 10 PM), clock, and a sound toggle.
- **Orders board (Kanban):** New / Confirmed / Packing / Ready / Out for delivery / Delivered.
  - Cards show the elapsed timer (leaf < 10 min, saffron 10–20, vermilion > 20), COD/Paid pill, landmark and distance.
  - New cards glow gold for 5 s and a sound plays.
- **Assign rider modal:** "Riders at the store", sorted by longest waiting, with avatars in arch frames. One click assigns.
- **Settings:** store pin map with the 3 km circle, hours, fees, minimum order, and closed message. Fees and minimum order are set by the admin, not hard-coded.
- Built with shadcn/ui, themed via CSS variables from §11.

---

## 11. Tokens (`packages/config/tailwind-preset.js`)
```js
module.exports = {
  theme: {
    extend: {
      colors: {
        maroon: { DEFAULT: '#7B1E28', 700: '#5E141D', 50: '#F7E9EA' },
        gold: { DEFAULT: '#FFD60A', deep: '#C99700', 50: '#FFF7D1' },
        turquoise: { DEFAULT: '#0F7C80', 50: '#E3F3F3' },
        lapis: '#22408F',
        leaf: { DEFAULT: '#2E9E3E', 50: '#EAF7EC' },
        vermilion: { DEFAULT: '#D63A2A', 50: '#FCEBE9' },
        saffron: '#E98A15',
        parchment: '#FBF4E6',
        card: '#FFFDF7',
        sand: '#F2E8D5',
        line: '#E8DCC4',
        wood: '#5A3A26',
        ink: '#24150F',
        muted: '#7A6A5E',
        subtle: '#A99B8E',
        flag: { blue: '#2563C9', white: '#FFFFFF', red: '#D63A2A', green: '#2E9E3E', yellow: '#FFD60A' },
      },
      borderRadius: { sm: '6px', md: '10px', lg: '16px', pill: '999px' },
      fontFamily: {
        display: ['YatraOne_400Regular'],
        body: ['Mukta_400Regular'],
        'body-medium': ['Mukta_500Medium'],
        'body-semibold': ['Mukta_600SemiBold'],
        'body-bold': ['Mukta_700Bold'],
      },
    },
  },
};
```

---

## 12. Voice and copy

**Branding (2026-10-05):** customer-facing taglines say **Sikkim** (e.g. "Sikkim's own quick bazaar", "Made with ❤️ in Sikkim") because Chito plans to expand across Sikkim. Real store facts ("Singtam Bazaar, East Sikkim 737134") and local examples stay. Radius copy says "within 3 km of our store".

- Warm, neighbourly, local. Short sentences.
- Greetings: **"Tashi Delek"** and **"Namaste"** only. Use local words where natural: **jhola** (bag), **chiya** (tea), **dudh** (milk), **khaja** (snacks).
- Examples:
  - "Delivery in 18 mins"
  - "Pemba is on the way 🛵"
  - "Heavy rain in Singtam. We've paused orders for a while. Stay safe 🙏"
  - "Add ₹40 more for free delivery"
  - "We're open 6 AM – 10 PM"
- Nepali and Hindi strings will be written or reviewed by local speakers. Allow ~30% extra width.

---

## 13. Accessibility checklist
- [ ] Touch targets ≥ 48 dp
- [ ] Never white text on gold; only gold or white on maroon
- [ ] Ornaments are decorative (`accessible={false}`), and all icons/images have labels
- [ ] Works at 1.3× font scale (Yatra One headings wrap, never truncate prices)
- [ ] Status shown with text + icon, never colour alone
- [ ] Reduce motion disables sway, bounce and path animation
- [ ] Cart/price changes announced to screen readers

## 14. App icon and splash
- **Icon:** the existing logo (`Chito Fast Grocery Cart Logo.png`), copied to `apps/mobile/assets/icon.png`. Android adaptive icon: foreground = cart + wordmark, background `#FFD60A`.
- **Splash:** `#7B1E28` maroon background with the yellow logo tile centred. The yellow tile on maroon is the brand's signature pairing.
