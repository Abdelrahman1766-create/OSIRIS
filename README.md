# OSIRIS

OSIRIS is a multilingual perfume storefront with customer, supplier, and admin workflows. The customer buys from the OSIRIS brand. Supplier shop names, contacts, costs, SKUs, and fulfillment details stay in authorized supplier and admin APIs.

The storefront uses React, Vite, TypeScript, Tailwind CSS, Framer Motion, React Router, Zustand, and i18next. The mobile ready API uses Express, TypeScript, PostgreSQL, Prisma, JWT, bcrypt, Zod, Helmet, and rate limits.

## Current business flow

- Russian is the default language. English and Arabic are available; Arabic changes the document to RTL. Customer prices and new orders use RUB.
- Perfumes have configurable 10, 30, 50, and 100 ml variants, each with a supplier cost, selling price, stock, SKU, and active flag. Only active RUB variants appear in the customer catalog.
- Checkout supports courier delivery in Kazan, cash on delivery, and bank transfer after confirmation. Pickup and other cities are displayed as future options. No online payment is simulated.
- Courier delivery starts **disabled**. An admin must set the delivery fee and optional free delivery threshold, then enable it before customers can place orders.
- Admins configure fixed or percentage commission, delivery, promo codes, product variants, order payment status, direct costs, reviews, suppliers, and users. Dashboard figures for today and this month use Kazan time and count revenue and profit when orders are delivered.
- New orders receive a public number such as `RE-2026-00001`; existing `OS-` numbers remain valid for tracking. Customers retrieve only their own orders by number. The admin confirms an order; the assigned supplier then marks its items preparing, shipping, and delivered.
- WhatsApp and Telegram links use public environment settings. If a contact is unconfigured, its link is hidden. The finder and marketing draft routes currently use deterministic rules/templates and require no AI provider.

## Local installation

Use Node.js, npm, and PostgreSQL. A PostgreSQL 16 Docker Compose service is included. Run these commands from the repository root in PowerShell:

```powershell
npm install
npm install --prefix server
Copy-Item .env.example .env
# Set POSTGRES_PASSWORD in .env before starting PostgreSQL.
docker compose up -d postgres
Copy-Item server/.env.example server/.env
```

Edit the root `.env` and set a private `POSTGRES_PASSWORD`. Edit `server/.env`: put the same password into `DATABASE_URL`, set a strong `JWT_SECRET` (at least 32 characters), `ADMIN_EMAIL`, and `ADMIN_PASSWORD`. Set `DEMO_SUPPLIER_PASSWORD` if you need access to the catalog partner account.

```powershell
npm run db:deploy
npm run db:seed
npm run dev:api
```

In a second terminal:

```powershell
npm run dev
```

Open `http://127.0.0.1:5173`. The API health endpoint is `http://127.0.0.1:4000/api/v1/health`. Vite and Express bind explicitly to the IPv4 loopback address, and Vite proxies relative `/api` requests to the API on that address. This keeps local development independent of VPN DNS handling. `http://localhost:5173` is also allowed by CORS for compatibility. The UI can show a sample catalog when the API is unavailable; registration, cart sync, promo validation, and checkout need the API and database. Sign in as the seeded admin and configure **Delivery** before testing checkout.

## Configuration

| Variable | File | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | root `.env` | API base, `/api/v1` locally or an absolute deployed URL ending in `/api/v1` |
| `VITE_SITE_URL` | root `.env` | Public storefront origin for canonical and social URLs and sitemap generation |
| `SITEMAP_API_URL` | build environment | Optional absolute API base for adding published product URLs to the sitemap at build time |
| `VITE_WHATSAPP_NUMBER` | root `.env` | Public international WhatsApp number, digits only |
| `VITE_TELEGRAM_USERNAME` | root `.env` | Public Telegram username without `@` |
| `VITE_MAX_CONTACT_URL` | root `.env` | Full public MAX profile or contact URL |
| `VITE_INSTAGRAM_URL` | root `.env` | Optional public brand Instagram URL |
| `DATABASE_URL` | `server/.env` | PostgreSQL connection string |
| `JWT_SECRET` | `server/.env` | JWT signing secret of at least 32 characters |
| `CLIENT_ORIGINS` | `server/.env` | Comma separated allowed storefront origins |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | `server/.env` | Owner account created by the seed command |
| `DEMO_SUPPLIER_EMAIL`, `DEMO_SUPPLIER_PASSWORD` | `server/.env` | Optional catalog partner credentials |
| `PUBLIC_API_ORIGIN` | `server/.env` | Optional public API origin for local upload URLs behind a proxy |
| `S3_BUCKET`, `AWS_REGION`, `S3_ENDPOINT`, `S3_PUBLIC_BASE_URL` | `server/.env` | Persistent S3 compatible product image storage |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | deployment secrets | Storage credentials when no instance role is available |

`src/config/contact.ts` reads the public contact variables. Do not place private credentials in any `VITE_` variable; Vite embeds them in the browser bundle.

## Database upgrade

`server/prisma/migrations/20261003010000_russia_launch` adds variants, customer profiles, delivery settings, promo codes, and public order numbers without dropping users, products, or orders. Existing product prices are retained in a 50 ml **USD** variant and are hidden from the new RUB storefront until an authorized supplier or admin enters both a new RUB supplier cost and selling price. Historical orders retain their recorded currency and receive a stable public order number. Back up a production database before applying any migration.

`server/prisma/migrations/20261003020000_osiris_brand` updates legacy brand-owned product and demo partner labels. Existing sessions and earlier order numbers remain valid. The storefront migrates saved language, cart, and token keys on first use.

The catalog seed disables the eight retired demo listings, syncs the nine real perfumes, and leaves Pyramids unpublished. The other eight are visible as previews until real supplier costs, selling prices, and stock are configured in Admin. It does not reset an existing admin password. Courier delivery remains disabled until configured by the admin.

## Verification

```powershell
npm run build
npm run build:api
npm run lint
npm run check:i18n
```

The build creates `dist/robots.txt`; it creates `dist/sitemap.xml` when `VITE_SITE_URL` is set. With a reachable absolute `SITEMAP_API_URL`, the sitemap also includes published product URLs. Browser metadata and product structured data use the same site origin.

For a seeded local database and running API, `node qa/api-smoke.mjs` exercises registration, roles, public response privacy, admin variant stock, favorites, cart, promo usage, checkout, order ownership, admin confirmation, supplier fulfillment, and customer tracking. It creates QA customer/order records and restores courier delivery to disabled. With both dev servers running, `node qa/browser-check.mjs` checks key pages at 320, 375, 390, 430, 768, and 1440 pixels; `node qa/dashboard-check.mjs` checks every admin tab and the supplier size editor at 390 pixels. These browser scripts also create test accounts. The `qa/*.png` screenshots are ignored by Git.

`node qa/customer-flow.mjs` drives a real Russian browser session from registration through the homepage, 30 ml product selection, cart, checkout, confirmation, and delivered tracking. It temporarily enables courier delivery, restores the previous setting, and leaves a QA order in the local database. `node qa/home-visual-check.mjs` captures the homepage at mobile and desktop widths in all three languages. Start both dev servers before these scripts.

On Windows, stop a running API before `npm run build:api`; the Prisma engine DLL can be locked by the running process.

## Deployment

1. Create a managed PostgreSQL database and persistent S3 compatible image bucket. Back up any existing database before applying migrations.
2. Deploy `server` to Railway or Render. Set `DATABASE_URL`, a strong `JWT_SECRET`, `CLIENT_ORIGINS` with the exact HTTPS storefront origin, admin credentials, and storage settings. From `server`, run `npm ci`, `npm run build`, `npm run db:deploy`, then `npm start`. Run `npm run db:seed` to sync the real catalog and disable the retired demo listings.
3. Deploy the repository root to Vercel with `npm ci`, `npm run build`, and output directory `dist`. Set `VITE_API_URL` to the public backend URL ending in `/api/v1`, `VITE_SITE_URL` to the HTTPS storefront origin, `SITEMAP_API_URL` to the same public API base, and public contact variables. `vercel.json` rewrites client routes to the SPA.
4. In Admin, approve real partners and catalog entries, set every live RUB variant price and stock, configure Kazan courier fees, and enable delivery. Verify an order with the production domain, customer account, owner, and partner before opening the site to customers.

Before a commercial launch, enter verified prices and stock for the real products, confirm rights to the supplied product assets, provide real WhatsApp and Telegram contacts, finalize courier pricing and fulfillment, and review privacy, consent, and operational policies. The current payment methods are manual; an online provider and automated customer email/SMS notifications are future integrations. The AI routes are provider independent preparation.

See [server/README.md](server/README.md) for API route details.
