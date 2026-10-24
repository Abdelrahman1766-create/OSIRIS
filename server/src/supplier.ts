import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Router } from 'express';
import multer from 'multer';
import { OrderStatus, Prisma, type SupplierProfile } from '@prisma/client';
import { z } from 'zod';
import { requireAuth, requireRole } from './auth.js';
import { config } from './config.js';
import { refreshProductSummary } from './commerce.js';
import { prisma } from './db.js';
import { HttpError, parseId } from './http.js';

export const uploadsDir = path.resolve(process.cwd(), 'uploads');
const allowedMime = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'], ['image/avif', 'avif']]);
function matchesImageSignature(mime: string, bytes: Buffer) {
  if (mime === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === 'image/webp') return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (mime === 'image/avif') return bytes.toString('ascii', 4, 8) === 'ftyp' && ['avif', 'avis'].includes(bytes.toString('ascii', 8, 12));
  return false;
}
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, allowedMime.has(file.mimetype)),
});

const imageUrl = z.string().url().refine((value) => /^https?:\/\//i.test(value), 'Image must use HTTP or HTTPS');
const variantSchema = z.object({
  sizeMl: z.union([z.literal(12), z.literal(17), z.literal(20), z.literal(35), z.literal(55), z.literal(100)]),
  sku: z.string().trim().min(3).max(100).regex(/^[A-Za-z0-9._-]+$/).optional(),
  supplierPrice: z.number().positive().max(1000000),
  sellingPrice: z.number().positive().max(1000000).optional(),
  stock: z.number().int().min(0).max(100000),
  isActive: z.boolean().default(true),
}).refine((value) => value.sellingPrice === undefined || value.sellingPrice >= value.supplierPrice, 'Selling price must cover supplier cost');
const variantUpdateSchema = z.object({
  sku: z.string().trim().min(3).max(100).regex(/^[A-Za-z0-9._-]+$/).optional(),
  currency: z.literal('RUB').optional(),
  supplierPrice: z.number().positive().max(1000000).optional(),
  sellingPrice: z.number().positive().max(1000000).optional(),
  stock: z.number().int().min(0).max(100000).optional(),
  isActive: z.boolean().optional(),
});
const productBaseSchema = z.object({
  slug: z.string().trim().min(3).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  nameEn: z.string().trim().min(2).max(160),
  nameAr: z.string().trim().min(2).max(160),
  nameRu: z.string().trim().min(2).max(160),
  descriptionEn: z.string().trim().min(10).max(5000),
  descriptionAr: z.string().trim().min(10).max(5000),
  descriptionRu: z.string().trim().min(10).max(5000),
  brand: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(100),
  gender: z.enum(['MEN', 'WOMEN', 'UNISEX']),
  topNotes: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  topNotesAr: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  topNotesRu: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  middleNotes: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  middleNotesAr: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  middleNotesRu: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  baseNotes: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  baseNotesAr: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  baseNotesRu: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  mainImage: imageUrl,
  images: z.array(imageUrl).max(12).default([]),
  supplierPrice: z.number().positive().max(1000000).optional(),
  stock: z.number().int().min(0).max(100000).optional(),
  variants: z.array(variantSchema).min(1).max(6).optional(),
  isPublished: z.boolean().optional(),
});
const productSchema = productBaseSchema.refine((value) => Boolean(value.variants?.length || (value.supplierPrice !== undefined && value.stock !== undefined)), 'At least one size or legacy supplierPrice and stock is required');
const productUpdateSchema = productBaseSchema.partial().omit({ slug: true, variants: true });
const profileSchema = z.object({
  shopName: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  contactEmail: z.string().email().max(320).nullable().optional(),
  contactPhone: z.string().trim().max(40).nullable().optional(),
});

export async function supplierFor(userId: string): Promise<SupplierProfile> {
  const supplier = await prisma.supplierProfile.findUnique({ where: { userId } });
  if (!supplier) throw new HttpError(403, 'Supplier profile required', 'FORBIDDEN');
  return supplier;
}

export async function sellingPriceFor(supplierPrice: Prisma.Decimal) {
  const settings = await prisma.commissionSettings.findUnique({ where: { id: 'default' } });
  const type = settings?.type ?? 'PERCENTAGE';
  const value = settings?.value ?? new Prisma.Decimal(30);
  const markup = type === 'FIXED' ? value : supplierPrice.mul(value).div(100);
  return supplierPrice.add(markup).toDecimalPlaces(2);
}

function slugify(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 75) || 'perfume';
}

export const supplierRouter = Router();
supplierRouter.use(requireAuth, requireRole('SUPPLIER'));

supplierRouter.get('/profile', async (req, res) => {
  res.json(await supplierFor(req.auth!.id));
});

supplierRouter.patch('/profile', async (req, res) => {
  const body = profileSchema.parse(req.body);
  const supplier = await supplierFor(req.auth!.id);
  const updated = await prisma.supplierProfile.update({ where: { id: supplier.id }, data: body });
  res.json(updated);
});

supplierRouter.post('/uploads', upload.single('image'), async (req, res) => {
  await supplierFor(req.auth!.id);
  if (!req.file) throw new HttpError(422, 'Upload a JPEG, PNG, WebP, or AVIF image (max 5 MB)');
  if (!matchesImageSignature(req.file.mimetype, req.file.buffer)) throw new HttpError(422, 'Image file contents do not match its format');
  const extension = allowedMime.get(req.file.mimetype)!;
  const key = `products/${randomUUID()}.${extension}`;
  let url: string;
  if (config.S3_BUCKET) {
    if (!config.S3_PUBLIC_BASE_URL || !config.AWS_REGION) throw new HttpError(503, 'Image storage is not configured');
    const client = new S3Client({ region: config.AWS_REGION, ...(config.S3_ENDPOINT && { endpoint: config.S3_ENDPOINT, forcePathStyle: true }) });
    await client.send(new PutObjectCommand({ Bucket: config.S3_BUCKET, Key: key, Body: req.file.buffer, ContentType: req.file.mimetype }));
    url = `${config.S3_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`;
  } else {
    const destination = path.join(uploadsDir, key);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, req.file.buffer);
    const origin = config.PUBLIC_API_ORIGIN ?? `${req.protocol}://${req.get('host')}`;
    url = `${origin.replace(/\/$/, '')}/uploads/${key}`;
  }
  res.status(201).json({ url, key });
});

supplierRouter.get('/products', async (req, res) => {
  const supplier = await supplierFor(req.auth!.id);
  const products = await prisma.product.findMany({ where: { supplierId: supplier.id }, include: { variants: { orderBy: { sizeMl: 'asc' } } }, orderBy: { createdAt: 'desc' } });
  res.json(products.map((product) => ({
    ...product, supplierPrice: Number(product.supplierPrice), sellingPrice: Number(product.sellingPrice),
    variants: product.variants.map((variant) => ({ ...variant, supplierPrice: Number(variant.supplierPrice), sellingPrice: Number(variant.sellingPrice) })),
  })));
});

supplierRouter.post('/products', async (req, res) => {
  const body = productSchema.parse(req.body);
  const supplier = await supplierFor(req.auth!.id);
  const { variants, supplierPrice: legacyCost, stock: legacyStock, ...details } = body;
  const slug = body.slug ?? `${slugify(body.nameEn)}-${randomUUID().slice(0, 8)}`;
  const inputVariants = variants ?? [{ sizeMl: 55 as const, supplierPrice: legacyCost!, stock: legacyStock!, isActive: true }];
  if (new Set(inputVariants.map((variant) => variant.sizeMl)).size !== inputVariants.length) throw new HttpError(422, 'Each bottle size may appear only once');
  const priced = await Promise.all(inputVariants.map(async (variant) => {
    const cost = new Prisma.Decimal(variant.supplierPrice);
    return {
      sizeMl: variant.sizeMl, sku: variant.sku ?? `${slug}-${variant.sizeMl}`,
      supplierPrice: cost, sellingPrice: variant.sellingPrice === undefined ? await sellingPriceFor(cost) : new Prisma.Decimal(variant.sellingPrice),
      priceOverride: variant.sellingPrice !== undefined, stock: variant.stock, isActive: variant.isActive,
    };
  }));
  const active = priced.filter((variant) => variant.isActive).sort((a, b) => a.sellingPrice.cmp(b.sellingPrice));
  const cheapest = active[0] ?? priced[0]!;
  const product = await prisma.product.create({
    data: {
      ...details, slug, supplierId: supplier.id,
      supplierPrice: cheapest.supplierPrice, sellingPrice: cheapest.sellingPrice,
      stock: active.reduce((sum, variant) => sum + variant.stock, 0),
      isPublished: Boolean(body.isPublished && supplier.isApproved && active.length),
      variants: { create: priced },
    }, include: { variants: { orderBy: { sizeMl: 'asc' } } },
  });
  res.status(201).json({ ...product, supplierPrice: Number(product.supplierPrice), sellingPrice: Number(product.sellingPrice), variants: product.variants.map((variant) => ({ ...variant, supplierPrice: Number(variant.supplierPrice), sellingPrice: Number(variant.sellingPrice) })) });
});

supplierRouter.patch('/products/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const body = productUpdateSchema.parse(req.body);
  const supplier = await supplierFor(req.auth!.id);
  const existing = await prisma.product.findFirst({ where: { id, supplierId: supplier.id }, include: { variants: true } });
  if (!existing) throw new HttpError(404, 'Product not found', 'NOT_FOUND');
  const { supplierPrice: legacyCost, stock: legacyStock, ...details } = body;
  const product = await prisma.$transaction(async (tx) => {
    if (legacyCost !== undefined || legacyStock !== undefined) {
      const variant = existing.variants.find((item) => item.sizeMl === 55);
      if (!variant) throw new HttpError(422, 'Edit a specific variant to change size pricing or stock');
      const cost = legacyCost !== undefined ? new Prisma.Decimal(legacyCost) : variant.supplierPrice;
      if (variant.priceOverride && cost.gt(variant.sellingPrice)) throw new HttpError(409, 'Supplier cost exceeds selling price', 'PRICE_CONFLICT');
      await tx.productVariant.update({ where: { id: variant.id }, data: {
        supplierPrice: cost, stock: legacyStock,
        ...(!variant.priceOverride && { sellingPrice: await sellingPriceFor(cost) }),
      } });
    }
    await tx.product.update({ where: { id }, data: {
      ...details,
      ...(body.isPublished !== undefined && { isPublished: body.isPublished && supplier.isApproved && existing.variants.some((variant) => variant.isActive) }),
    } });
    await refreshProductSummary(tx, id);
    return tx.product.findUniqueOrThrow({ where: { id }, include: { variants: { orderBy: { sizeMl: 'asc' } } } });
  });
  res.json({ ...product, supplierPrice: Number(product.supplierPrice), sellingPrice: Number(product.sellingPrice), variants: product.variants.map((variant) => ({ ...variant, supplierPrice: Number(variant.supplierPrice), sellingPrice: Number(variant.sellingPrice) })) });
});

supplierRouter.post('/products/:id/variants', async (req, res) => {
  const productId = parseId(req.params.id);
  const body = variantSchema.parse(req.body);
  const supplier = await supplierFor(req.auth!.id);
  const product = await prisma.product.findFirst({ where: { id: productId, supplierId: supplier.id } });
  if (!product) throw new HttpError(404, 'Product not found', 'NOT_FOUND');
  const cost = new Prisma.Decimal(body.supplierPrice);
  const variant = await prisma.$transaction(async (tx) => {
    const created = await tx.productVariant.create({ data: {
      productId, sizeMl: body.sizeMl, sku: body.sku ?? `${product.slug}-${body.sizeMl}`,
      supplierPrice: cost, sellingPrice: body.sellingPrice === undefined ? await sellingPriceFor(cost) : new Prisma.Decimal(body.sellingPrice),
      priceOverride: body.sellingPrice !== undefined, stock: body.stock, isActive: body.isActive,
    } });
    await refreshProductSummary(tx, productId);
    return created;
  });
  res.status(201).json({ ...variant, supplierPrice: Number(variant.supplierPrice), sellingPrice: Number(variant.sellingPrice) });
});

supplierRouter.patch('/variants/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const body = variantUpdateSchema.parse(req.body);
  const supplier = await supplierFor(req.auth!.id);
  const variant = await prisma.productVariant.findFirst({ where: { id, product: { supplierId: supplier.id } } });
  if (!variant) throw new HttpError(404, 'Variant not found', 'NOT_FOUND');
  if (variant.currency !== 'RUB' && body.currency === 'RUB' && (body.supplierPrice === undefined || body.sellingPrice === undefined)) {
    throw new HttpError(422, 'Set both RUB supplier cost and selling price when converting a legacy size');
  }
  const cost = body.supplierPrice === undefined ? variant.supplierPrice : new Prisma.Decimal(body.supplierPrice);
  const price = body.sellingPrice !== undefined ? new Prisma.Decimal(body.sellingPrice)
    : variant.priceOverride ? variant.sellingPrice : await sellingPriceFor(cost);
  if (price.lt(cost)) throw new HttpError(422, 'Selling price must cover supplier cost');
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.productVariant.update({ where: { id }, data: {
      ...body, supplierPrice: cost, sellingPrice: price,
      ...(body.sellingPrice !== undefined && { priceOverride: true }),
    } });
    await refreshProductSummary(tx, variant.productId);
    return result;
  });
  res.json({ ...updated, supplierPrice: Number(updated.supplierPrice), sellingPrice: Number(updated.sellingPrice) });
});

supplierRouter.delete('/variants/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const supplier = await supplierFor(req.auth!.id);
  const variant = await prisma.productVariant.findFirst({ where: { id, product: { supplierId: supplier.id } } });
  if (!variant) throw new HttpError(404, 'Variant not found', 'NOT_FOUND');
  await prisma.$transaction(async (tx) => {
    await tx.productVariant.update({ where: { id }, data: { isActive: false } });
    await refreshProductSummary(tx, variant.productId);
  });
  res.status(204).end();
});

supplierRouter.delete('/products/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const supplier = await supplierFor(req.auth!.id);
  const result = await prisma.product.updateMany({ where: { id, supplierId: supplier.id }, data: { isPublished: false } });
  if (!result.count) throw new HttpError(404, 'Product not found', 'NOT_FOUND');
  res.status(204).end();
});

supplierRouter.get('/orders', async (req, res) => {
  const supplier = await supplierFor(req.auth!.id);
  const items = await prisma.orderItem.findMany({
    where: { supplierId: supplier.id, status: { not: 'PENDING' } },
    include: { order: { select: { id: true, orderNumber: true, status: true, shippingAddress: true, phone: true, note: true, paymentMethod: true, paymentStatus: true, createdAt: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(items.map((item) => ({
    ...item,
    unitPrice: Number(item.unitPrice),
    supplierUnitPrice: Number(item.supplierUnitPrice),
    platformProfit: undefined,
  })));
});

supplierRouter.patch('/order-items/:id/status', async (req, res) => {
  const id = parseId(req.params.id);
  const { status } = z.object({ status: z.enum(['PREPARING', 'SHIPPING', 'DELIVERED']) }).parse(req.body);
  const supplier = await supplierFor(req.auth!.id);
  const next: Record<string, OrderStatus> = { CONFIRMED: 'PREPARING', PREPARING: 'SHIPPING', SHIPPING: 'DELIVERED' };
  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.orderItem.findFirst({ where: { id, supplierId: supplier.id }, include: { order: true } });
    if (!item) throw new HttpError(404, 'Order item not found', 'NOT_FOUND');
    if (item.order.status === 'CANCELLED' || next[item.status] !== status) throw new HttpError(409, 'Invalid status transition', 'INVALID_STATUS');
    const changed = await tx.orderItem.updateMany({ where: { id, status: item.status }, data: { status } });
    if (!changed.count) throw new HttpError(409, 'Order status changed. Please retry.', 'ORDER_CONFLICT');
    const all = await tx.orderItem.findMany({ where: { orderId: item.orderId }, select: { status: true } });
    const statuses = all.map((row) => row.status);
    const aggregate: OrderStatus = statuses.every((value) => value === 'DELIVERED') ? 'DELIVERED'
      : statuses.some((value) => value === 'SHIPPING' || value === 'DELIVERED') ? 'SHIPPING'
      : statuses.some((value) => value === 'PREPARING') ? 'PREPARING'
      : 'CONFIRMED';
    if (aggregate !== item.order.status) {
      await tx.order.update({ where: { id: item.orderId }, data: { status: aggregate } });
      await tx.orderStatusEvent.create({ data: { orderId: item.orderId, actorId: req.auth!.id, fromStatus: item.order.status, toStatus: aggregate } });
    }
    return { id, orderId: item.orderId, status, orderStatus: aggregate };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json(result);
});

supplierRouter.get('/stats', async (req, res) => {
  const supplier = await supplierFor(req.auth!.id);
  const [productCount, activeOrderItems, delivered] = await Promise.all([
    prisma.product.count({ where: { supplierId: supplier.id } }),
    prisma.orderItem.count({ where: { supplierId: supplier.id, status: { in: ['CONFIRMED', 'PREPARING', 'SHIPPING'] } } }),
    prisma.orderItem.findMany({ where: { supplierId: supplier.id, status: 'DELIVERED' }, select: { supplierUnitPrice: true, quantity: true } }),
  ]);
  const sales = delivered.reduce((sum, item) => sum + Number(item.supplierUnitPrice) * item.quantity, 0);
  res.json({ productCount, activeOrderItems, deliveredOrderItems: delivered.length, sales });
});
