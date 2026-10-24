# OSIRIS API

Express 5, TypeScript, Prisma, PostgreSQL, and JWT. All routes have the `/api/v1` prefix. This JSON API is independent of the React client and can serve a future mobile application.

## Start locally

From the repository root, copy `.env.example` to `.env`, set a private `POSTGRES_PASSWORD`, then start PostgreSQL with `docker compose up -d postgres`. Copy `server/.env.example` to `server/.env`, put the same password into `DATABASE_URL`, set `JWT_SECRET` (at least 32 characters), `ADMIN_EMAIL`, and `ADMIN_PASSWORD`, then run:

```powershell
npm install --prefix server
npm run db:deploy
npm run db:seed
npm run dev:api
```

The health route is `GET /api/v1/health`. The seed is idempotent and does not reset an existing admin password. Set `SEED_DEMO_DATA=true` only in a demo environment. Courier delivery remains disabled until an admin explicitly configures it.

## Authentication and access

`POST /auth/register`, `POST /auth/register-supplier`, and `POST /auth/login` return a JWT and account summary. `GET /auth/me` requires `Authorization: Bearer <token>`. Supplier registrations require admin approval. Protected routes recheck account status and role in the database on every request. Passwords use bcrypt hashing. Request bodies are checked with Zod; the API uses Helmet, CORS allowlisting, and rate limits.

## Main routes

| Access | Routes |
| --- | --- |
| Public | `GET /products`, `/products/:slug`, `/categories`, `/products/:id/reviews`, `/delivery/options`; `POST /ai/recommendations` |
| Customer | `GET/POST /favorites`, `DELETE /favorites/:productId`; `GET/POST /cart`, `PATCH/DELETE /cart/:variantId`; `POST /promos/validate`; `POST/GET /orders`, `GET /orders/:orderNumber`; profile and address CRUD; `POST /products/:id/reviews` |
| Supplier | `GET/PATCH /supplier/profile`; `POST /supplier/uploads`; `GET/POST/PATCH /supplier/products`; `POST /supplier/products/:id/variants`; `PATCH/DELETE /supplier/variants/:id`; `GET /supplier/orders`; `PATCH /supplier/order-items/:id/status`; `GET /supplier/stats` |
| Admin | `/admin/stats`, `/admin/business-stats`, `/admin/customers`, `/admin/users`, `/admin/suppliers`, `/admin/products`, `/admin/variants`, `/admin/orders`, `/admin/reviews`, `/admin/promos`, `/admin/delivery`, `/admin/commission`; `POST /ai/marketing/draft` |

The public catalog includes only published perfumes from approved suppliers with active **RUB** variants. Public responses use the OSIRIS brand and omit supplier identity, supplier cost, SKU, and platform profit. Customer order responses omit supplier information and internal UUIDs. Admins can see the internal fulfillment and financial fields. A supplier can see only its own products and its assigned order items after admin confirmation.

## Checkout contract

`POST /orders` requires a customer JWT. A typical request is:

```json
{
  "items": [{ "variantId": "<variant UUID>", "quantity": 1 }],
  "shippingAddress": { "fullName": "Customer", "city": "Казань", "street": "Баумана", "houseNumber": "1", "apartment": "2" },
  "phone": "+79990000000",
  "deliveryMethod": "KAZAN_COURIER",
  "paymentMethod": "CASH_ON_DELIVERY",
  "promoCode": "WELCOME10",
  "clientRequestId": "<new request UUID>"
}
```

`items` may be omitted to use the saved cart. Optional address fields are `entrance`, `floor`, and `deliveryComment`. Payment methods are `CASH_ON_DELIVERY` and `BANK_TRANSFER`; no online charge occurs. The server recalculates prices, validates the promo code, computes the configured delivery fee, reserves variant stock, claims promo usage, and creates the order in a serializable transaction. A repeated `clientRequestId` returns the same order. New orders use a public `orderNumber` such as `RE-2026-00001`; existing `OS-` numbers remain valid. The customer retrieves it at `GET /orders/:orderNumber` only when they own it.

The admin moves a pending order to `CONFIRMED`. The assigned supplier advances its items through `PREPARING`, `SHIPPING`, and `DELIVERED`; the order status follows the items. Cancellation before shipment restores stock and promo availability. Profit is the merchandise selling price minus supplier cost, promo discount, and any direct cost recorded by the admin. Delivery fees are tracked separately. Dashboard revenue and profit are recognized on delivery events in Europe/Moscow time.

## Products and migration

Supplier products require names and descriptions in Russian, English, and Arabic, category, gender, images, and at least one size variant. Supported sizes are 10, 30, 50, and 100 ml. Each variant has its own cost, price, stock, SKU, currency, and active flag. The commission setting calculates a selling price when a supplier does not supply an explicit override.

The additive `20261003010000_russia_launch` migration preserves existing products and orders. Old product prices become 50 ml USD variants, excluded from the RUB storefront until both RUB cost and selling price are entered. Historical order currency remains unchanged; historical orders receive public order numbers. Make a database backup before applying the migration to live data.

The additive `20261003020000_osiris_brand` migration updates legacy brand-owned product and demo partner labels. Earlier order numbers remain valid. JWT verification accepts legacy sessions during the rebrand.

Suppliers upload JPEG, PNG, WebP, or AVIF images (up to 5 MB) with multipart field `image` at `POST /supplier/uploads`. Local `server/uploads` is for development. Configure an S3 compatible bucket and public image base URL for deployment. Upload object keys are generated without shop identifiers.

## AI and CRM seams

`POST /ai/recommendations` runs deterministic fragrance rules from a seven answer questionnaire. `POST /ai/marketing/draft` is admin only and returns a template draft. Customer profile fields include phone, preferred language/channel, and marketing consent for future CRM integration. No AI provider or outbound campaign provider is connected.
