import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAuth } from './auth.js';
import { publicProduct, publicProductInclude } from './catalog.js';
import { deliveryQuote, refreshProductSummary, validatedPromo } from './commerce.js';
import { prisma } from './db.js';
import { HttpError, parseId } from './http.js';

const cartLineSchema = z.object({
  variantId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).max(20),
}).refine((value) => value.variantId || value.productId, 'variantId or productId is required');

const addressBaseSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  city: z.string().trim().default('Казань'),
  street: z.string().trim().min(2).max(160),
  houseNumber: z.string().trim().min(1).max(30),
  apartment: z.string().trim().max(30).optional(),
  entrance: z.string().trim().max(30).optional(),
  floor: z.string().trim().max(30).optional(),
  deliveryComment: z.string().trim().max(500).optional(),
});
const addressSchema = addressBaseSchema.refine((value) => ['казань', 'kazan'].includes(value.city.toLowerCase()), 'Courier delivery is available in Kazan only');

const orderSchema = z.object({
  items: z.array(cartLineSchema).min(1).max(30).optional(),
  shippingAddress: addressSchema,
  phone: z.string().trim().min(5).max(40),
  deliveryMethod: z.literal('KAZAN_COURIER').default('KAZAN_COURIER'),
  paymentMethod: z.enum(['CASH_ON_DELIVERY', 'BANK_TRANSFER']),
  promoCode: z.string().trim().max(40).optional(),
  note: z.string().trim().max(1000).optional(),
  clientRequestId: z.string().uuid().optional(),
});

export const orderInclude = {
  items: { select: {
    id: true, productId: true, variantId: true, sizeMl: true,
    productName: true, productNameAr: true, productNameRu: true, productImage: true,
    quantity: true, unitPrice: true, status: true,
    product: { select: { id: true, slug: true } },
  } },
  statusEvents: { orderBy: { createdAt: 'asc' as const }, select: {
    fromStatus: true, toStatus: true, createdAt: true,
  } },
} satisfies Prisma.OrderInclude;

export function customerOrder(order: Prisma.OrderGetPayload<{ include: typeof orderInclude }>) {
  return {
    orderNumber: order.orderNumber, status: order.status,
    subtotal: Number(order.subtotal), deliveryFee: Number(order.deliveryFee),
    discountTotal: Number(order.discountTotal), total: Number(order.total),
    currency: order.currency, deliveryMethod: order.deliveryMethod,
    paymentMethod: order.paymentMethod, paymentStatus: order.paymentStatus,
    promoCode: order.promoCodeSnapshot,
    shippingAddress: order.shippingAddress, phone: order.phone, note: order.note,
    createdAt: order.createdAt, updatedAt: order.updatedAt,
    statusEvents: order.statusEvents,
    items: order.items.map((item) => ({
      sizeMl: item.sizeMl,
      productName: item.productName, productNameAr: item.productNameAr, productNameRu: item.productNameRu,
      productImage: item.productImage, quantity: item.quantity,
      unitPrice: Number(item.unitPrice), status: item.status,
      product: {
        slug: item.product.slug, mainImage: item.productImage,
        nameEn: item.productName, nameAr: item.productNameAr, nameRu: item.productNameRu,
        name: { en: item.productName, ar: item.productNameAr, ru: item.productNameRu },
      },
    })),
  };
}

async function activeVariant(variantId?: string, productId?: string) {
  const variant = variantId
    ? await prisma.productVariant.findFirst({ where: { id: variantId, isActive: true, currency: 'RUB', ...(productId && { productId }), product: { isPublished: true, supplier: { isApproved: true } } }, include: { product: { include: publicProductInclude } } })
    : await prisma.productVariant.findFirst({ where: { productId, isActive: true, currency: 'RUB', product: { isPublished: true, supplier: { isApproved: true } } }, orderBy: { sizeMl: 'asc' }, include: { product: { include: publicProductInclude } } });
  if (!variant) throw new HttpError(404, 'Product size is unavailable', 'PRODUCT_UNAVAILABLE');
  return variant;
}

async function normalizedLines(lines: Array<z.infer<typeof cartLineSchema>>) {
  const merged = new Map<string, number>();
  for (const line of lines) {
    const variant = await activeVariant(line.variantId, line.productId);
    merged.set(variant.id, (merged.get(variant.id) ?? 0) + line.quantity);
  }
  if ([...merged.values()].some((quantity) => quantity > 20)) throw new HttpError(422, 'Maximum quantity is 20 per size');
  return merged;
}

export const customerRouter = Router();
customerRouter.use(['/favorites', '/cart', '/orders', '/profile', '/addresses'], requireAuth);

customerRouter.get('/favorites', async (req, res) => {
  const rows = await prisma.favorite.findMany({
    where: { userId: req.auth!.id, product: { isPublished: true, supplier: { isApproved: true } } },
    include: { product: { include: publicProductInclude } }, orderBy: { createdAt: 'desc' },
  });
  res.json(rows.map((row) => publicProduct(row.product)));
});

customerRouter.post('/favorites', async (req, res) => {
  const { productId } = z.object({ productId: z.string().uuid() }).parse(req.body);
  const product = await prisma.product.findFirst({ where: { id: productId, isPublished: true, supplier: { isApproved: true } } });
  if (!product) throw new HttpError(404, 'Product not available', 'PRODUCT_UNAVAILABLE');
  await prisma.favorite.upsert({ where: { userId_productId: { userId: req.auth!.id, productId } }, create: { userId: req.auth!.id, productId }, update: {} });
  res.status(201).json({ productId });
});

customerRouter.delete('/favorites/:productId', async (req, res) => {
  await prisma.favorite.deleteMany({ where: { userId: req.auth!.id, productId: parseId(req.params.productId) } });
  res.status(204).end();
});

customerRouter.get('/cart', async (req, res) => {
  const rows = await prisma.cartItem.findMany({
    where: { userId: req.auth!.id },
    include: { variant: true, product: { include: publicProductInclude } }, orderBy: { createdAt: 'asc' },
  });
  const items = rows.map((row) => {
    const variant = row.variant?.currency === 'RUB' ? row.variant : row.product.variants[0];
    return {
      id: row.id, productId: row.productId, variantId: variant?.id ?? null,
      quantity: row.quantity,
      available: Boolean(variant?.isActive && variant.currency === 'RUB' && row.product.isPublished && row.product.variants.length && variant.stock >= row.quantity),
      variant: variant ? { id: variant.id, sizeMl: variant.sizeMl, sellingPrice: Number(variant.sellingPrice), stock: variant.stock } : null,
      product: publicProduct(row.product),
    };
  });
  res.json({ items, subtotal: items.reduce((sum, item) => sum + item.quantity * (item.variant?.sellingPrice ?? 0), 0), currency: 'RUB' });
});

customerRouter.post('/cart', async (req, res) => {
  const body = cartLineSchema.parse(req.body);
  const variant = await activeVariant(body.variantId, body.productId);
  const existing = await prisma.cartItem.findFirst({ where: { userId: req.auth!.id, variantId: variant.id } });
  const quantity = (existing?.quantity ?? 0) + body.quantity;
  if (quantity > 20 || quantity > variant.stock) throw new HttpError(409, 'Requested quantity exceeds stock', 'INSUFFICIENT_STOCK');
  const item = existing
    ? await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity } })
    : await prisma.cartItem.create({ data: { userId: req.auth!.id, productId: variant.productId, variantId: variant.id, quantity } });
  res.status(201).json(item);
});

customerRouter.patch('/cart/:variantId', async (req, res) => {
  const id = parseId(req.params.variantId);
  const { quantity } = z.object({ quantity: z.number().int().min(1).max(20) }).parse(req.body);
  const item = await prisma.cartItem.findFirst({ where: { userId: req.auth!.id, OR: [{ variantId: id }, { productId: id, variantId: null }] } });
  if (!item) throw new HttpError(404, 'Cart item not found', 'NOT_FOUND');
  const variant = await activeVariant(item.variantId ?? undefined, item.productId);
  if (quantity > variant.stock) throw new HttpError(409, 'Requested quantity exceeds stock', 'INSUFFICIENT_STOCK');
  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity, variantId: variant.id } });
  res.json({ variantId: variant.id, quantity });
});

customerRouter.delete('/cart/:variantId', async (req, res) => {
  const id = parseId(req.params.variantId);
  await prisma.cartItem.deleteMany({ where: { userId: req.auth!.id, OR: [{ variantId: id }, { productId: id, variantId: null }] } });
  res.status(204).end();
});

customerRouter.post('/orders', async (req, res) => {
  const body = orderSchema.parse(req.body);
  const userId = req.auth!.id;
  if (body.clientRequestId) {
    const previous = await prisma.order.findUnique({ where: { customerId_clientRequestId: { customerId: userId, clientRequestId: body.clientRequestId } }, include: orderInclude });
    if (previous) { res.json(customerOrder(previous)); return; }
  }
  const cart = body.items ? [] : await prisma.cartItem.findMany({ where: { userId }, select: { variantId: true, productId: true, quantity: true } });
  const lines = body.items ?? cart.map((item) => ({ variantId: item.variantId ?? undefined, productId: item.productId, quantity: item.quantity }));
  if (!lines.length) throw new HttpError(422, 'Order must contain at least one item');
  const merged = await normalizedLines(lines);

  let order: Prisma.OrderGetPayload<{ include: typeof orderInclude }> | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      order = await prisma.$transaction(async (tx) => {
        const variants = await tx.productVariant.findMany({
          where: { id: { in: [...merged.keys()] }, isActive: true, currency: 'RUB', product: { isPublished: true, supplier: { isApproved: true } } },
          include: { product: true },
        });
        if (variants.length !== merged.size) throw new HttpError(409, 'Some sizes are no longer available', 'PRODUCT_UNAVAILABLE');
        let subtotal = new Prisma.Decimal(0);
        let productMargin = new Prisma.Decimal(0);
        const items = [];
        const productIds = new Set<string>();
        for (const variant of variants) {
          const quantity = merged.get(variant.id)!;
          const reserved = await tx.productVariant.updateMany({ where: { id: variant.id, stock: { gte: quantity }, isActive: true }, data: { stock: { decrement: quantity } } });
          if (!reserved.count) throw new HttpError(409, `${variant.product.nameEn} ${variant.sizeMl} ml is out of stock`, 'INSUFFICIENT_STOCK');
          productIds.add(variant.productId);
          subtotal = subtotal.add(variant.sellingPrice.mul(quantity));
          const margin = variant.sellingPrice.sub(variant.supplierPrice).mul(quantity);
          productMargin = productMargin.add(margin);
          items.push({
            productId: variant.productId, variantId: variant.id, sizeMl: variant.sizeMl, sku: variant.sku,
            supplierId: variant.product.supplierId,
            productName: variant.product.nameEn, productNameAr: variant.product.nameAr, productNameRu: variant.product.nameRu,
            productImage: variant.product.mainImage, quantity,
            unitPrice: variant.sellingPrice, supplierUnitPrice: variant.supplierPrice, platformProfit: margin,
          });
        }
        for (const productId of productIds) await refreshProductSummary(tx, productId);
        const promo = body.promoCode ? await validatedPromo(tx, body.promoCode, subtotal) : null;
        if (promo) {
          const claimed = await tx.promoCode.updateMany({
            where: {
              id: promo.promo.id, isEnabled: true,
              usedCount: { equals: promo.promo.usedCount, ...(promo.promo.usageLimit !== null && { lt: promo.promo.usageLimit }) },
            },
            data: { usedCount: { increment: 1 } },
          });
          if (!claimed.count) throw new HttpError(409, 'Promo code was just used up. Please retry', 'PROMO_LIMIT');
        }
        const discountTotal = promo?.discount ?? new Prisma.Decimal(0);
        const deliveryFee = await deliveryQuote(tx, subtotal.sub(discountTotal));
        const total = subtotal.sub(discountTotal).add(deliveryFee);
        const year = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Moscow', year: 'numeric' }).format(new Date()));
        const sequence = await tx.orderSequence.upsert({
          where: { year }, create: { year, lastValue: 1 }, update: { lastValue: { increment: 1 } },
        });
        const orderNumber = `RE-${year}-${String(sequence.lastValue).padStart(5, '0')}`;
        const created = await tx.order.create({
          data: {
            customerId: userId, orderNumber, subtotal, deliveryFee, discountTotal, total,
            platformProfit: productMargin.sub(discountTotal), currency: 'RUB',
            deliveryMethod: body.deliveryMethod, paymentMethod: body.paymentMethod,
            promoCodeId: promo?.promo.id, promoCodeSnapshot: promo?.promo.code,
            shippingAddress: { ...body.shippingAddress, city: 'Казань', country: 'Россия' } as Prisma.InputJsonValue,
            phone: body.phone, note: body.note, clientRequestId: body.clientRequestId,
            items: { create: items }, statusEvents: { create: { toStatus: 'PENDING', actorId: userId } },
          }, include: orderInclude,
        });
        await tx.customerProfile.upsert({ where: { userId }, create: { userId, phone: body.phone }, update: { phone: body.phone } });
        await tx.cartItem.deleteMany({ where: { userId, OR: [{ variantId: { in: [...merged.keys()] } }, { variantId: null, productId: { in: [...productIds] } }] } });
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      break;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) continue;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && body.clientRequestId) {
        const previous = await prisma.order.findUnique({ where: { customerId_clientRequestId: { customerId: userId, clientRequestId: body.clientRequestId } }, include: orderInclude });
        if (previous) { res.json(customerOrder(previous)); return; }
      }
      throw error;
    }
  }
  if (!order) throw new HttpError(409, 'Order could not be placed. Please try again', 'ORDER_CONFLICT');
  res.status(201).json(customerOrder(order));
});

customerRouter.get('/orders', async (req, res) => {
  const orders = await prisma.order.findMany({ where: { customerId: req.auth!.id }, include: orderInclude, orderBy: { createdAt: 'desc' }, take: 100 });
  res.json(orders.map(customerOrder));
});

customerRouter.get('/orders/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const order = await prisma.order.findFirst({ where: { customerId: req.auth!.id, orderNumber: id }, include: orderInclude });
  if (!order) throw new HttpError(404, 'Order not found', 'NOT_FOUND');
  res.json(customerOrder(order));
});

customerRouter.get('/profile', async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.id }, select: {
    id: true, name: true, email: true, role: true,
    customerProfile: { select: { phone: true, preferredLanguage: true, marketingConsent: true, preferredChannel: true, dateOfBirth: true } },
    addresses: { orderBy: { createdAt: 'desc' } },
  } });
  res.json(user);
});

customerRouter.patch('/profile', async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(2).max(100).optional(),
    phone: z.string().trim().min(5).max(40).optional(),
    preferredLanguage: z.enum(['ru', 'en', 'ar']).optional(),
    marketingConsent: z.boolean().optional(),
    preferredChannel: z.enum(['WHATSAPP', 'TELEGRAM', 'EMAIL']).nullable().optional(),
    dateOfBirth: z.coerce.date().max(new Date()).nullable().optional(),
  }).parse(req.body);
  const { name, ...profile } = body;
  const result = await prisma.$transaction(async (tx) => {
    if (name) await tx.user.update({ where: { id: req.auth!.id }, data: { name } });
    return tx.customerProfile.upsert({ where: { userId: req.auth!.id }, create: { userId: req.auth!.id, ...profile }, update: profile });
  });
  res.json(result);
});

customerRouter.get('/addresses', async (req, res) => {
  res.json(await prisma.customerAddress.findMany({ where: { userId: req.auth!.id }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] }));
});

customerRouter.post('/addresses', async (req, res) => {
  const body = addressBaseSchema.extend({ label: z.string().trim().max(60).optional(), isDefault: z.boolean().optional() })
    .refine((value) => ['казань', 'kazan'].includes(value.city.toLowerCase()), 'Courier delivery is available in Kazan only').parse(req.body);
  const address = await prisma.$transaction(async (tx) => {
    if (body.isDefault) await tx.customerAddress.updateMany({ where: { userId: req.auth!.id }, data: { isDefault: false } });
    return tx.customerAddress.create({ data: { ...body, city: 'Казань', userId: req.auth!.id } });
  });
  res.status(201).json(address);
});

customerRouter.patch('/addresses/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const body = addressBaseSchema.extend({ label: z.string().trim().max(60).optional(), isDefault: z.boolean().optional() }).partial().parse(req.body);
  const existing = await prisma.customerAddress.findFirst({ where: { id, userId: req.auth!.id } });
  if (!existing) throw new HttpError(404, 'Address not found', 'NOT_FOUND');
  const address = await prisma.$transaction(async (tx) => {
    if (body.isDefault) await tx.customerAddress.updateMany({ where: { userId: req.auth!.id }, data: { isDefault: false } });
    return tx.customerAddress.update({ where: { id }, data: { ...body, city: 'Казань' } });
  });
  res.json(address);
});

customerRouter.delete('/addresses/:id', async (req, res) => {
  const result = await prisma.customerAddress.deleteMany({ where: { id: parseId(req.params.id), userId: req.auth!.id } });
  if (!result.count) throw new HttpError(404, 'Address not found', 'NOT_FOUND');
  res.status(204).end();
});
