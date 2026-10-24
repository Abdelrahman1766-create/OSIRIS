import { useEffect, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUpRight, BadgeCheck, Camera, Compass, Gem, MapPin, Send, ShieldCheck, Sparkles, Truck, WandSparkles } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import FragranceInquiryBanner from '../components/FragranceInquiryBanner'
import ProductCard from '../components/ProductCard'
import { CONTACT, telegramUrl } from '../config/contact'
import { api, getProducts } from '../services/api'
import type { Product } from '../types'
import { localized } from '../types'
import './Home.css'

const reveal = {
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.7, ease: 'easeOut' as const },
}

interface PublicReview { id: string; rating: number; comment: string; createdAt: string; user?: { name: string } }

export default function Home() {
  const { t, i18n } = useTranslation()
  const reduceMotion = useReducedMotion()
  const [effectsPaused, setEffectsPaused] = useState(false)
  const [liveProducts, setLiveProducts] = useState<Product[] | null>(null)
  const [reviews, setReviews] = useState<PublicReview[]>([])

  useEffect(() => {
    const syncVisibility = () => setEffectsPaused(document.hidden)
    document.addEventListener('visibilitychange', syncVisibility)
    return () => document.removeEventListener('visibilitychange', syncVisibility)
  }, [])

  useEffect(() => {
    let active = true
    getProducts({ limit: 24 }).then(({ items }) => {
      if (active) setLiveProducts(items)
    }).catch(() => { if (active) setLiveProducts([]) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!liveProducts) return
    let active = true
    const reviewed = liveProducts.filter((product) => product.reviewCount > 0).slice(0, 4)
    Promise.allSettled(reviewed.map((product) => api<PublicReview[]>(`/products/${product.id}/reviews`))).then((results) => {
      if (active) setReviews(results.flatMap((result) => result.status === 'fulfilled' ? result.value : []).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 2))
    })
    return () => { active = false }
  }, [liveProducts])

  const products = liveProducts ?? []
  const pyramids = products.find((product) => product.slug === 'pyramids')
  const rankedProducts = [...products].sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
  const featuredProducts = pyramids
    ? [pyramids, ...rankedProducts.filter((product) => product.id !== pyramids.id)].slice(0, 4)
    : rankedProducts.slice(0, 4)
  const newArrivals = [...products].sort((a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0)).slice(0, 2)
  const recommended = [...products].sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 2)
  const instagramUrl = /^https:\/\/(www\.)?instagram\.com\//i.test(CONTACT.instagram) ? CONTACT.instagram : ''
  const categories = [
    { key: 'men', gender: 'MEN', image: '/products/blue-seduction.jpg' },
    { key: 'women', gender: 'WOMEN', image: '/products/anna-sui-fantasia.jpg' },
    { key: 'unisex', gender: 'UNISEX', image: '/products/arabian-knight-1.jpg' },
  ]

  return (
    <div className={`home-page ${effectsPaused ? 'is-paused' : ''}`}>
      {!reduceMotion && <div className="home-page-atmosphere" aria-hidden="true">
        <span className="home-atmosphere-glow" />
        <div className="home-atmosphere-mist"><span /><span /></div>
        <div className="home-background-embers">
          {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
        </div>
      </div>}
      <FragranceInquiryBanner />
      <section className={`home-hero ${effectsPaused ? 'is-paused' : ''}`} aria-labelledby="home-hero-title">
        <motion.div
          className="home-hero-media"
          initial={reduceMotion ? false : { opacity: 0, scale: 1.025 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
          aria-hidden="true"
        >
          <div className="home-hero-direction">
            <motion.img
              className="home-hero-image"
              src="/products/pyramids-scent-of-the-pharaohs.png"
              alt=""
              width="1672"
              height="941"
              fetchPriority="high"
              decoding="async"
              animate={reduceMotion || effectsPaused ? undefined : { scale: [1, 1.024, 1.006], x: [0, -4, 2], y: [0, -2, 1] }}
              transition={{ duration: 28, delay: 1.8, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' }}
            />
          </div>
        </motion.div>
        <motion.div
          className="home-hero-bottle-light"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.88, y: -22 }}
          animate={reduceMotion ? { opacity: 0.42, scale: 1, y: 0 } : { opacity: [0, 0.58, 0.42], scale: 1, y: 0 }}
          transition={{ duration: 2.4, delay: reduceMotion ? 0 : 0.45, ease: 'easeOut' }}
          aria-hidden="true"
        />
        <div className="home-hero-shade" />
        {!reduceMotion && <div className="home-hero-fx" aria-hidden="true">
          <div className="home-scene-atmosphere">
            <span className="home-ritual-relief" />
            <span className="home-firelight home-firelight-high" />
            <span className="home-firelight home-firelight-low" />
            <span className="home-temple-haze" />
          </div>
          <div className="home-spray-atmosphere"><span /><span /></div>
          <div className="home-perfume-spray">{Array.from({ length: 14 }, (_, index) => <i key={index} />)}</div>
          <span className="home-bottle-glow" />
          <span className="home-sunset-flare" />
          <span className="home-gold-shimmer" />
        </div>}
        <div className="home-particles" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
        </div>
        <div className="home-hero-content page-shell">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="home-eyebrow"><span className="home-eyebrow-line" />{t('home.brandHeroEyebrow')}</div>
            <h1 id="home-hero-title" className="home-hero-title home-brand-title">
              <span>{t('home.brandHeroTitle')}</span>
              <em>{t('home.brandHeroHighlight')}</em>
            </h1>
            <div className="home-hero-subtitle home-brand-description">
              <p>{t('home.brandHeroBody1')}</p>
              <p>{t('home.brandHeroBody2')}</p>
            </div>
            <p className="home-hero-closing">{t('home.brandHeroClosing')}</p>
            <div className="home-hero-actions">
              <Link className="gold-button home-hero-primary" to="/shop">
                {t('home.brandHeroPrimaryCta')} <ArrowUpRight size={17} strokeWidth={1.7} />
              </Link>
              <a className="home-text-link" href="#story">
                {t('home.brandHeroSecondaryCta')} <ArrowRight size={18} strokeWidth={1.4} />
              </a>
            </div>
          </motion.div>
        </div>
        <div className="home-hero-bottom page-shell">
          <span>01 <span className="home-page-count-rule" /> 05</span>
          <a href="#pyramids-feature" aria-label={t('home.pyramidsFeatureTitle')}><ArrowDown size={18} strokeWidth={1.3} /></a>
          <span>{t('home.signatureLabel')}</span>
        </div>
      </section>

      <div className="home-promise-strip">
        <div className="page-shell home-promise-inner">
          <div><Gem size={23} strokeWidth={1.3} /><span>{t('home.promise1')}</span></div>
          <div><Truck size={23} strokeWidth={1.3} /><span>{t('home.promise2')}</span></div>
          <div><ShieldCheck size={23} strokeWidth={1.3} /><span>{t('home.promise3')}</span></div>
        </div>
      </div>

      {pyramids && <section id="pyramids-feature" className="home-pyramids-feature" aria-labelledby="home-pyramids-feature-title">
        <div className="page-shell home-pyramids-feature-grid">
          <motion.div {...reveal} className="home-pyramids-feature-visual">
            <span className="home-pyramids-feature-halo" aria-hidden="true" />
            <img src={pyramids.mainImage} alt={localized(pyramids.name, i18n.language)} loading="eager" decoding="async" />
          </motion.div>
          <motion.div {...reveal} className="home-pyramids-feature-copy">
            <span className="home-kicker">{t('home.pyramidsFeatureEyebrow')}</span>
            <div className="home-pyramids-badges">
              <span>{t('home.pyramidsBadgeShort')}</span>
              <span>{t('home.pyramidsExclusiveBadge')}</span>
            </div>
            <h2 id="home-pyramids-feature-title">PYRAMIDS</h2>
            <strong>{t('home.pyramidsHeroPhrase')}</strong>
            <p>{t('home.pyramidsFeatureCopy')}</p>
            <p className="home-pyramids-notes"><small>{t('home.pyramidsNotesLabel')}</small>{t('home.pyramidsNotes')}</p>
            <Link className="gold-button" to="/product/pyramids">{t('home.openPyramids')} <ArrowUpRight size={17} /></Link>
          </motion.div>
        </div>
      </section>}

      <section id="bestsellers" className="home-section home-products-section page-shell">
        <motion.div {...reveal} className="home-section-top">
          <div>
            <span className="home-kicker">01 / {t('home.signatureLabel')}</span>
            <h2>{t('home.featuredFragrances')}</h2>
            <p>{t('home.featuredFragrancesSubtitle')}</p>
          </div>
          <Link className="home-section-link" to="/shop">{t('home.viewAll')} <ArrowUpRight size={18} /></Link>
        </motion.div>
        <motion.div {...reveal} className="product-grid home-product-grid">
          {featuredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
        </motion.div>
        {featuredProducts.length === 0 && <div className="empty-state">{t('common.empty')}</div>}
      </section>

      <section className="home-section home-categories page-shell" aria-labelledby="home-categories-title">
        <motion.div {...reveal} className="home-centered-heading">
          <span className="home-kicker">{t('home.shopByStyleEyebrow')}</span>
          <h2 id="home-categories-title">{t('home.shopByStyleTitle')}</h2>
          <p>{t('home.shopByStyleCopy')}</p>
        </motion.div>
        <div className="home-category-grid">
          {categories.map(({ key, gender, image }, index) => (
            <motion.div {...reveal} className="home-category-card" key={gender}>
              <img src={image} alt="" loading="lazy" />
              <div className="home-category-overlay" />
              <span className="home-category-index">0{index + 1}</span>
              <div className="home-category-content">
                <h3>{t(`catalog.${key}`)}</h3>
                <Link to={`/shop?gender=${gender}`} aria-label={`${t('home.categoryDiscover')}: ${t(`catalog.${key}`)}`}>
                  {t('home.categoryDiscover')} <ArrowUpRight size={17} />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="home-collection" aria-labelledby="home-collection-title">
        <img src="/products/madawi-gold.jpg" alt="" loading="lazy" />
        <div className="home-collection-shade" />
        <div className="page-shell home-collection-shell">
          <motion.div {...reveal} className="home-collection-content">
            <span className="home-kicker">02 / {t('home.luxuryEyebrow')}</span>
            <h2 id="home-collection-title">{t('home.luxuryTitle')}</h2>
            <span className="home-gold-rule" />
            <p>{t('home.luxuryCopy')}</p>
            <Link to="/shop" className="outline-button">{t('home.exploreLuxury')} <ArrowUpRight size={17} /></Link>
          </motion.div>
        </div>
      </section>

      <section className="home-finder" aria-labelledby="home-finder-title">
        <div className="page-shell home-finder-grid">
          <motion.div {...reveal} className="home-finder-copy">
            <span className="home-kicker">{t('home.finderEyebrow')}</span>
            <h2 id="home-finder-title">{t('home.finderTitle')}</h2>
            <p>{t('home.finderCopy')}</p>
            <Link className="gold-button" to="/fragrance-finder">{t('home.finderCta')} <ArrowUpRight size={17} /></Link>
          </motion.div>
          <motion.div {...reveal} className="home-finder-art" aria-hidden="true">
            <div className="home-finder-orbit home-finder-orbit-one" />
            <div className="home-finder-orbit home-finder-orbit-two" />
            <img src="/products/kirke.jpg" alt="" loading="lazy" />
            <span className="home-finder-spark"><WandSparkles size={27} strokeWidth={1.2} /></span>
          </motion.div>
        </div>
      </section>

      <section className="home-section home-products-section page-shell">
        <motion.div {...reveal} className="home-section-top">
          <div>
            <span className="home-kicker">03 / {t('home.signatureLabel')}</span>
            <h2>{t('home.newArrivals')}</h2>
            <p>{t('home.newArrivalsSubtitle')}</p>
          </div>
          <Link className="home-section-link" to="/shop">{t('home.viewAll')} <ArrowUpRight size={18} /></Link>
        </motion.div>
        <motion.div {...reveal} className="product-grid home-product-grid home-product-grid-small">
          {newArrivals.map((product) => <ProductCard key={product.id} product={product} />)}
        </motion.div>
        {newArrivals.length === 0 && <div className="empty-state">{t('common.empty')}</div>}
      </section>

      <section id="story" className="home-story">
        <div className="page-shell home-story-grid">
          <motion.div {...reveal} className="home-story-visual">
            <div className="home-story-image-frame"><img src="/products/crystal-love.jpg" alt="" loading="lazy" /></div>
            <div className="home-story-seal"><Sparkles size={18} strokeWidth={1.2} /><span>OSIRIS</span></div>
          </motion.div>
          <motion.div {...reveal} className="home-story-content">
            <span className="home-kicker">04 / {t('home.storyEyebrow')}</span>
            <h2>{t('home.storyTitle')}</h2>
            <span className="home-gold-rule" />
            <p>{t('home.storyCopy')}</p>
            <Link className="home-section-link" to="/shop">{t('home.storyLink')} <ArrowUpRight size={18} /></Link>
          </motion.div>
        </div>
      </section>

      <section className="home-section home-why page-shell" aria-labelledby="home-why-title">
        <motion.div {...reveal} className="home-centered-heading">
          <span className="home-kicker">{t('home.whyEyebrow')}</span>
          <h2 id="home-why-title">{t('home.whyTitle')}</h2>
        </motion.div>
        <div className="home-why-grid">
          <motion.div {...reveal} className="home-why-card"><Gem size={27} strokeWidth={1.2} /><span>01</span><h3>{t('home.why1Title')}</h3><p>{t('home.why1Copy')}</p></motion.div>
          <motion.div {...reveal} className="home-why-card"><BadgeCheck size={27} strokeWidth={1.2} /><span>02</span><h3>{t('home.why2Title')}</h3><p>{t('home.why2Copy')}</p></motion.div>
          <motion.div {...reveal} className="home-why-card"><Compass size={27} strokeWidth={1.2} /><span>03</span><h3>{t('home.why3Title')}</h3><p>{t('home.why3Copy')}</p></motion.div>
        </div>
      </section>

      <section className="home-section home-products-section page-shell">
        <motion.div {...reveal} className="home-section-top">
          <div>
            <span className="home-kicker">05 / {t('home.signatureLabel')}</span>
            <h2>{t('home.recommended')}</h2>
            <p>{t('home.recommendedSubtitle')}</p>
          </div>
          <Link className="home-section-link" to="/shop">{t('home.viewAll')} <ArrowUpRight size={18} /></Link>
        </motion.div>
        <motion.div {...reveal} className="product-grid home-product-grid home-product-grid-small">
          {recommended.map((product) => <ProductCard key={product.id} product={product} />)}
        </motion.div>
        {recommended.length === 0 && <div className="empty-state">{t('common.empty')}</div>}
      </section>

      <section className="home-kazan">
        <div className="page-shell home-kazan-grid">
          <motion.div {...reveal} className="home-kazan-art" aria-hidden="true">
            <div className="home-kazan-ring home-kazan-ring-one" />
            <div className="home-kazan-ring home-kazan-ring-two" />
            <div className="home-kazan-ring home-kazan-ring-three" />
            <MapPin size={50} strokeWidth={1} />
            <strong>KAZAN</strong>
            <span>55°47′ N&nbsp;&nbsp;49°06′ E</span>
          </motion.div>
          <motion.div {...reveal} className="home-kazan-copy">
            <span className="home-kicker">{t('home.kazanEyebrow')}</span>
            <h2>{t('home.kazanTitle')}</h2>
            <p>{t('home.kazanCopy')}</p>
            <span className="home-kazan-meta"><MapPin size={17} strokeWidth={1.4} />{t('home.kazanMeta')}</span>
            <Link className="home-section-link" to="/#contact">{t('home.kazanCta')} <ArrowUpRight size={18} /></Link>
          </motion.div>
        </div>
      </section>

      <section className="home-testimonials">
        <div className="page-shell">
          <motion.div {...reveal} className="home-testimonials-heading">
            <span className="home-kicker">{t('home.testimonialsEyebrow')}</span>
            <h2>{t('home.testimonialsTitle')}</h2>
          </motion.div>
          {reviews.length ? <div className="home-testimonial-grid">
            {reviews.map((review) => (
              <motion.blockquote {...reveal} className="home-testimonial" key={review.id}>
                <div className="home-stars" aria-label={`${review.rating}/5`}>{'★'.repeat(review.rating)}</div>
                <p>“{review.comment}”</p>
                <footer><span className="home-testimonial-line" /> {review.user?.name || t('home.reviewAnonymous')}</footer>
              </motion.blockquote>
            ))}
          </div> : <p className="home-reviews-empty">{t('product.noReviews')}</p>}
        </div>
      </section>

      <section className="home-section home-social page-shell" aria-labelledby="home-social-title">
        <motion.div {...reveal} className="home-section-top">
          <div>
            <span className="home-kicker">{t('home.socialEyebrow')}</span>
            <h2 id="home-social-title">{t('home.socialTitle')}</h2>
            <p>{t('home.socialCopy')}</p>
          </div>
          {instagramUrl && <a className="home-section-link" href={instagramUrl} target="_blank" rel="noopener noreferrer"><Camera size={17} />{t('home.socialCta')} <ArrowUpRight size={17} /></a>}
        </motion.div>
        <div className="home-social-grid">
          {['/products/hayati.jpg', '/products/nefertiti-chabrawichi.jpg', '/products/blue-seduction.jpg', '/products/anna-sui-fantasia.jpg'].map((image, index) => <motion.div {...reveal} className="home-social-tile" key={image}><img src={image} alt="" loading="lazy" /><span>0{index + 1} / OSIRIS</span></motion.div>)}
        </div>
        {!instagramUrl && <p className="home-social-pending">{t('home.socialPending')}</p>}
      </section>

      <section className="home-telegram" aria-labelledby="home-telegram-title">
        <motion.div {...reveal} className="page-shell home-telegram-inner">
          <span className="home-telegram-symbol"><Send size={28} strokeWidth={1.2} /></span>
          <span className="home-kicker">{t('home.telegramEyebrow')}</span>
          <h2 id="home-telegram-title">{t('home.telegramTitle')}</h2>
          <p>{t('home.telegramCopy')}</p>
          {CONTACT.telegram
            ? <a className="gold-button" href={telegramUrl()} target="_blank" rel="noopener noreferrer">{t('home.telegramCta')} <ArrowUpRight size={17} /></a>
            : <span className="home-telegram-pending">{t('home.telegramPending')}</span>}
        </motion.div>
      </section>

      <section className="home-contact">
        <div className="home-contact-halo" aria-hidden="true" />
        <motion.div {...reveal} className="page-shell home-contact-inner">
          <span className="home-kicker">{t('home.contactEyebrow')}</span>
          <h2>{t('home.contactTitle')}</h2>
          <p>{t('home.contactCopy')}</p>
          <Link className="gold-button" to="/#contact">{t('home.contactButton')} <ArrowUpRight size={18} /></Link>
        </motion.div>
      </section>
    </div>
  )
}
