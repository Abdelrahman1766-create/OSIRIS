-- New catalog and API writes use 12/17/20/35/55/100 ml.
-- Legacy values remain valid at the database layer for disabled historical products
-- whose variants are still referenced by existing order records.
ALTER TABLE "ProductVariant"
  DROP CONSTRAINT IF EXISTS "ProductVariant_sizeMl_check";

ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_sizeMl_check"
  CHECK ("sizeMl" IN (10, 12, 17, 20, 30, 35, 50, 55, 100));
