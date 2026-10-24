-- Keep historical order numbers intact; update only legacy brand-owned demo data.
UPDATE "Product" SET "brand" = 'OSIRIS' WHERE LOWER("brand") = 'royal essence';
UPDATE "User" SET "name" = 'OSIRIS Partner' WHERE "name" = 'Royal Essence Atelier' AND "role" = 'SUPPLIER';
UPDATE "SupplierProfile" SET "shopName" = 'OSIRIS Partner', "slug" = 'osiris-partner' WHERE "shopName" = 'Royal Essence Atelier' AND "slug" = 'royal-essence-atelier';
