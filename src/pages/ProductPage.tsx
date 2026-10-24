import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, Heart, Minus, Plus, Star } from 'lucide-react'
import ProductCard from '../components/ProductCard'
import ProductSeo from '../components/ProductSeo'
import LoadingScreen from '../components/LoadingScreen'
import { CONTACT, whatsappUrl } from '../config/contact'
import { api, getProduct, getProducts } from '../services/api'
import { useStore } from '../store/useStore'
import type { Product } from '../types'
import { localized, money } from '../types'

interface Review { id: string; rating: number; comment: string; createdAt: string; isApproved?: boolean; user?: { name: string } }

export default function ProductPage() {
  const { slug } = useParams()
  const { t, i18n } = useTranslation()
  const [product, setProduct] = useState<Product | null>(null)
  const [selectedImage, setSelectedImage] = useState('')
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [reviews, setReviews] = useState<Review[]>([])
  const [related, setRelated] = useState<Product[]>([])
  const [reviewText, setReviewText] = useState('')
  const [rating, setRating] = useState(5)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const reduceMotion = useReducedMotion()
  const addToCart = useStore((s) => s.addToCart)
  const favorites = useStore((s) => s.favorites)
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const user = useStore((s) => s.user)

  useEffect(() => {
    let active = true
    if (!slug) return
    getProduct(slug).then((data) => { if (active) { setProduct(data); setSelectedImage(data.mainImage); setSelectedVariantId(data.variants.find((item) => item.stock > 0)?.id || data.variants[0]?.id || '') } })
      .catch(() => { if (active) setProduct(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [slug])

  useEffect(() => {
    if (!product) return
    api<Review[]>(`/products/${product.id}/reviews`).then(setReviews).catch(() => {})
  }, [product])

  useEffect(() => {
    if (!product) return
    let active = true
    getProducts({ category: product.category, limit: 4 }).then((data) => {
      if (active) setRelated(data.items.filter((item) => item.id !== product.id).slice(0, 3))
    }).catch(() => { if (active) setRelated([]) })
    return () => { active = false }
  }, [product])

  async function submitReview(event: React.FormEvent) {
    event.preventDefault()
    if (!product) return
    try {
      const review = await api<Review>(`/products/${product.id}/reviews`, { method: 'POST', body: JSON.stringify({ rating, comment: reviewText }) })
      if (review.isApproved) setReviews((current) => [review, ...current])
      setReviewText(''); setMessage(t(review.isApproved ? 'common.success' : 'product.reviewPending'))
    } catch (error) { setMessage(error instanceof Error ? error.message : t('common.error')) }
  }

  if (loading) return <LoadingScreen />
  if (!product) return <div className="page-shell empty-state"><h1>{t('product.notFound')}</h1><Link className="gold-button" to="/shop">{t('product.backToCollection')}</Link></div>
  const name = localized(product.name, i18n.language)
  const family = product.family ? localized(product.family, i18n.language) : t(`categories.${product.category}`, { defaultValue: product.category })
  const isPyramids = product.slug === 'pyramids'
  const selectedVariant = product.variants.find((item) => item.id === selectedVariantId) || product.variants[0]
  const isOrderable = Boolean(selectedVariant?.isActive !== false && selectedVariant?.sellingPrice && selectedVariant.stock > 0)
  const relatedProducts = related
  const lang = i18n.language.slice(0, 2) as 'en' | 'ar' | 'ru'
  const noteLine = (part: 'top' | 'middle' | 'base', fallback: string[]) => {
    const notes = product.localizedNotes?.[part]?.[lang] || fallback
    return notes.length ? notes.join(' · ') : '—'
  }
  const images = Array.from(new Set([product.mainImage, ...product.gallery].filter(Boolean)))
  const whatsapp = whatsappUrl(isOrderable
    ? t('contact.whatsappMessage', { product: `${name} · ${selectedVariant?.sizeMl} ml`, quantity, price: money(selectedVariant!.sellingPrice * quantity, i18n.language) })
    : t('product.inquiryMessage', { product: name }))

  return <div className={`page-shell product-page ${isPyramids ? 'product-page-flagship' : ''}`}>
    <ProductSeo product={product} language={i18n.language} />
    <Link to="/shop" className="breadcrumb"><ChevronLeft size={16} />{t('product.backToCollection')}</Link>
    <div className="product-detail-grid">
      <div className="product-gallery">
        <motion.div className="product-main-image" whileHover={reduceMotion ? undefined : { scale: 1.008 }} transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}>
          <span className="product-spotlight" aria-hidden="true" />
          <motion.img
            key={selectedImage || product.mainImage}
            src={selectedImage || product.mainImage}
            alt={name}
            loading="eager"
            decoding="async"
            sizes="(max-width: 700px) 100vw, 50vw"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, rotateY: -2, scale: 0.985 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: [0, -5, 0], rotateY: [-2.25, 2.25, -2.25], rotateZ: [-0.08, 0.08, -0.08], scale: 1 }}
            whileHover={reduceMotion ? undefined : { scale: 1.018, rotateY: 3.5 }}
            transition={reduceMotion ? { opacity: { duration: 0.25 } } : {
              opacity: { duration: 0.5, ease: 'easeOut' },
              scale: { duration: 0.75, ease: [0.22, 1, 0.36, 1] },
              y: { duration: 9, repeat: Infinity, ease: 'easeInOut' },
              rotateY: { duration: 11, repeat: Infinity, ease: 'easeInOut' },
              rotateZ: { duration: 11, repeat: Infinity, ease: 'easeInOut' },
            }}
          />
        </motion.div>
        {images.length > 1 && <div className="product-thumbnails">{images.map((src, index) => <button type="button" key={src} className={selectedImage === src ? 'active' : ''} aria-label={`${name} · ${index + 1}`} aria-pressed={selectedImage === src} onClick={() => setSelectedImage(src)}><img src={src} alt="" loading="lazy" decoding="async" /></button>)}</div>}
      </div>
      <div className="product-detail-content"><span className="eyebrow">OSIRIS · {family}</span><h1>{name}</h1>{isPyramids
        ? <div className="product-original-badges"><span>{t('product.originalOsiris')}</span><span>{t('product.onlyAtOsiris')}</span></div>
        : product.inspirationName && <p className="scent-reference">{t('product.inspiredBy', { name: product.inspirationName })}</p>}{product.reviewCount > 0 && <div className="rating-line"><Star size={16} fill="currentColor" /> {product.rating.toFixed(1)} <span className="muted">({product.reviewCount} {t('product.reviews').toLowerCase()})</span></div>}<div className="product-attributes"><span><small>{t('product.genderLabel')}</small><strong>{t(`catalog.${product.gender.toLowerCase()}`)}</strong></span><span><small>{t('product.fragranceFamily')}</small><strong>{family}</strong></span></div><p className="product-size">{t('product.chooseSize')}</p><div className="variant-options" role="group" aria-label={t('product.chooseSize')}>{product.variants.map((variant) => <button type="button" key={variant.id} className={variant.id === selectedVariant?.id && variant.isActive !== false ? 'selected' : ''} disabled={variant.isActive === false || variant.sellingPrice <= 0 || variant.stock < 1} onClick={() => { setSelectedVariantId(variant.id); setQuantity(1) }}><strong>{variant.sizeMl} {t('product.ml')}</strong><small>{variant.sellingPrice > 0 ? money(variant.sellingPrice, i18n.language) : t('product.pricePending')}</small></button>)}</div><p className="product-price">{product.sellingPrice > 0 ? money(selectedVariant?.sellingPrice || product.sellingPrice, i18n.language) : t('product.pricePending')}</p>{isPyramids && <p className="product-original-statement">{t('product.createdByOsiris')}</p>}<p className="product-description">{localized(product.description, i18n.language)}</p>
        {!isPyramids && product.inspirationName && <p className="scent-disclosure">{t('product.independentNote')}</p>}
        <div className="product-buy">{product.sellingPrice > 0 && <><div className="quantity-control"><button onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label={t('common.decreaseQuantity')}><Minus size={16} /></button><span>{quantity}</span><button onClick={() => setQuantity(Math.min(Math.max(selectedVariant?.stock || 0, 1), quantity + 1))} aria-label={t('common.increaseQuantity')}><Plus size={16} /></button></div><button className="gold-button" disabled={!isOrderable} onClick={() => { if (isOrderable && selectedVariant) { addToCart(product, selectedVariant, quantity); setMessage(t('product.added')) } }}>{t('common.addToBag')}</button></>}<button className={`outline-button favorite-button ${favorites.includes(product.id) ? 'active' : ''}`} aria-label={t('nav.favorites')} onClick={() => toggleFavorite(product.id)}><Heart size={20} fill={favorites.includes(product.id) ? 'currentColor' : 'none'} /></button></div>
        {message && <p className="inline-message" role="status">{message}</p>}
        {CONTACT.whatsapp && <a className="whatsapp-order-link" href={whatsapp} target="_blank" rel="noopener noreferrer">{t(isOrderable ? 'cart.whatsapp' : 'common.contactUs')} ↗</a>}
        <p className="stock-text">{isOrderable ? t('common.inStock') : t('common.outOfStock')}</p>
      </div>
    </div>
    <section className="product-story"><div><span className="eyebrow">{t('product.description')}</span><h2>{isPyramids ? t('product.pyramidsStoryTitle') : t('product.scentCharacter')}</h2>{isPyramids && <strong className="product-story-signature">{t('product.createdByOsiris')}</strong>}<p>{localized(product.description, i18n.language)}</p>{isPyramids && <p className="product-original-copy">{t('product.pyramidsOriginalCopy')}</p>}</div><div className="notes-panel"><span className="eyebrow">{t('product.notes')}</span><div className="notes-row"><strong>{product.middleNotes.length || product.baseNotes.length ? t('product.topNotes') : t('product.profile')}</strong><span>{noteLine('top', product.topNotes)}</span></div>{product.middleNotes.length > 0 && <div className="notes-row"><strong>{t('product.middleNotes')}</strong><span>{noteLine('middle', product.middleNotes)}</span></div>}{product.baseNotes.length > 0 && <div className="notes-row"><strong>{t('product.baseNotes')}</strong><span>{noteLine('base', product.baseNotes)}</span></div>}</div></section>
    <section className="reviews-section"><div className="section-heading"><div><span className="eyebrow">{t('product.reviews')}</span><h2>{t('product.reviews')}</h2></div></div>{reviews.length ? <div className="reviews-grid">{reviews.map((review) => <div className="review-card" key={review.id}><div className="stars">{'★'.repeat(review.rating)}</div><p>{review.comment}</p><span>{review.user?.name || 'Customer'}</span></div>)}</div> : <p className="muted">{t('product.noReviews')}</p>}
      {user ? <form className="review-form" onSubmit={submitReview}><h3>{t('product.writeReview')}</h3><label>{t('product.rating')}<select value={rating} onChange={(event) => setRating(Number(event.target.value))}>{[5, 4, 3, 2, 1].map((number) => <option key={number} value={number}>{number} ★</option>)}</select></label><textarea required minLength={10} value={reviewText} onChange={(event) => setReviewText(event.target.value)} placeholder={t('product.reviewPlaceholder')} /><button className="gold-button" type="submit">{t('product.submitReview')}</button></form> : <Link className="text-button" to="/login">{t('product.reviewLogin')}</Link>}
    </section>
    {relatedProducts.length > 0 && <section className="related-section"><div className="section-heading"><h2>{t('product.related')}</h2><Link to="/shop">{t('common.viewAll')} ↗</Link></div><div className="product-grid">{relatedProducts.map((item) => <ProductCard key={item.id} product={item} />)}</div></section>}
  </div>
}
