import { Router } from 'express';
import { Gender, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from './db.js';
import { HttpError, parseId } from './http.js';
import { requireAuth } from './auth.js';

const catalogQuery = z.object({
  q: z.string().trim().max(120).optional(),
  brand: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
  gender: z.nativeEnum(Gender).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'rating']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});

export const publicProductInclude = {
  variants: { where: { currency: 'RUB' }, orderBy: { sizeMl: 'asc' as const } },
} satisfies Prisma.ProductInclude;

export type CatalogProduct = Prisma.ProductGetPayload<{ include: typeof publicProductInclude }>;

export function publicProduct(product: CatalogProduct) {
  return {
    id: product.id,
    slug: product.slug,
    nameEn: product.nameEn,
    nameAr: product.nameAr,
    nameRu: product.nameRu,
    descriptionEn: product.descriptionEn,
    descriptionAr: product.descriptionAr,
    descriptionRu: product.descriptionRu,
    name: { en: product.nameEn, ar: product.nameAr, ru: product.nameRu },
    description: { en: product.descriptionEn, ar: product.descriptionAr, ru: product.descriptionRu },
    brand: 'OSIRIS',
    inspirationName: product.inspirationName,
    category: product.category,
    family: { en: product.familyEn || product.category, ar: product.familyAr || product.category, ru: product.familyRu || product.category },
    gender: product.gender,
    topNotes: product.topNotes,
    middleNotes: product.middleNotes,
    baseNotes: product.baseNotes,
    localizedNotes: {
      top: { en: product.topNotes, ar: product.topNotesAr.length ? product.topNotesAr : product.topNotes, ru: product.topNotesRu.length ? product.topNotesRu : product.topNotes },
      middle: { en: product.middleNotes, ar: product.middleNotesAr.length ? product.middleNotesAr : product.middleNotes, ru: product.middleNotesRu.length ? product.middleNotesRu : product.middleNotes },
      base: { en: product.baseNotes, ar: product.baseNotesAr.length ? product.baseNotesAr : product.baseNotes, ru: product.baseNotesRu.length ? product.baseNotesRu : product.baseNotes },
    },
    mainImage: product.mainImage,
    gallery: product.images,
    images: product.images,
    stockQuantity: product.variants.reduce((sum, variant) => sum + (variant.isActive ? variant.stock : 0), 0),
    sellingPrice: product.variants.some((variant) => variant.isActive && variant.sellingPrice.gt(0))
      ? Math.min(...product.variants.filter((variant) => variant.isActive && variant.sellingPrice.gt(0)).map((variant) => Number(variant.sellingPrice)))
      : 0,
    variants: product.variants.map((variant) => ({
      id: variant.id, sizeMl: variant.sizeMl,
      sellingPrice: Number(variant.sellingPrice), stock: variant.isActive ? variant.stock : 0, isActive: variant.isActive,
    })),
    currency: 'RUB',
    rating: product.rating,
    reviewCount: product.reviewCount,
    isFeatured: product.isFeatured,
    createdAt: product.createdAt,
  };
}

export const catalogRouter = Router();

catalogRouter.get('/categories', async (_req, res) => {
  const rows = await prisma.product.findMany({
    where: { isPublished: true, supplier: { isApproved: true } },
    distinct: ['category'],
    select: { category: true },
    orderBy: { category: 'asc' },
  });
  res.json(rows.map((row) => row.category));
});

catalogRouter.get('/products', async (req, res) => {
  const query = catalogQuery.parse(req.query);
  if (query.brand && query.brand.toLowerCase() !== 'osiris') {
    res.json({ items: [], total: 0, page: query.page, pages: 0 });
    return;
  }
  if (query.minPrice !== undefined && query.maxPrice !== undefined && query.minPrice > query.maxPrice) {
    throw new HttpError(422, 'Minimum price must not exceed maximum price');
  }
  const where: Prisma.ProductWhereInput = {
    isPublished: true,
    supplier: { isApproved: true },
    ...(query.category && { category: { equals: query.category, mode: 'insensitive' } }),
    ...(query.gender && { gender: query.gender }),
    ...(query.minPrice !== undefined || query.maxPrice !== undefined ? {
      variants: { some: { isActive: true, currency: 'RUB', sellingPrice: { ...(query.minPrice !== undefined && { gte: query.minPrice }), ...(query.maxPrice !== undefined && { lte: query.maxPrice }) } } },
    } : {}),
    ...(query.q && { OR: [
      { nameEn: { contains: query.q, mode: 'insensitive' } },
      { nameAr: { contains: query.q, mode: 'insensitive' } },
      { nameRu: { contains: query.q, mode: 'insensitive' } },
      { category: { contains: query.q, mode: 'insensitive' } },
      { inspirationName: { contains: query.q, mode: 'insensitive' } },
      { familyRu: { contains: query.q, mode: 'insensitive' } },
    ] }),
  };
  const orderBy: Prisma.ProductOrderByWithRelationInput = query.sort === 'price_asc'
    ? { sellingPrice: 'asc' }
    : query.sort === 'price_desc'
      ? { sellingPrice: 'desc' }
      : query.sort === 'rating'
        ? { rating: 'desc' }
        : { createdAt: 'desc' };
  const [total, products] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({ where, include: publicProductInclude, orderBy, skip: (query.page - 1) * query.limit, take: query.limit }),
  ]);
  res.json({ items: products.map(publicProduct), total, page: query.page, pages: Math.ceil(total / query.limit) });
});

catalogRouter.get('/products/:slug', async (req, res) => {
  const slug = parseId(req.params.slug);
  const product = await prisma.product.findFirst({
    where: { OR: [{ slug }, { id: slug }], isPublished: true, supplier: { isApproved: true } },
    include: publicProductInclude,
  });
  if (!product) throw new HttpError(404, 'Product not found', 'NOT_FOUND');
  res.json(publicProduct(product));
});

catalogRouter.get('/products/:id/reviews', async (req, res) => {
  const productId = parseId(req.params.id);
  const reviews = await prisma.review.findMany({
    where: { productId, isApproved: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, rating: true, comment: true, createdAt: true, user: { select: { id: true, name: true } } },
  });
  res.json(reviews);
});

const reviewSchema = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().min(4).max(2000) });

catalogRouter.post('/products/:id/reviews', requireAuth, async (req, res) => {
  const productId = parseId(req.params.id);
  const body = reviewSchema.parse(req.body);
  const product = await prisma.product.findFirst({ where: { id: productId, isPublished: true } });
  if (!product) throw new HttpError(404, 'Product not found', 'NOT_FOUND');
  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.review.create({ data: { userId: req.auth!.id, productId, ...body } });
    const stats = await tx.review.aggregate({ where: { productId, isApproved: true }, _avg: { rating: true }, _count: true });
    await tx.product.update({ where: { id: productId }, data: { rating: stats._avg.rating ?? 0, reviewCount: stats._count } });
    return created;
  });
  res.status(201).json(review);
});
