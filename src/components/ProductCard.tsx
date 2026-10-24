import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Heart, Plus, Star } from 'lucide-react'
import type { Product } from '../types'
import { localized, money } from '../types'
import { useStore } from '../store/useStore'

export default function ProductCard({ product }: { product: Product }) {
  const { t, i18n } = useTranslation()
  const favorites = useStore((s) => s.favorites)
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const hasPrice = product.sellingPrice > 0
  const isPyramids = product.slug === 'pyramids'
  return <article className={`product-card ${isPyramids ? 'product-card-flagship' : ''}`}>
    <div className="product-card-image-wrap">
      <Link to={`/product/${product.slug}`} aria-label={localized(product.name, i18n.language)}><img src={product.mainImage} alt={localized(product.name, i18n.language)} loading="lazy" decoding="async" /></Link>
      <span className="product-card-tag">{t(isPyramids ? 'product.originalOsiris' : 'common.featured')}</span>
      <button type="button" className={`product-favorite ${favorites.includes(product.id) ? 'is-active' : ''}`} onClick={() => toggleFavorite(product.id)} aria-label={t('nav.favorites')}><Heart size={18} fill={favorites.includes(product.id) ? 'currentColor' : 'none'} /></button>
      <Link className="quick-add" to={`/product/${product.slug}`} aria-label={t(hasPrice ? 'product.chooseSize' : 'common.viewDetails')}><Plus size={18} /><span>{t(hasPrice ? 'product.chooseSize' : 'common.viewDetails')}</span></Link>
    </div>
    <div className="product-card-meta"><span>OSIRIS</span>{product.reviewCount > 0 && <span><Star size={12} fill="currentColor" /> {product.rating.toFixed(1)}</span>}</div>
    <Link to={`/product/${product.slug}`} className="product-card-name">{localized(product.name, i18n.language)}</Link>
    {isPyramids
      ? <span className="product-card-reference product-card-exclusive">{t('product.onlyAtOsiris')}</span>
      : product.inspirationName && <span className="product-card-reference">{t('product.inspiredBy', { name: product.inspirationName })}</span>}
    <div className="product-card-bottom"><span>{hasPrice ? `${t('product.fromPrice')} ${money(product.sellingPrice, i18n.language)}` : t('product.pricePending')}</span><span>{t(`catalog.${product.gender.toLowerCase()}`)}</span></div>
  </article>
}
