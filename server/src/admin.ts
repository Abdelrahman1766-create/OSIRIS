import { Router } from 'express';
import { Gender, OrderStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAuth, requireRole } from './auth.js';
import { prisma } from './db.js';
import { HttpError, parseId } from './http.js';
import { sellingPriceFor } from './supplier.js';
import { refreshProductSummary } from './commerce.js';

const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
});
function pageResult<T>(items: T[], total: number, page: number, limit: number) {
  return { items, total, page, pages: Math.ceil(total / limit) };
}

function kazanPeriodStarts() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const year = value('year');
  const month = value('month');
  const day = value('day');
  return { today: new Date(Date.UTC(year, month - 1, day, -3)), month: new Date(Date.UTC(year, month - 1, 1, -3)) };
}

async function periodMetrics(start: Date) {
  const [placedOrders, deliveredEvents] = await Promise.all([
    prisma.order.count({ where: { currency: 'RUB', createdAt: { gte: start } } }),
    prisma.orderStatusEvent.findMany({ where: { toStatus: 'DELIVERED', createdAt: { gte: start }, order: { currency: 'RUB' } }, include: { order: { select: { subtotal: true, discountTotal: true, directCost: true, platformProfit: true, items: { select: { supplierUnitPrice: true, quantity: true } } } } } }),
  ]);
  const merchandiseRevenue = deliveredEvents.reduce((sum, event) => sum + Number(event.order.subtotal) - Number(event.order.discountTotal), 0);
  return {
    placedOrders, deliveredOrders: deliveredEvents.length,
    merchandiseRevenue,
    supplierCost: deliveredEvents.reduce((sum, event) => sum + event.order.items.reduce((itemSum, item) => itemSum + Number(item.supplierUnitPrice) * item.quantity, 0), 0),
    averageOrderValue: deliveredEvents.length ? merchandiseRevenue / deliveredEvents.length : 0,
    directCosts: deliveredEvents.reduce((sum, event) => sum + Number(event.order.directCost), 0),
    platformProfit: deliveredEvents.reduce((sum, event) => sum + Number(event.order.platformProfit), 0),
  };
}

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('ADMIN'));

adminRouter.get('/stats', async (_req, res) => {
  const periods = kazanPeriodStarts();
  const [totalCustomers, totalSuppliers, pendingSuppliers, totalOrders, deliveredOrders, revenue, today, thisMonth] = await Promise.all([
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.supplierProfile.count(),
    prisma.supplierProfile.count({ where: { isApproved: false } }),
    prisma.order.count({ where: { currency: 'RUB' } }),
    prisma.order.count({ where: { status: 'DELIVERED', currency: 'RUB' } }),
    prisma.order.aggregate({ where: { status: 'DELIVERED', currency: 'RUB' }, _sum: { subtotal: true, discountTotal: true, deliveryFee: true, platformProfit: true } }),
    periodMetrics(periods.today), periodMetrics(periods.month),
  ]);
  res.json({
    totalCustomers, totalSuppliers, pendingSuppliers, totalOrders, deliveredOrders,
    totalRevenue: Number(revenue._sum.subtotal ?? 0) - Number(revenue._sum.discountTotal ?? 0),
    deliveryFeesCollected: Number(revenue._sum.deliveryFee ?? 0),
    platformProfit: Number(revenue._sum.platformProfit ?? 0),
    today, thisMonth, currency: 'RUB',
    metricBasis: { placedOrders: 'order creation time', deliveredRevenueAndProfit: 'DELIVERED status event time', timeZone: 'Europe/Moscow' },
  });
});

adminRouter.get('/users', async (req, res) => {
  const query = pagination.parse(req.query);
  const where: Prisma.UserWhereInput = query.q ? { OR: [
    { name: { contains: query.q, mode: 'insensitive' } },
    { email: { contains: query.q, mode: 'insensitive' } },
  ] } : {};
  const [total, items] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit,
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, supplier: { select: { id: true, shopName: true, isApproved: true } } },
    }),
  ]);
  res.json(pageResult(items, total, query.page, query.limit));
});

adminRouter.patch('/users/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const body = z.object({ name: z.string().trim().min(2).max(100).optional(), isActive: z.boolean().optional() }).parse(req.body);
  if (id === req.auth!.id && body.isActive === false) throw new HttpError(409, 'You cannot deactivate your own account');
  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id }, data: body, select: { id: true, name: true, email: true, role: true, isActive: true } });
    if (body.isActive === false && updated.role === 'SUPPLIER') {
      const supplier = await tx.supplierProfile.findUnique({ where: { userId: id }, select: { id: true } });
      if (supplier) await tx.product.updateMany({ where: { supplierId: supplier.id }, data: { isPublished: false } });
    }
    return updated;
  });
  res.json(user);
});

adminRouter.get('/suppliers', async (req, res) => {
  const query = pagination.extend({ approved: z.enum(['true', 'false']).optional() }).parse(req.query);
  const where: Prisma.SupplierProfileWhereInput = {
    ...(query.approved && { isApproved: query.approved === 'true' }),
    ...(query.q && { OR: [
      { shopName: { contains: query.q, mode: 'insensitive' } },
      { user: { email: { contains: query.q, mode: 'insensitive' } } },
    ] }),
  };
  const [total, items] = await prisma.$transaction([
    prisma.supplierProfile.count({ where }),
    prisma.supplierProfile.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit,
      include: { user: { select: { id: true, name: true, email: true, isActive: true } }, _count: { select: { products: true, orderItems: true } } },
    }),
  ]);
  res.json(pageResult(items, total, query.page, query.limit));
});

adminRouter.patch('/suppliers/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const { isApproved } = z.object({ isApproved: z.boolean() }).parse(req.body);
  const supplier = await prisma.$transaction(async (tx) => {
    const updated = await tx.supplierProfile.update({ where: { id }, data: { isApproved } });
    if (!isApproved) await tx.product.updateMany({ where: { supplierId: id }, data: { isPublished: false } });
    return updated;
  });
  res.json(supplier);
});

adminRouter.get('/products', async (req, res) => {
  const query = pagination.parse(req.query);
  const where: Prisma.ProductWhereInput = query.q ? { OR: [
    { nameEn: { contains: query.q, mode: 'insensitive' } },
    { brand: { contains: query.q, mode: 'insensitive' } },
    { supplier: { shopName: { contains: query.q, mode: 'insensitive' } } },
  ] } : {};
  const [total, items] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit,
      include: { supplier: { select: { id: true, shopName: true, isApproved: true } }, variants: { orderBy: { sizeMl: 'asc' } } },
    }),
  ]);
  res.json(pageResult(items.map((item) => ({
    ...item, supplierPrice: Number(item.supplierPrice), sellingPrice: Number(item.sellingPrice),
    variants: item.variants.map((variant) => ({ ...variant, supplierPrice: Number(variant.supplierPrice), sellingPrice: Number(variant.sellingPrice) })),
  })), total, query.page, query.limit));
});

adminRouter.patch('/products/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const imagePath = z.string().trim().refine((value) => /^https?:\/\/[^\s]+$/i.test(value) || /^\/(products|uploads)\/[a-z0-9._-]+\.(jpg|jpeg|png|webp|avif)$/i.test(value), 'Use an image URL or a product/upload path');
  const notes = z.array(z.string().trim().min(1).max(80)).max(20);
  const body = z.object({
    nameEn: z.string().trim().min(2).max(160).optional(),
    nameAr: z.string().trim().min(2).max(160).optional(),
    nameRu: z.string().trim().min(2).max(160).optional(),
    descriptionEn: z.string().trim().min(10).max(5000).optional(),
    descriptionAr: z.string().trim().min(10).max(5000).optional(),
    descriptionRu: z.string().trim().min(10).max(5000).optional(),
    inspirationName: z.string().trim().max(160).nullable().optional(),
    category: z.string().trim().min(2).max(120).optional(),
    familyEn: z.string().trim().min(2).max(160).optional(),
    familyAr: z.string().trim().min(2).max(160).optional(),
    familyRu: z.string().trim().min(2).max(160).optional(),
    gender: z.nativeEnum(Gender).optional(),
    mainImage: imagePath.optional(),
    images: z.array(imagePath).max(12).optional(),
    topNotes: notes.optional(), topNotesRu: notes.optional(), topNotesAr: notes.optional(),
    middleNotes: notes.optional(), middleNotesRu: notes.optional(), middleNotesAr: notes.optional(),
    baseNotes: notes.optional(), baseNotesRu: notes.optional(), baseNotesAr: notes.optional(),
    isPublished: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    sellingPrice: z.number().positive().max(100000).optional(),
    resetPrice: z.boolean().optional(),
  }).refine((value) => !(value.sellingPrice !== undefined && value.resetPrice), 'Choose sellingPrice or resetPrice').parse(req.body);
  const current = await prisma.product.findUnique({ where: { id }, include: { supplier: true, variants: true } });
  if (!current) throw new HttpError(404, 'Product not found', 'NOT_FOUND');
  if (body.isPublished && !current.supplier.isApproved) throw new HttpError(409, 'Supplier must be approved before publishing');
  if (body.isPublished && !current.variants.some((variant) => variant.isActive && variant.stock > 0
    && variant.currency === 'RUB'
    && variant.supplierPrice.gt(0)
    && variant.sellingPrice.gte(variant.supplierPrice))) {
    throw new HttpError(409, 'Set valid RUB supplier cost, selling price and stock, then activate at least one size before publishing');
  }
  const primary = current.variants.find((variant) => variant.sizeMl === 55) ?? current.variants[0];
  if ((body.sellingPrice !== undefined || body.resetPrice) && !primary) throw new HttpError(409, 'Product has no sizes');
  if (body.sellingPrice !== undefined && primary && body.sellingPrice < Number(primary.supplierPrice)) throw new HttpError(422, 'Selling price must cover supplier price');
  const product = await prisma.$transaction(async (tx) => {
    if (primary && (body.sellingPrice !== undefined || body.resetPrice)) {
      await tx.productVariant.update({ where: { id: primary.id }, data: {
        sellingPrice: body.resetPrice ? await sellingPriceFor(primary.supplierPrice) : body.sellingPrice,
        priceOverride: !body.resetPrice,
      } });
    }
    await tx.product.update({ where: { id }, data: {
      nameEn: body.nameEn, nameAr: body.nameAr, nameRu: body.nameRu,
      descriptionEn: body.descriptionEn, descriptionAr: body.descriptionAr, descriptionRu: body.descriptionRu,
      inspirationName: body.inspirationName, category: body.category,
      familyEn: body.familyEn, familyAr: body.familyAr, familyRu: body.familyRu,
      gender: body.gender, mainImage: body.mainImage, images: body.images,
      topNotes: body.topNotes, topNotesRu: body.topNotesRu, topNotesAr: body.topNotesAr,
      middleNotes: body.middleNotes, middleNotesRu: body.middleNotesRu, middleNotesAr: body.middleNotesAr,
      baseNotes: body.baseNotes, baseNotesRu: body.baseNotesRu, baseNotesAr: body.baseNotesAr,
      isPublished: body.isPublished, isFeatured: body.isFeatured,
    } });
    await refreshProductSummary(tx, id);
    return tx.product.findUniqueOrThrow({ where: { id }, include: { variants: { orderBy: { sizeMl: 'asc' } } } });
  });
  res.json({ ...product, supplierPrice: Number(product.supplierPrice), sellingPrice: Number(product.sellingPrice), variants: product.variants.map((variant) => ({ ...variant, supplierPrice: Number(variant.supplierPrice), sellingPrice: Number(variant.sellingPrice) })) });
});

adminRouter.patch('/variants/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const body = z.object({ sizeMl: z.union([z.literal(12), z.literal(17), z.literal(20), z.literal(35), z.literal(55), z.literal(100)]).optional(), sellingPrice: z.number().positive().max(1000000).optional(), supplierPrice: z.number().positive().max(1000000).optional(), currency: z.literal('RUB').optional(), resetPrice: z.boolean().optional(), isActive: z.boolean().optional(), stock: z.number().int().min(0).max(1000000).optional(), sku: z.string().trim().min(2).max(100).optional() })
    .refine((value) => !(value.sellingPrice !== undefined && value.resetPrice), 'Choose sellingPrice or resetPrice').parse(req.body);
  const variant = await prisma.productVariant.findUnique({ where: { id } });
  if (!variant) throw new HttpError(404, 'Variant not found', 'NOT_FOUND');
  if (body.sizeMl !== undefined && body.sizeMl !== variant.sizeMl) {
    const duplicate = await prisma.productVariant.findUnique({ where: { productId_sizeMl: { productId: variant.productId, sizeMl: body.sizeMl } } });
    if (duplicate) throw new HttpError(409, 'This bottle size already exists for the product');
  }
  if (variant.currency !== 'RUB' && body.currency === 'RUB' && (body.supplierPrice === undefined || body.sellingPrice === undefined)) throw new HttpError(422, 'Set both RUB supplier cost and selling price when converting a legacy size');
  const cost = body.supplierPrice === undefined ? variant.supplierPrice : new Prisma.Decimal(body.supplierPrice);
  const price = body.sellingPrice !== undefined ? new Prisma.Decimal(body.sellingPrice) : body.resetPrice ? await sellingPriceFor(cost) : variant.sellingPrice;
  if (price.lt(cost)) throw new HttpError(422, 'Selling price must cover supplier cost');
  if (body.isActive === true && (cost.lte(0) || price.lte(0))) throw new HttpError(422, 'Set supplier cost and selling price before activating this size');
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.productVariant.update({ where: { id }, data: {
      sizeMl: body.sizeMl,
      isActive: body.isActive,
      stock: body.stock,
      sku: body.sku,
      supplierPrice: body.supplierPrice,
      currency: body.currency,
      ...(body.sellingPrice !== undefined && { sellingPrice: body.sellingPrice, priceOverride: true }),
      ...(body.resetPrice && { sellingPrice: await sellingPriceFor(cost), priceOverride: false }),
    } });
    await refreshProductSummary(tx, variant.productId);
    return result;
  });
  res.json({ ...updated, supplierPrice: Number(updated.supplierPrice), sellingPrice: Number(updated.sellingPrice) });
});

adminRouter.delete('/products/:id', async (req, res) => {
  const id = parseId(req.params.id);
  await prisma.product.update({ where: { id }, data: { isPublished: false } });
  res.status(204).end();
});

adminRouter.get('/orders', async (req, res) => {
  const query = pagination.extend({ status: z.nativeEnum(OrderStatus).optional() }).parse(req.query);
  const where: Prisma.OrderWhereInput = query.status ? { status: query.status } : {};
  const [total, items] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        items: { include: { supplier: { select: { id: true, shopName: true } } } },
      },
    }),
  ]);
  res.json(pageResult(items.map((order) => ({
    ...order, subtotal: Number(order.subtotal), deliveryFee: Number(order.deliveryFee), discountTotal: Number(order.discountTotal),
    directCost: Number(order.directCost), total: Number(order.total), platformProfit: Number(order.platformProfit),
    items: order.items.map((item) => ({ ...item, unitPrice: Number(item.unitPrice), supplierUnitPrice: Number(item.supplierUnitPrice), platformProfit: Number(item.platformProfit) })),
  })), total, query.page, query.limit));
});

adminRouter.patch('/orders/:id/status', async (req, res) => {
  const id = parseId(req.params.id);
  const { status } = z.object({ status: z.nativeEnum(OrderStatus) }).parse(req.body);
  const next: Record<string, OrderStatus> = { PENDING: 'CONFIRMED', CONFIRMED: 'PREPARING', PREPARING: 'SHIPPING', SHIPPING: 'DELIVERED' };
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) throw new HttpError(404, 'Order not found', 'NOT_FOUND');
    const cancelling = status === 'CANCELLED';
    if (cancelling) {
      if (order.status === 'CANCELLED' || order.status === 'DELIVERED') {
        throw new HttpError(409, 'Invalid status transition', 'INVALID_STATUS');
      }
      if (order.items.some((item) => item.status === 'SHIPPING' || item.status === 'DELIVERED' || item.status === 'CANCELLED')) {
        throw new HttpError(409, 'Shipped orders cannot be cancelled', 'INVALID_STATUS');
      }
      const productIds = new Set<string>();
      for (const item of order.items) {
        if (item.variantId) await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
        else await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
        productIds.add(item.productId);
      }
      for (const productId of productIds) await refreshProductSummary(tx, productId);
      if (order.promoCodeId) await tx.promoCode.update({ where: { id: order.promoCodeId }, data: { usedCount: { decrement: 1 } } });
    } else if (next[order.status] !== status) {
      throw new HttpError(409, 'Invalid status transition', 'INVALID_STATUS');
    }
    const changed = await tx.order.updateMany({ where: { id, status: order.status }, data: { status } });
    if (!changed.count) throw new HttpError(409, 'Order status changed. Please retry.', 'ORDER_CONFLICT');
    await tx.orderItem.updateMany({ where: { orderId: id }, data: { status } });
    if (status === 'CONFIRMED' && order.paymentMethod === 'BANK_TRANSFER') {
      await tx.order.update({ where: { id }, data: { paymentStatus: 'AWAITING_TRANSFER' } });
    }
    await tx.orderStatusEvent.create({ data: { orderId: id, actorId: req.auth!.id, fromStatus: order.status, toStatus: status } });
    return tx.order.findUniqueOrThrow({ where: { id }, include: { items: true } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json(result);
});

adminRouter.get('/reviews', async (req, res) => {
  const query = pagination.parse(req.query);
  const [total, items] = await prisma.$transaction([
    prisma.review.count(),
    prisma.review.findMany({
      orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit,
      include: { user: { select: { id: true, name: true } }, product: { select: { id: true, nameEn: true } } },
    }),
  ]);
  res.json(pageResult(items, total, query.page, query.limit));
});

async function refreshRating(tx: Prisma.TransactionClient, productId: string) {
  const stats = await tx.review.aggregate({ where: { productId, isApproved: true }, _avg: { rating: true }, _count: true });
  await tx.product.update({ where: { id: productId }, data: { rating: stats._avg.rating ?? 0, reviewCount: stats._count } });
}

adminRouter.patch('/reviews/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const { isApproved } = z.object({ isApproved: z.boolean() }).parse(req.body);
  const review = await prisma.$transaction(async (tx) => {
    const updated = await tx.review.update({ where: { id }, data: { isApproved } });
    await refreshRating(tx, updated.productId);
    return updated;
  });
  res.json(review);
});

adminRouter.delete('/reviews/:id', async (req, res) => {
  const id = parseId(req.params.id);
  await prisma.$transaction(async (tx) => {
    const deleted = await tx.review.delete({ where: { id } });
    await refreshRating(tx, deleted.productId);
  });
  res.status(204).end();
});

adminRouter.get('/commission', async (_req, res) => {
  const settings = await prisma.commissionSettings.findUnique({ where: { id: 'default' } });
  res.json({ type: settings?.type ?? 'PERCENTAGE', value: Number(settings?.value ?? 30) });
});

adminRouter.put('/commission', async (req, res) => {
  const body = z.object({ type: z.enum(['FIXED', 'PERCENTAGE']), value: z.number().min(0).max(100000) })
    .refine((value) => value.type !== 'PERCENTAGE' || value.value <= 100, 'Percentage cannot exceed 100').parse(req.body);
  const value = new Prisma.Decimal(body.value);
  await prisma.$transaction(async (tx) => {
    await tx.commissionSettings.upsert({ where: { id: 'default' }, create: { id: 'default', type: body.type, value }, update: { type: body.type, value } });
    if (body.type === 'FIXED') {
      await tx.$executeRaw`UPDATE "ProductVariant" SET "sellingPrice" = ROUND("supplierPrice" + ${value}, 2), "updatedAt" = NOW() WHERE "priceOverride" = false AND "currency" = 'RUB'`;
    } else {
      await tx.$executeRaw`UPDATE "ProductVariant" SET "sellingPrice" = ROUND("supplierPrice" * (1 + ${value} / 100), 2), "updatedAt" = NOW() WHERE "priceOverride" = false AND "currency" = 'RUB'`;
    }
    await tx.$executeRaw`UPDATE "Product" p SET
      "sellingPrice" = COALESCE((SELECT v."sellingPrice" FROM "ProductVariant" v WHERE v."productId" = p.id AND v."isActive" = true AND v."currency" = 'RUB' ORDER BY v."sellingPrice" LIMIT 1), p."sellingPrice"),
      "supplierPrice" = COALESCE((SELECT v."supplierPrice" FROM "ProductVariant" v WHERE v."productId" = p.id AND v."isActive" = true AND v."currency" = 'RUB' ORDER BY v."sellingPrice" LIMIT 1), p."supplierPrice"),
      "stock" = COALESCE((SELECT SUM(v."stock")::integer FROM "ProductVariant" v WHERE v."productId" = p.id AND v."isActive" = true AND v."currency" = 'RUB'), 0),
      "updatedAt" = NOW()`;
  });
  res.json(body);
});

adminRouter.get('/delivery', async (_req, res) => {
  const settings = await prisma.deliverySettings.findUnique({ where: { id: 'default' } });
  res.json({ courierFee: Number(settings?.courierFee ?? 0), freeThreshold: settings?.freeThreshold === null || settings?.freeThreshold === undefined ? null : Number(settings.freeThreshold), isEnabled: settings?.isEnabled ?? false, currency: 'RUB' });
});

adminRouter.put('/delivery', async (req, res) => {
  const body = z.object({
    courierFee: z.number().min(0).max(100000),
    freeThreshold: z.number().min(0).max(10000000).nullable(),
    isEnabled: z.boolean(),
  }).parse(req.body);
  const settings = await prisma.deliverySettings.upsert({ where: { id: 'default' }, create: { id: 'default', ...body }, update: body });
  res.json({ courierFee: Number(settings.courierFee), freeThreshold: settings.freeThreshold === null ? null : Number(settings.freeThreshold), isEnabled: settings.isEnabled, currency: 'RUB' });
});

const promoSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/).transform((value) => value.toUpperCase()),
  type: z.enum(['FIXED', 'PERCENTAGE']),
  value: z.number().positive().max(1000000),
  minimumOrder: z.number().min(0).max(10000000).default(0),
  expiresAt: z.coerce.date().nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  isEnabled: z.boolean().default(true),
}).refine((value) => value.type !== 'PERCENTAGE' || value.value <= 100, 'Percentage cannot exceed 100');

adminRouter.get('/promos', async (req, res) => {
  const query = pagination.parse(req.query);
  const where: Prisma.PromoCodeWhereInput = query.q ? { code: { contains: query.q, mode: 'insensitive' } } : {};
  const [total, items] = await prisma.$transaction([
    prisma.promoCode.count({ where }),
    prisma.promoCode.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }),
  ]);
  res.json(pageResult(items.map((item) => ({ ...item, value: Number(item.value), minimumOrder: Number(item.minimumOrder) })), total, query.page, query.limit));
});

adminRouter.post('/promos', async (req, res) => {
  const body = promoSchema.parse(req.body);
  const promo = await prisma.promoCode.create({ data: body });
  res.status(201).json({ ...promo, value: Number(promo.value), minimumOrder: Number(promo.minimumOrder) });
});

adminRouter.patch('/promos/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const body = z.object({
    code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/).transform((value) => value.toUpperCase()).optional(),
    type: z.enum(['FIXED', 'PERCENTAGE']).optional(),
    value: z.number().positive().max(1000000).optional(),
    minimumOrder: z.number().min(0).max(10000000).optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    usageLimit: z.number().int().positive().nullable().optional(),
    isEnabled: z.boolean().optional(),
  }).parse(req.body);
  const current = await prisma.promoCode.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, 'Promo code not found', 'NOT_FOUND');
  if ((body.type ?? current.type) === 'PERCENTAGE' && (body.value ?? Number(current.value)) > 100) throw new HttpError(422, 'Percentage cannot exceed 100');
  if (body.usageLimit !== undefined && body.usageLimit !== null && body.usageLimit < current.usedCount) throw new HttpError(422, 'Usage limit cannot be below times already used');
  const promo = await prisma.promoCode.update({ where: { id }, data: body });
  res.json({ ...promo, value: Number(promo.value), minimumOrder: Number(promo.minimumOrder) });
});

adminRouter.delete('/promos/:id', async (req, res) => {
  await prisma.promoCode.update({ where: { id: parseId(req.params.id) }, data: { isEnabled: false } });
  res.status(204).end();
});

adminRouter.patch('/orders/:id/payment', async (req, res) => {
  const id = parseId(req.params.id);
  const { paymentStatus } = z.object({ paymentStatus: z.enum(['PENDING', 'AWAITING_TRANSFER', 'PAID', 'FAILED']) }).parse(req.body);
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new HttpError(404, 'Order not found', 'NOT_FOUND');
  if (order.status === 'CANCELLED') throw new HttpError(409, 'Cancelled order cannot be paid', 'INVALID_STATUS');
  if (paymentStatus === 'AWAITING_TRANSFER' && order.paymentMethod !== 'BANK_TRANSFER') throw new HttpError(422, 'Only bank transfer orders can await transfer');
  if (paymentStatus === 'PAID' && order.status === 'PENDING') throw new HttpError(409, 'Confirm the order before marking it paid');
  const updated = await prisma.order.update({ where: { id }, data: { paymentStatus }, select: { id: true, orderNumber: true, status: true, paymentMethod: true, paymentStatus: true } });
  res.json(updated);
});

adminRouter.patch('/orders/:id/costs', async (req, res) => {
  const id = parseId(req.params.id);
  const { directCost } = z.object({ directCost: z.number().min(0).max(10000000) }).parse(req.body);
  const order = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id } });
    if (!current) throw new HttpError(404, 'Order not found', 'NOT_FOUND');
    const newCost = new Prisma.Decimal(directCost);
    return tx.order.update({ where: { id }, data: {
      directCost: newCost,
      platformProfit: current.platformProfit.add(current.directCost).sub(newCost),
    } });
  });
  res.json({ id: order.id, orderNumber: order.orderNumber, directCost: Number(order.directCost), platformProfit: Number(order.platformProfit) });
});

adminRouter.get('/customers', async (req, res) => {
  const query = pagination.parse(req.query);
  const where: Prisma.UserWhereInput = { role: 'CUSTOMER', ...(query.q && { OR: [
    { name: { contains: query.q, mode: 'insensitive' } },
    { email: { contains: query.q, mode: 'insensitive' } },
    { customerProfile: { phone: { contains: query.q } } },
  ] }) };
  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit,
      select: { id: true, name: true, email: true, createdAt: true, isActive: true, customerProfile: { select: { phone: true, preferredLanguage: true, marketingConsent: true, preferredChannel: true } } } }),
  ]);
  const userIds = users.map((user) => user.id);
  const orders = await prisma.order.findMany({ where: { customerId: { in: userIds }, currency: 'RUB' }, select: { customerId: true, status: true, total: true, createdAt: true } });
  const items = users.map((user) => {
    const own = orders.filter((order) => order.customerId === user.id);
    const delivered = own.filter((order) => order.status === 'DELIVERED');
    return { ...user, orderCount: own.length, lifetimeValue: delivered.reduce((sum, order) => sum + Number(order.total), 0), lastOrderAt: own.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.createdAt ?? null };
  });
  res.json(pageResult(items, total, query.page, query.limit));
});

adminRouter.get('/customers/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const customer = await prisma.user.findFirst({ where: { id, role: 'CUSTOMER' }, select: {
    id: true, name: true, email: true, isActive: true, createdAt: true,
    customerProfile: true, addresses: true,
    favorites: { select: { product: { select: { id: true, slug: true, nameRu: true, nameEn: true, mainImage: true } } } },
    orders: { orderBy: { createdAt: 'desc' }, take: 50, select: {
      id: true, orderNumber: true, status: true, subtotal: true, discountTotal: true, total: true, currency: true, createdAt: true,
    } },
  } });
  if (!customer) throw new HttpError(404, 'Customer not found', 'NOT_FOUND');
  res.json({ ...customer, orders: customer.orders.map((order) => ({ ...order, subtotal: Number(order.subtotal), discountTotal: Number(order.discountTotal), total: Number(order.total) })) });
});

adminRouter.get('/business-stats', async (_req, res) => {
  const [ordersByStatus, delivered, orderCount, topItems, topSizes, lowStock, recentOrders, monthly] = await Promise.all([
    prisma.order.groupBy({ by: ['status'], where: { currency: 'RUB' }, _count: { _all: true } }),
    prisma.order.aggregate({ where: { currency: 'RUB', status: 'DELIVERED' }, _sum: { subtotal: true, discountTotal: true, deliveryFee: true, directCost: true, platformProfit: true }, _count: true }),
    prisma.order.count({ where: { currency: 'RUB' } }),
    prisma.orderItem.groupBy({ by: ['productId'], where: { order: { currency: 'RUB', status: 'DELIVERED' } }, _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 5 }),
    prisma.orderItem.groupBy({ by: ['sizeMl'], where: { order: { currency: 'RUB', status: 'DELIVERED' }, sizeMl: { not: null } }, _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 5 }),
    prisma.productVariant.findMany({ where: { currency: 'RUB', isActive: true, stock: { lte: 5 }, product: { isPublished: true, supplier: { isApproved: true } } }, orderBy: { stock: 'asc' }, take: 20, select: { id: true, sizeMl: true, stock: true, product: { select: { id: true, nameRu: true, nameEn: true } } } }),
    prisma.order.findMany({ where: { currency: 'RUB' }, orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, orderNumber: true, status: true, total: true, createdAt: true, customer: { select: { name: true } } } }),
    prisma.$queryRaw<Array<{ month: Date; orders: bigint; merchandiseRevenue: Prisma.Decimal; profit: Prisma.Decimal }>>`
      SELECT date_trunc('month', e."createdAt" + INTERVAL '3 hours') AS month,
             COUNT(*)::bigint AS orders,
             COALESCE(SUM(o."subtotal" - o."discountTotal"), 0) AS "merchandiseRevenue",
             COALESCE(SUM(o."platformProfit"), 0) AS profit
      FROM "OrderStatusEvent" e JOIN "Order" o ON o."id" = e."orderId"
      WHERE e."toStatus" = 'DELIVERED' AND o."currency" = 'RUB' AND e."createdAt" >= NOW() - INTERVAL '12 months'
      GROUP BY 1 ORDER BY 1`,
  ]);
  const products = await prisma.product.findMany({ where: { id: { in: topItems.map((item) => item.productId) } }, select: { id: true, nameRu: true, nameEn: true, mainImage: true } });
  const revenue = Number(delivered._sum.subtotal ?? 0) - Number(delivered._sum.discountTotal ?? 0);
  res.json({
    currency: 'RUB', totalOrders: orderCount, deliveredOrders: delivered._count,
    merchandiseRevenue: revenue, deliveryFeesCollected: Number(delivered._sum.deliveryFee ?? 0),
    promoDiscounts: Number(delivered._sum.discountTotal ?? 0), directCosts: Number(delivered._sum.directCost ?? 0),
    platformProfit: Number(delivered._sum.platformProfit ?? 0), averageOrderValue: delivered._count ? revenue / delivered._count : 0,
    ordersByStatus: Object.fromEntries(ordersByStatus.map((item) => [item.status, item._count._all])),
    topProducts: topItems.map((item) => ({ ...products.find((product) => product.id === item.productId), quantity: item._sum.quantity ?? 0 })),
    topSizes: topSizes.map((item) => ({ sizeMl: item.sizeMl, quantity: item._sum.quantity ?? 0 })),
    lowStock,
    recentOrders: recentOrders.map((item) => ({ ...item, total: Number(item.total) })),
    cancelledOrders: ordersByStatus.find((item) => item.status === 'CANCELLED')?._count._all ?? 0,
    monthly: monthly.map((item) => ({ month: item.month, orders: Number(item.orders), merchandiseRevenue: Number(item.merchandiseRevenue), profit: Number(item.profit) })),
  });
});
