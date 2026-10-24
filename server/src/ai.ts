import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from './auth.js';
import { publicProduct, publicProductInclude } from './catalog.js';
import { prisma } from './db.js';
import { HttpError } from './http.js';

/** Replace this adapter with a model-backed implementation without changing HTTP clients. */
export interface PerfumeAdvisor {
  recommend(input: RecommendationInput): Promise<unknown>;
  marketingDraft(input: MarketingInput): Promise<unknown>;
}

const recommendationSchema = z.object({
  recipient: z.enum(['men', 'women', 'unisex', 'gift']),
  fragranceStyle: z.enum(['floral', 'woody', 'oriental', 'fresh', 'any']),
  sweetOrFresh: z.enum(['sweet', 'fresh', 'balanced']),
  timeOfDay: z.enum(['day', 'evening', 'any']),
  occasion: z.enum(['everyday', 'work', 'date', 'event', 'gift']),
  budget: z.number().positive().max(1000000),
  intensity: z.enum(['light', 'moderate', 'bold']),
});
type RecommendationInput = z.infer<typeof recommendationSchema>;

const marketingSchema = z.object({
  productId: z.string().uuid(),
  language: z.enum(['en', 'ar', 'ru']),
  channel: z.enum(['instagram', 'facebook', 'seo']),
});
type MarketingInput = z.infer<typeof marketingSchema>;

export const aiRouter = Router();

aiRouter.post('/recommendations', async (req, res) => {
  const input = recommendationSchema.parse(req.body);
  const gender = input.recipient === 'men' ? ['MEN', 'UNISEX'] as const
    : input.recipient === 'women' ? ['WOMEN', 'UNISEX'] as const
      : ['MEN', 'WOMEN', 'UNISEX'] as const;
  const products = await prisma.product.findMany({
    where: { isPublished: true, supplier: { isApproved: true }, variants: { some: { isActive: true, currency: 'RUB', sellingPrice: { lte: input.budget } } }, gender: { in: [...gender] } },
    include: publicProductInclude,
    take: 100,
  });
  const ranked = products.map((product) => {
    const category = product.category.toLowerCase();
    const notes = [...product.topNotes, ...product.middleNotes, ...product.baseNotes].join(' ').toLowerCase();
    const sweet = /vanilla|amber|tonka|honey|caramel|rose|oud/.test(notes);
    const fresh = /citrus|bergamot|neroli|lemon|mint|sea|grapefruit/.test(notes);
    let score = product.rating + (product.isFeatured ? 1 : 0);
    const reasons: string[] = [];
    if (input.fragranceStyle !== 'any' && category.includes(input.fragranceStyle)) { score += 5; reasons.push('style'); }
    if (input.sweetOrFresh === 'sweet' && sweet || input.sweetOrFresh === 'fresh' && fresh) { score += 3; reasons.push('notes'); }
    if (input.timeOfDay === 'day' && /fresh|floral/.test(category) || input.timeOfDay === 'evening' && /oriental|woody/.test(category)) { score += 2; reasons.push('time'); }
    if (input.intensity === 'light' && /fresh|floral/.test(category) || input.intensity === 'bold' && /oriental|woody/.test(category)) score += 2;
    if (input.occasion === 'date' && /floral|oriental/.test(category) || input.occasion === 'work' && /fresh|woody/.test(category) || input.occasion === 'event' && /oriental|woody/.test(category)) score += 2;
    const affordable = product.variants.filter((variant) => Number(variant.sellingPrice) <= input.budget).sort((a, b) => Number(a.sellingPrice) - Number(b.sellingPrice));
    return { score, product, recommendedVariantId: affordable[0]?.id, reason: reasons.length ? reasons.join(', ') : 'matches your budget' };
  }).sort((a, b) => b.score - a.score || Number(a.product.sellingPrice) - Number(b.product.sellingPrice)).slice(0, 6);
  res.json({ source: 'rules', currency: 'RUB', items: ranked.map(({ score, product, recommendedVariantId, reason }) => ({ product: publicProduct(product), score, recommendedVariantId, reason })) });
});

aiRouter.post('/marketing/draft', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const input = marketingSchema.parse(req.body);
  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product) throw new HttpError(404, 'Product not found', 'NOT_FOUND');
  const name = input.language === 'ar' ? product.nameAr : input.language === 'ru' ? product.nameRu : product.nameEn;
  const description = input.language === 'ar' ? product.descriptionAr : input.language === 'ru' ? product.descriptionRu : product.descriptionEn;
  const title = input.language === 'ar' ? `اكتشف ${name}` : input.language === 'ru' ? `Откройте для себя ${name}` : `Discover ${name}`;
  const copy = `${title}. ${description}`;
  res.json({ source: 'template', channel: input.channel, language: input.language, title, copy, keywords: [name, product.brand, product.category, ...product.topNotes].slice(0, 8) });
});
