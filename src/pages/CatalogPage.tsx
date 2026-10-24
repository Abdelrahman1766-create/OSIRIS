import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import ProductCard from '../components/ProductCard'
import { getProducts } from '../services/api'
import type { Product } from '../types'

export default function CatalogPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const gender = params.get('gender') || ''
  const category = params.get('category') || ''
  const sort = params.get('sort') || ''
  const query = params.get('q') || ''

  useEffect(() => {
    let active = true
    getProducts({ q: query, gender, category, sort, limit: 40 }).then((data) => {
      if (!active) return
      setProducts(data.items); setError(false)
    }).catch(() => { if (active) { setProducts([]); setError(true) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query, gender, category, sort])

  const visible = products

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }
  const categories = Array.from(new Set(products.map((product) => product.category).filter(Boolean)))

  return <div className="page-shell catalog-page">
    <div className="page-intro"><span className="eyebrow">{t('catalog.eyebrow')}</span><h1>{t('catalog.title')}</h1><p>{t('catalog.subtitle')}</p></div>
    <div className="catalog-toolbar">
      <form className="catalog-search" onSubmit={(event) => event.preventDefault()}><Search size={19} /><input value={query} onChange={(event) => update('q', event.target.value)} placeholder={t('catalog.searchPlaceholder')} aria-label={t('common.search')} /><button type="submit" aria-label={t('common.search')}><Search size={18} /></button></form>
      <button type="button" className="outline-button mobile-filter-button" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={17} />{t('catalog.filters')}</button>
      <span className="catalog-count">{t('catalog.results', { count: visible.length })}</span>
      <label className="select-wrap">{t('catalog.sort')}<select value={sort} onChange={(event) => update('sort', event.target.value)}><option value="">{t('catalog.sortFeatured')}</option><option value="newest">{t('catalog.sortNewest')}</option><option value="price_asc">{t('catalog.sortPriceAsc')}</option><option value="price_desc">{t('catalog.sortPriceDesc')}</option><option value="rating">{t('catalog.sortRating')}</option></select></label>
    </div>
    <div className="catalog-layout">
      <aside className={`catalog-filters ${filtersOpen ? 'is-open' : ''}`}><div className="filter-head"><h2>{t('catalog.filters')}</h2><button type="button" onClick={() => setFiltersOpen(false)} aria-label={t('common.close')}><X size={18} /></button></div>
        <fieldset><legend>{t('catalog.gender')}</legend>{['', 'MEN', 'WOMEN', 'UNISEX'].map((option) => <label key={option}><input type="radio" name="gender" checked={gender === option} onChange={() => update('gender', option)} />{option ? t(`catalog.${option.toLowerCase()}`) : t('common.all')}</label>)}</fieldset>
        <fieldset><legend>{t('catalog.category')}</legend><label><input type="radio" name="category" checked={!category} onChange={() => update('category', '')} />{t('common.all')}</label>{categories.map((item) => <label key={item}><input type="radio" name="category" checked={category === item} onChange={() => update('category', item)} />{t(`categories.${item}`, { defaultValue: item })}</label>)}</fieldset>
        {(gender || category || query) && <button className="text-button" type="button" onClick={() => setParams({})}>{t('catalog.clearFilters')}</button>}
      </aside>
      <div className="catalog-results">{loading && <p className="muted">{t('common.loading')}</p>}{error && <p className="form-error" role="alert">{t('common.error')}</p>}
        {!loading && !error && (visible.length ? <div className="product-grid">{visible.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="empty-state"><h2>{t('catalog.noResults')}</h2><p>{t('catalog.tryAgain')}</p><button className="outline-button" onClick={() => setParams({})}>{t('catalog.clearFilters')}</button></div>)}
      </div>
    </div>
  </div>
}
