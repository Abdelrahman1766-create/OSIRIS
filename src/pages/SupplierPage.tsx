import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Package, ShoppingBag, TrendingUp, X } from 'lucide-react'
import { api } from '../services/api'
import { useStore } from '../store/useStore'
import { money } from '../types'

type Variant = { id: string; sizeMl: number; sku: string; supplierPrice: number; sellingPrice: number; stock: number; isActive: boolean; currency?: string }
type Product = { id: string; nameEn: string; nameAr: string; nameRu: string; descriptionEn: string; descriptionAr: string; descriptionRu: string; brand: string; category: string; gender: 'MEN' | 'WOMEN' | 'UNISEX'; mainImage: string; images: string[]; topNotes: string[]; topNotesAr: string[]; topNotesRu: string[]; middleNotes: string[]; middleNotesAr: string[]; middleNotesRu: string[]; baseNotes: string[]; baseNotesAr: string[]; baseNotesRu: string[]; variants: Variant[]; isPublished: boolean }
type Profile = { shopName: string; description: string | null; contactEmail: string | null; contactPhone: string | null; isApproved: boolean }
type Stats = { productCount: number; activeOrderItems: number; deliveredOrderItems: number; sales: number }
type Address = { fullName?: string; city?: string; street?: string; houseNumber?: string; apartment?: string; entrance?: string; floor?: string; deliveryComment?: string }
type SupplierOrder = { id: string; productName: string; productImage?: string; sizeMl?: number; variantSizeMl?: number; quantity: number; supplierUnitPrice: number; status: string; order: { orderNumber: string; shippingAddress: Address; phone: string; paymentMethod: string; paymentStatus: string; createdAt: string; status: string } }
type Tab = 'overview' | 'products' | 'orders' | 'profile'
type DraftVariant = { id?: string; sizeMl: number; enabled: boolean; sku: string; supplierPrice: string; sellingPrice: string; stock: string; currency?: string }
const sizes = [12, 17, 20, 35, 55, 100]
const variantMoney = (variant: Variant, language: string) => new Intl.NumberFormat(language === 'ar' ? 'ar' : language === 'ru' ? 'ru' : 'en', { style: 'currency', currency: variant.currency || 'RUB', maximumFractionDigits: 2 }).format(variant.sellingPrice)
const noteFields = ['topNotes', 'topNotesAr', 'topNotesRu', 'middleNotes', 'middleNotesAr', 'middleNotesRu', 'baseNotes', 'baseNotesAr', 'baseNotesRu'] as const
const blank = { nameEn: '', nameAr: '', nameRu: '', descriptionEn: '', descriptionAr: '', descriptionRu: '', brand: '', category: '', gender: 'UNISEX' as Product['gender'], mainImage: '', images: '', ...Object.fromEntries(noteFields.map((key) => [key, ''])) } as Record<string, string>
const variantDrafts = (product: Product | null): DraftVariant[] => sizes.map((sizeMl) => {
  const variant = product?.variants.find((item) => item.sizeMl === sizeMl)
  const legacy = variant && variant.currency !== 'RUB'
  return { id: variant?.id, sizeMl, enabled: variant?.isActive ?? false, sku: variant?.sku || '', supplierPrice: variant && !legacy ? String(variant.supplierPrice) : '', sellingPrice: variant && !legacy ? String(variant.sellingPrice) : '', stock: variant ? String(variant.stock) : '0', currency: variant?.currency }
})

function ProductEditor({ product, approved, onClose, onSaved }: { product: Product | null; approved: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const { t } = useTranslation()
  const [form, setForm] = useState<Record<string, string>>(() => product ? {
    ...Object.fromEntries(['nameEn', 'nameAr', 'nameRu', 'descriptionEn', 'descriptionAr', 'descriptionRu', 'brand', 'category', 'gender', 'mainImage'].map((key) => [key, String(product[key as keyof Product] || '')])),
    images: (product.images || []).join('\n'), ...Object.fromEntries(noteFields.map((key) => [key, (product[key] || []).join(', ')])),
  } : { ...blank })
  const [variants, setVariants] = useState(() => variantDrafts(product))
  const [published, setPublished] = useState(Boolean(product?.isPublished))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  async function upload(file: File, gallery = false) {
    setUploading(true); setError('')
    try {
      const data = new FormData(); data.append('image', file)
      const result = await api<{ url: string }>('/supplier/uploads', { method: 'POST', body: data })
      setForm((previous) => ({ ...previous, [gallery ? 'images' : 'mainImage']: gallery ? [previous.images, result.url].filter(Boolean).join('\n') : result.url }))
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('common.error')) }
    finally { setUploading(false) }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setError('')
    const active = variants.filter((item) => item.enabled)
    if (!active.length) { setError(t('dashboard.sizeRequired')); return }
    if (active.some((item) => (item.currency === 'RUB' || !item.id || item.supplierPrice || item.sellingPrice) && (!Number(item.supplierPrice) || Number(item.stock) < 0 || (item.currency && item.currency !== 'RUB' && !Number(item.sellingPrice))))) { setError(t('dashboard.variantRequired')); return }
    setBusy(true)
    try {
      const details = {
        nameEn: form.nameEn.trim(), nameAr: form.nameAr.trim(), nameRu: form.nameRu.trim(),
        descriptionEn: form.descriptionEn.trim(), descriptionAr: form.descriptionAr.trim(), descriptionRu: form.descriptionRu.trim(),
        brand: form.brand.trim(), category: form.category.trim(), gender: form.gender,
        mainImage: form.mainImage.trim(), images: form.images.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
        ...Object.fromEntries(noteFields.map((key) => [key, form[key].split(',').map((value) => value.trim()).filter(Boolean)])),
        isPublished: approved && published,
      }
      if (!product) {
        await api('/supplier/products', { method: 'POST', body: JSON.stringify({ ...details, variants: active.map((item) => ({ sizeMl: item.sizeMl, sku: item.sku.trim() || undefined, supplierPrice: Number(item.supplierPrice), sellingPrice: item.sellingPrice ? Number(item.sellingPrice) : undefined, stock: Number(item.stock), isActive: true })) }) })
      } else {
        await api(`/supplier/products/${product.id}`, { method: 'PATCH', body: JSON.stringify(details) })
        for (const item of variants) {
          if (item.id) {
            if (item.currency && item.currency !== 'RUB' && !item.supplierPrice && !item.sellingPrice) {
              const original = product.variants.find((variant) => variant.id === item.id)
              if (original?.isActive !== item.enabled) await api(`/supplier/variants/${item.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: item.enabled }) })
              continue
            }
            await api(`/supplier/variants/${item.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: item.enabled, sku: item.sku.trim() || undefined, supplierPrice: Number(item.supplierPrice), sellingPrice: Number(item.sellingPrice), stock: Number(item.stock), ...(item.currency && item.currency !== 'RUB' ? { currency: 'RUB' } : {}) }) })
          } else if (item.enabled) {
            await api(`/supplier/products/${product.id}/variants`, { method: 'POST', body: JSON.stringify({ sizeMl: item.sizeMl, sku: item.sku.trim() || undefined, supplierPrice: Number(item.supplierPrice), sellingPrice: item.sellingPrice ? Number(item.sellingPrice) : undefined, stock: Number(item.stock), isActive: true }) })
          }
        }
      }
      await onSaved(); onClose()
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('common.error')) }
    finally { setBusy(false) }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className="modal-panel" role="dialog" aria-modal="true" aria-label={t(product ? 'dashboard.editProduct' : 'dashboard.addProduct')}><div className="modal-head"><div><span className="eyebrow">OSIRIS</span><h2>{t(product ? 'dashboard.editProduct' : 'dashboard.addProduct')}</h2></div><button type="button" onClick={onClose} aria-label={t('common.close')}><X /></button></div><form onSubmit={save} className="supplier-editor"><div className="field-grid">
      {(['nameEn', 'nameAr', 'nameRu', 'descriptionEn', 'descriptionAr', 'descriptionRu', 'brand', 'category'] as const).map((key) => <label className={`form-field ${key.startsWith('description') ? 'field-wide' : ''}`} key={key}><span>{t(`dashboard.${key}`)}</span>{key.startsWith('description') ? <textarea required minLength={10} rows={3} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /> : <input required value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />}</label>)}
      <label className="form-field"><span>{t('dashboard.gender')}</span><select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}><option value="MEN">{t('catalog.men')}</option><option value="WOMEN">{t('catalog.women')}</option><option value="UNISEX">{t('catalog.unisex')}</option></select></label>
      <label className="form-field field-wide"><span>{t('dashboard.image')}</span><input required type="url" value={form.mainImage} onChange={(event) => setForm({ ...form, mainImage: event.target.value })} /><label className="upload-button">{uploading ? t('common.loading') : t('dashboard.uploadImage')}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file) }} /></label></label>
      <label className="form-field field-wide"><span>{t('dashboard.images')}</span><textarea rows={2} value={form.images} onChange={(event) => setForm({ ...form, images: event.target.value })} /><label className="upload-button">{t('dashboard.uploadGallery')}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file, true) }} /></label></label>
      {noteFields.map((key) => <label className="form-field" key={key}><span>{t(`dashboard.${key}`)}</span><input value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>)}
    </div><h3 className="editor-subtitle">{t('dashboard.sizesAndPrices')}</h3><div className="variant-editor-list">{variants.map((item, index) => <div className="variant-editor-row" key={item.sizeMl}><label className="variant-enabled"><input type="checkbox" checked={item.enabled} onChange={(event) => setVariants(variants.map((row, i) => i === index ? { ...row, enabled: event.target.checked } : row))} /><strong>{item.sizeMl} {t('product.ml')}</strong>{item.currency && item.currency !== 'RUB' && <small>{t('dashboard.legacyCurrency', { currency: item.currency })}</small>}</label><label className="form-field"><span>{t('dashboard.basePrice')} (₽)</span><input type="number" min="0.01" step="0.01" disabled={!item.enabled} required={item.enabled && item.currency === 'RUB'} value={item.supplierPrice} onChange={(event) => setVariants(variants.map((row, i) => i === index ? { ...row, supplierPrice: event.target.value } : row))} /></label><label className="form-field"><span>{t('dashboard.sellingPrice')} (₽)</span><input type="number" min="0.01" step="0.01" disabled={!item.enabled} required={item.enabled && item.currency !== 'RUB' && Boolean(item.supplierPrice)} placeholder={t('dashboard.autoPrice')} value={item.sellingPrice} onChange={(event) => setVariants(variants.map((row, i) => i === index ? { ...row, sellingPrice: event.target.value } : row))} /></label><label className="form-field"><span>{t('dashboard.stock')}</span><input type="number" min="0" step="1" disabled={!item.enabled} required={item.enabled} value={item.stock} onChange={(event) => setVariants(variants.map((row, i) => i === index ? { ...row, stock: event.target.value } : row))} /></label><label className="form-field"><span>SKU</span><input disabled={!item.enabled} value={item.sku} onChange={(event) => setVariants(variants.map((row, i) => i === index ? { ...row, sku: event.target.value } : row))} /></label></div>)}</div>
    <label className="check-field"><input type="checkbox" checked={published} disabled={!approved} onChange={(event) => setPublished(event.target.checked)} />{t('dashboard.publish')}</label>{!approved && <p className="muted">{t('dashboard.pendingApproval')}</p>}{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="outline-button" type="button" onClick={onClose}>{t('common.cancel')}</button><button className="gold-button" disabled={busy || uploading}>{busy ? t('common.loading') : t('dashboard.saveProduct')}</button></div></form></div></div>
}

export default function SupplierPage() {
  const { t, i18n } = useTranslation()
  const user = useStore((state) => state.user)
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<Stats | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<SupplierOrder[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [editing, setEditing] = useState<Product | null | 'new'>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    const results = await Promise.allSettled([api<Profile>('/supplier/profile'), api<Product[]>('/supplier/products'), api<SupplierOrder[]>('/supplier/orders'), api<Stats>('/supplier/stats')])
    if (results[0].status === 'fulfilled') setProfile(results[0].value)
    if (results[1].status === 'fulfilled') setProducts(results[1].value)
    if (results[2].status === 'fulfilled') setOrders(results[2].value)
    if (results[3].status === 'fulfilled') setStats(results[3].value)
    if (results.some((result) => result.status === 'rejected')) setError(t('dashboard.loadingError'))
  }, [t])
  useEffect(() => { if (user?.role !== 'SUPPLIER') return; const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer) }, [user?.role, load])

  async function change(path: string, body: Record<string, unknown>) {
    setBusy(true); setError(''); setMessage('')
    try { await api(path, { method: 'PATCH', body: JSON.stringify(body) }); setMessage(t('common.success')); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('common.error')) }
    finally { setBusy(false) }
  }
  if (user?.role !== 'SUPPLIER') return <div className="page-shell empty-state"><h1>{t('dashboard.supplierTitle')}</h1><p>{t('dashboard.accessDenied')}</p><Link className="gold-button" to="/supplier/register">{t('dashboard.apply')}</Link></div>

  return <div className="page-shell dashboard-page supplier-page"><div className="dashboard-heading"><div><span className="eyebrow">OSIRIS · {t('dashboard.partner')}</span><h1>{t('dashboard.supplierTitle')}</h1><p>{profile?.shopName}</p></div><button className="gold-button" onClick={() => setEditing('new')}>{t('dashboard.addProduct')}</button></div><div className="dashboard-tabs">{(['overview', 'products', 'orders', 'profile'] as const).map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{t(item === 'profile' ? 'dashboard.shopProfile' : `dashboard.${item}`)}</button>)}</div>{profile && !profile.isApproved && <p className="inline-message">{t('dashboard.pendingApproval')}</p>}{message && <p className="inline-message" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}
    {tab === 'overview' && <><div className="dashboard-grid supplier-stats"><div className="stat-card"><Package /><span>{t('dashboard.totalProducts')}</span><strong>{stats?.productCount ?? '—'}</strong></div><div className="stat-card"><ShoppingBag /><span>{t('dashboard.orders')}</span><strong>{stats?.activeOrderItems ?? '—'}</strong></div><div className="stat-card highlight"><TrendingUp /><span>{t('dashboard.sales')}</span><strong>{money(stats?.sales ?? 0, i18n.language)}</strong></div></div><div className="dashboard-two-col"><section className="panel"><div className="dashboard-section-head"><h2>{t('dashboard.products')}</h2><button className="text-button" onClick={() => setTab('products')}>{t('common.viewAll')}</button></div>{products.slice(0, 4).map((product) => <div className="mini-order" key={product.id}><strong>{i18n.language === 'ar' ? product.nameAr : i18n.language === 'ru' ? product.nameRu : product.nameEn}</strong><span>{product.variants?.filter((variant) => variant.isActive).map((variant) => `${variant.sizeMl} ml`).join(' · ')}</span></div>)}{!products.length && <p className="muted">{t('dashboard.noProducts')}</p>}</section><section className="panel"><div className="dashboard-section-head"><h2>{t('dashboard.orders')}</h2><button className="text-button" onClick={() => setTab('orders')}>{t('common.viewAll')}</button></div>{orders.slice(0, 4).map((item) => <div className="mini-order" key={item.id}><strong>{item.order.orderNumber}</strong><span>{t(`orderStatus.${item.status}`)}</span></div>)}{!orders.length && <p className="muted">{t('dashboard.noOrders')}</p>}</section></div></>}
    {tab === 'products' && <><div className="dashboard-section-head"><h2>{t('dashboard.products')}</h2><button className="gold-button" onClick={() => setEditing('new')}>{t('dashboard.addProduct')}</button></div>{products.length ? <div className="table-wrap"><table><thead><tr><th>{t('dashboard.products')}</th><th>{t('dashboard.sizesAndPrices')}</th><th>{t('dashboard.stock')}</th><th>{t('dashboard.status')}</th><th>{t('dashboard.actions')}</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><div className="table-product"><img src={product.mainImage} alt="" /><div><strong>{i18n.language === 'ar' ? product.nameAr : i18n.language === 'ru' ? product.nameRu : product.nameEn}</strong><small>{product.brand}</small></div></div></td><td>{product.variants?.filter((variant) => variant.isActive).map((variant) => <div key={variant.id}>{variant.sizeMl} {t('product.ml')} · {variantMoney(variant, i18n.language)}</div>)}</td><td>{product.variants?.filter((variant) => variant.isActive).reduce((sum, variant) => sum + variant.stock, 0)}</td><td><span className={`status-pill ${product.isPublished ? 'status-delivered' : 'status-pending'}`}>{t(product.isPublished ? 'dashboard.live' : 'dashboard.draft')}</span></td><td><div className="table-actions"><button className="text-button" onClick={() => setEditing(product)}>{t('dashboard.editProduct')}</button><button className="text-button" disabled={busy || !profile?.isApproved} onClick={() => change(`/supplier/products/${product.id}`, { isPublished: !product.isPublished })}>{t(product.isPublished ? 'dashboard.unpublish' : 'dashboard.publish')}</button></div></td></tr>)}</tbody></table></div> : <div className="empty-state"><p>{t('dashboard.noProducts')}</p></div>}</>}
    {tab === 'orders' && <><div className="dashboard-section-head"><h2>{t('dashboard.orders')}</h2></div>{orders.length ? <div className="table-wrap"><table><thead><tr><th>{t('account.order')}</th><th>{t('dashboard.products')}</th><th>{t('dashboard.delivery')}</th><th>{t('dashboard.sales')}</th><th>{t('dashboard.status')}</th><th>{t('dashboard.actions')}</th></tr></thead><tbody>{orders.map((item) => { const address = item.order.shippingAddress || {}; const next = item.status === 'CONFIRMED' ? 'PREPARING' : item.status === 'PREPARING' ? 'SHIPPING' : item.status === 'SHIPPING' ? 'DELIVERED' : null; return <tr key={item.id}><td><strong>{item.order.orderNumber}</strong><small>{new Date(item.order.createdAt).toLocaleDateString(i18n.language)}</small></td><td>{item.productName}<small>{item.sizeMl || item.variantSizeMl || 50} {t('product.ml')} × {item.quantity}</small></td><td><strong>{address.fullName}</strong><small>{item.order.phone}</small><details className="delivery-details"><summary>{t('dashboard.delivery')}</summary><p>{address.city}, {address.street} {address.houseNumber}{address.apartment ? `, ${t('checkout.apartment')} ${address.apartment}` : ''}{address.entrance ? `, ${t('checkout.entrance')} ${address.entrance}` : ''}{address.floor ? `, ${t('checkout.floor')} ${address.floor}` : ''}</p>{address.deliveryComment && <p>{address.deliveryComment}</p>}<p>{t(`confirmation.${item.order.paymentMethod}`)} · {t(`dashboard.paymentStatus.${item.order.paymentStatus}`, { defaultValue: item.order.paymentStatus })}</p></details></td><td>{money(item.supplierUnitPrice * item.quantity, i18n.language)}</td><td><span className={`status-pill status-${item.status.toLowerCase()}`}>{t(`orderStatus.${item.status}`)}</span></td><td>{next && <button className="text-button" disabled={busy} onClick={() => change(`/supplier/order-items/${item.id}/status`, { status: next })}>{t(`orderStatus.${next}`)} ↗</button>}</td></tr> })}</tbody></table></div> : <div className="empty-state"><p>{t('dashboard.noOrders')}</p></div>}</>}
    {tab === 'profile' && profile && <form className="panel dashboard-form" onSubmit={(event) => { event.preventDefault(); void change('/supplier/profile', { shopName: profile.shopName, description: profile.description || '', contactEmail: profile.contactEmail || null, contactPhone: profile.contactPhone || null }) }}><h2>{t('dashboard.shopProfile')}</h2><label className="form-field"><span>{t('dashboard.shopName')}</span><input required value={profile.shopName} onChange={(event) => setProfile({ ...profile, shopName: event.target.value })} /></label><label className="form-field"><span>{t('dashboard.description')}</span><textarea rows={4} value={profile.description || ''} onChange={(event) => setProfile({ ...profile, description: event.target.value })} /></label><label className="form-field"><span>{t('dashboard.contactEmail')}</span><input type="email" value={profile.contactEmail || ''} onChange={(event) => setProfile({ ...profile, contactEmail: event.target.value })} /></label><label className="form-field"><span>{t('dashboard.contactPhone')}</span><input type="tel" value={profile.contactPhone || ''} onChange={(event) => setProfile({ ...profile, contactPhone: event.target.value })} /></label><button className="gold-button" disabled={busy}>{t('common.save')}</button></form>}
    {editing !== null && <ProductEditor product={editing === 'new' ? null : editing} approved={Boolean(profile?.isApproved)} onClose={() => setEditing(null)} onSaved={load} />}
  </div>
}
