# Seed catalogue

The starting catalogue for Chito: **179 products, 200 images, 24 categories**, built from `blinkit_realistic_products_100.zip` and `blinkit_realistic_products_next_100.zip`.

| File | What |
|---|---|
| `categories.json` | 24 categories (English + Nepali name, sort order; Fruits & Vegetables first) |
| `products.json` | 179 products. `images[]` paths are relative to this folder. Money is in **paise**. |
| `images/<folder>/*.jpg` | 600–700 px packshots, in the zip's original folders (a product's category is set in `products.json`, independent of its folder). Some products have 2–3 images (gallery). |

## How it gets into the app
Product images are **not bundled in the mobile app**. Bundling would bloat the APK, and the admin could not change them. Instead (from `apps/api`):

1. `npm run upload-images` uploads every file in `images/` to **ImageKit** at `/chito/products/<folder>/<file>`. Paths are fixed, so re-running overwrites rather than duplicates.
2. `npm run seed` upserts categories and products into MongoDB by `slug`. Image paths and names are updated; **prices, stock and limits are only set the first time**, so admin edits survive re-runs.
3. The app and admin load products from the API. Prices, stock and visibility are then managed in the admin dashboard.

To add another batch: copy the folders into `images/`, append products to `products.json` (and any new categories to `categories.json`), then run steps 1–2.

## ⚠️ Before public launch
- These images are **AI-generated demo packshots** (per the zip's README). Some have garbled text (e.g. "fortungfoods.com" on the Fortune atta pack). They are fine for development and demos. **Replace them with real photos** (shoot your own stock, or get them from distributors) before going live. Customers must see the real product and the correct net quantity (Legal Metrology).
- `mrp`/`price` values are **rough estimates**. Every product has `needsReview: true`. Set real prices and stock in the admin dashboard.
- Duplicate images (`*-2.jpg`, `fortune-atta-duplicate.jpg`, the three Maggi shots, the three Mother Dairy paneer shots) were merged as extra gallery images of one product.
