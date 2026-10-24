import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import ProductCard from '../components/ProductCard'
import { api, normalizeProduct } from '../services/api'
import type { Product } from '../types'

type Recommendation = { product: Record<string, unknown>; score: number; reason?: string }
type Answers = {
  recipient: 'men' | 'women' | 'unisex' | 'gift'
  fragranceStyle: 'floral' | 'woody' | 'oriental' | 'fresh' | 'any'
  sweetOrFresh: 'sweet' | 'fresh' | 'balanced'
  timeOfDay: 'day' | 'evening' | 'any'
  occasion: 'everyday' | 'work' | 'date' | 'event' | 'gift'
  intensity: 'light' | 'moderate' | 'bold'
  budget: string
}

const fields = [
  ['recipient', ['men', 'women', 'unisex', 'gift']],
  ['fragranceStyle', ['floral', 'woody', 'oriental', 'fresh', 'any']],
  ['sweetOrFresh', ['sweet', 'fresh', 'balanced']],
  ['timeOfDay', ['day', 'evening', 'any']],
  ['occasion', ['everyday', 'work', 'date', 'event', 'gift']],
  ['intensity', ['light', 'moderate', 'bold']],
] as const

export default function AssistantPage() {
  const { t } = useTranslation()
  const [form, setForm] = useState<Answers>({ recipient: 'unisex', fragranceStyle: 'any', sweetOrFresh: 'balanced', timeOfDay: 'any', occasion: 'everyday', intensity: 'moderate', budget: '10000' })
  const [products, setProducts] = useState<Product[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function recommend(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError(''); setProducts(null)
    try {
      const result = await api<{ source: string; items: Recommendation[] }>('/ai/recommendations', { method: 'POST', body: JSON.stringify({ ...form, budget: Number(form.budget) }) })
      setProducts(result.items.map((item) => normalizeProduct(item.product)))
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('common.error')) }
    finally { setLoading(false) }
  }

  return <div className="page-shell assistant-page"><div className="page-intro"><span className="eyebrow">OSIRIS · {t('assistant.eyebrow')}</span><h1>{t('assistant.title')}</h1><p>{t('assistant.subtitle')}</p></div><div className="assistant-layout"><form className="panel assistant-form" onSubmit={recommend}><Sparkles className="assistant-sparkle" size={29} /><h2>{t('assistant.yourPreferences')}</h2>
    {fields.map(([key, options]) => <label key={key} className="form-field"><span>{t(`assistant.${key}`)}</span><select value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })}>{options.map((option) => <option key={option} value={option}>{t(`assistant.options.${option}`)}</option>)}</select></label>)}
    <label className="form-field"><span>{t('assistant.budget')}</span><input type="number" min="1" step="100" required value={form.budget} onChange={(event) => setForm({ ...form, budget: event.target.value })} /></label><button type="submit" className="gold-button" disabled={loading}>{loading ? t('common.loading') : t('assistant.find')}</button><p className="assistant-disclosure">{t('assistant.disclosure')}</p></form>
    <div className="assistant-results">{error && <p className="form-error" role="alert">{error}</p>}{products === null ? <div className="assistant-placeholder"><span>✦</span><h2>{t('assistant.placeholderTitle')}</h2><p>{t('assistant.placeholderCopy')}</p></div> : products.length ? <><div className="section-heading"><span className="eyebrow">{t('assistant.resultsEyebrow')}</span><h2>{t('assistant.resultsTitle')}</h2></div><div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div><p className="assistant-disclosure">{t('assistant.disclosure')}</p></> : <div className="empty-state"><h2>{t('assistant.noResults')}</h2><p>{t('assistant.tryAgain')}</p></div>}</div></div></div>
}
