import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAuth } from './auth.js';
import { prisma } from './db.js';
import { HttpError } from './http.js';

export const checkoutLineSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20),
});
export type CheckoutLine = z.infer<typeof checkoutLineSchema>;

export async function refreshProductSummary(tx: Prisma.TransactionClient, productId: string) {
  const variants = await tx.productVariant.findMany({ where: { productId, isActive: true, currency: 'RUB' }, orderBy: { sellingPrice: 'asc' } });
  const cheapest = variants[0];
  await tx.product.update({
    where: { id: productId },
    data: {
      stock: variants.reduce((sum, variant) => sum + variant.stock, 0),
      ...(cheapest && { sellingPrice: cheapest.sellingPrice, supplierPrice: cheapest.supplierPrice }),
    },
  });
}

export function promoDiscount(promo: { type: 'FIXED' | 'PERCENTAGE'; value: Prisma.Decimal }, subtotal: Prisma.Decimal) {
  const raw = promo.type === 'FIXED' ? promo.value : subtotal.mul(promo.value).div(100);
  return Prisma.Decimal.min(raw.toDecimalPlaces(2), subtotal);
}

export async function validatedPromo(tx: Prisma.TransactionClient, code: string, subtotal: Prisma.Decimal) {
  const promo = await tx.promoCode.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!promo || !promo.isEnabled) throw new HttpError(422, 'Promo code is unavailable', 'INVALID_PROMO');
  if (promo.expiresAt && promo.expiresAt <= new Date()) throw new HttpError(422, 'Promo code has expired', 'EXPIRED_PROMO');
  if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) throw new HttpError(422, 'Promo code usage limit reached', 'PROMO_LIMIT');
  if (subtotal.lt(promo.minimumOrder)) throw new HttpError(422, 'Order does not meet promo minimum', 'PROMO_MINIMUM');
  return { promo, discount: promoDiscount(promo, subtotal) };
}

export async function deliveryQuote(tx: Prisma.TransactionClient, amountAfterDiscount: Prisma.Decimal) {
  const settings = await tx.deliverySettings.findUnique({ where: { id: 'default' } });
  const enabled = settings?.isEnabled ?? false;
  if (!enabled) throw new HttpError(409, 'Courier delivery is temporarily unavailable', 'DELIVERY_UNAVAILABLE');
  const fee = settings?.courierFee ?? new Prisma.Decimal(0);
  const freeThreshold = settings?.freeThreshold;
  return freeThreshold !== null && freeThreshold !== undefined && amountAfterDiscount.gte(freeThreshold)
    ? new Prisma.Decimal(0) : fee;
}

export const commerceRouter = Router();

commerceRouter.get('/delivery/options', async (_req, res) => {
  const settings = await prisma.deliverySettings.findUnique({ where: { id: 'default' } });
  res.json({
    currency: 'RUB',
    options: [
      { method: 'KAZAN_COURIER', city: 'Казань', enabled: settings?.isEnabled ?? false, fee: Number(settings?.courierFee ?? 0), freeThreshold: settings?.freeThreshold === null || settings?.freeThreshold === undefined ? null : Number(settings.freeThreshold) },
      { method: 'PICKUP', enabled: false },
      { method: 'RUSSIA_SHIPPING', enabled: false },
    ],
    paymentMethods: ['CASH_ON_DELIVERY', 'BANK_TRANSFER'],
  });
});

commerceRouter.post('/promos/validate', requireAuth, async (req, res) => {
  const body = z.object({ code: z.string().trim().min(2).max(40), items: z.array(checkoutLineSchema).min(1).max(30).optional() }).parse(req.body);
  const cart = body.items ? [] : await prisma.cartItem.findMany({ where: { userId: req.auth!.id }, select: { variantId: true, quantity: true } });
  const lines = body.items ?? cart.flatMap((item) => item.variantId ? [{ variantId: item.variantId, quantity: item.quantity }] : []);
  if (!lines.length) throw new HttpError(422, 'Add products before validating a promo code');
  const merged = new Map<string, number>();
  for (const line of lines) merged.set(line.variantId, (merged.get(line.variantId) ?? 0) + line.quantity);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: [...merged.keys()] }, isActive: true, currency: 'RUB', product: { isPublished: true, supplier: { isApproved: true } } },
  });
  if (variants.length !== merged.size) throw new HttpError(422, 'Some items are unavailable', 'PRODUCT_UNAVAILABLE');
  const subtotal = variants.reduce((sum, variant) => sum.add(variant.sellingPrice.mul(merged.get(variant.id)!)), new Prisma.Decimal(0));
  const result = await prisma.$transaction(async (tx) => {
    const { promo, discount } = await validatedPromo(tx, body.code, subtotal);
    const deliveryFee = await deliveryQuote(tx, subtotal.sub(discount));
    return { code: promo.code, discountTotal: Number(discount), deliveryFee: Number(deliveryFee), total: Number(subtotal.sub(discount).add(deliveryFee)) };
  });
  res.json({ valid: true, subtotal: Number(subtotal), currency: 'RUB', ...result });
});
