import type { Product } from '../types'
import { localized } from '../types'
import { usePageSeo } from '../hooks/usePageSeo'

export default function ProductSeo({ product, language }: { product: Product; language: string }) {
  const locale = language.slice(0, 2) as 'ru' | 'en' | 'ar'
  const name = localized(product.name, language)
  const description = localized(product.description, language).replace(/\s+/g, ' ').slice(0, 180)
  const origin = (import.meta.env.VITE_SITE_URL?.trim() || window.location.origin).replace(/\/$/, '')
  const url = new URL(`/product/${encodeURIComponent(product.slug)}`, `${origin}/`).href
  const image = new URL(product.mainImage, `${origin}/`).href
  const active = product.variants?.filter((variant) => variant.isActive !== false && variant.sellingPrice > 0) || []
  const offers = active.length
    ? active.map((variant) => ({
      '@type': 'Offer',
      name: `${variant.sizeMl} ml`,
      price: variant.sellingPrice,
      priceCurrency: 'RUB',
      availability: variant.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url,
    }))
    : []

  usePageSeo({
    title: name,
    description,
    canonicalPath: `/product/${product.slug}`,
    imagePath: product.mainImage,
    type: 'product',
    locale,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name,
      description,
      image: [image],
      brand: { '@type': 'Brand', name: 'OSIRIS' },
      ...(offers.length > 0 && { offers }),
      ...(product.reviewCount > 0 && { aggregateRating: {
        '@type': 'AggregateRating', ratingValue: product.rating, reviewCount: product.reviewCount,
      } }),
    },
  })
  return null
}
