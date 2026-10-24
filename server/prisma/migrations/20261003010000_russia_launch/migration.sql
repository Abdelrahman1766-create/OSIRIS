-- Russia launch upgrade. Existing product and order data is retained.
CREATE TYPE "DeliveryMethod" AS ENUM ('KAZAN_COURIER');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH_ON_DELIVERY', 'BANK_TRANSFER');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'AWAITING_TRANSFER', 'PAID', 'FAILED');
CREATE TYPE "PromoType" AS ENUM ('FIXED', 'PERCENTAGE');

CREATE TABLE "CustomerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'ru',
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "preferredChannel" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT,
    "fullName" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Казань',
    "street" TEXT NOT NULL,
    "houseNumber" TEXT NOT NULL,
    "apartment" TEXT,
    "entrance" TEXT,
    "floor" TEXT,
    "deliveryComment" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sizeMl" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "supplierPrice" DECIMAL(12,2) NOT NULL,
    "sellingPrice" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "priceOverride" BOOLEAN NOT NULL DEFAULT false,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProductVariant_sizeMl_check" CHECK ("sizeMl" IN (10, 30, 50, 100))
);

CREATE TABLE "OrderSequence" (
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "OrderSequence_pkey" PRIMARY KEY ("year")
);

CREATE TABLE "DeliverySettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "courierFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "freeThreshold" DECIMAL(12,2),
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeliverySettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "PromoType" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "minimumOrder" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CartItem" ADD COLUMN "variantId" TEXT;
ALTER TABLE "Order" ADD COLUMN "orderNumber" TEXT,
    ADD COLUMN "deliveryFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN "directCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN "deliveryMethod" "DeliveryMethod" NOT NULL DEFAULT 'KAZAN_COURIER',
    ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH_ON_DELIVERY',
    ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    ADD COLUMN "promoCodeId" TEXT,
    ADD COLUMN "promoCodeSnapshot" TEXT;
ALTER TABLE "Order" ALTER COLUMN "currency" SET DEFAULT 'RUB';
ALTER TABLE "OrderItem" ADD COLUMN "variantId" TEXT,
    ADD COLUMN "sizeMl" INTEGER,
    ADD COLUMN "sku" TEXT;

-- Existing listings become one active 50 ml size with their recorded cost, price and stock.
INSERT INTO "ProductVariant" ("id", "productId", "sizeMl", "sku", "supplierPrice", "sellingPrice", "currency", "priceOverride", "stock", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, p."id", 50, 'LEGACY-' || p."id" || '-50',
       p."supplierPrice", p."sellingPrice", 'USD', p."priceOverride", p."stock", true,
       p."createdAt", CURRENT_TIMESTAMP
FROM "Product" p;

UPDATE "CartItem" c SET "variantId" = v."id"
FROM "ProductVariant" v WHERE c."productId" = v."productId" AND v."sizeMl" = 50;
UPDATE "OrderItem" i SET "variantId" = v."id", "sizeMl" = 50, "sku" = v."sku"
FROM "ProductVariant" v WHERE i."productId" = v."productId" AND v."sizeMl" = 50;

-- Historical rows receive stable public numbers using the Kazan calendar year.
WITH numbered AS (
    SELECT "id", EXTRACT(YEAR FROM "createdAt" + INTERVAL '3 hours')::integer AS year,
           ROW_NUMBER() OVER (
               PARTITION BY EXTRACT(YEAR FROM "createdAt" + INTERVAL '3 hours')
               ORDER BY "createdAt", "id"
           ) AS number
    FROM "Order"
)
UPDATE "Order" o SET "orderNumber" = 'RE-' || n.year::text || '-' || LPAD(n.number::text, 5, '0')
FROM numbered n WHERE o."id" = n."id";

INSERT INTO "OrderSequence" ("year", "lastValue")
SELECT EXTRACT(YEAR FROM "createdAt" + INTERVAL '3 hours')::integer, COUNT(*)::integer
FROM "Order" GROUP BY 1;

INSERT INTO "CustomerProfile" ("id", "userId", "phone", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u."id",
       (SELECT o."phone" FROM "Order" o WHERE o."customerId" = u."id" ORDER BY o."createdAt" DESC LIMIT 1),
       u."createdAt", CURRENT_TIMESTAMP
FROM "User" u WHERE u."role" = 'CUSTOMER';

INSERT INTO "DeliverySettings" ("id", "courierFee", "freeThreshold", "isEnabled", "updatedAt")
VALUES ('default', 0, NULL, false, CURRENT_TIMESTAMP);

DROP INDEX "CartItem_userId_productId_key";
CREATE UNIQUE INDEX "CartItem_userId_variantId_key" ON "CartItem"("userId", "variantId");
CREATE UNIQUE INDEX "CustomerProfile_userId_key" ON "CustomerProfile"("userId");
CREATE INDEX "CustomerAddress_userId_idx" ON "CustomerAddress"("userId");
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE INDEX "ProductVariant_productId_isActive_idx" ON "ProductVariant"("productId", "isActive");
CREATE UNIQUE INDEX "ProductVariant_productId_sizeMl_key" ON "ProductVariant"("productId", "sizeMl");
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
