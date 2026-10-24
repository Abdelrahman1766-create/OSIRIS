import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Gem } from 'lucide-react'
import { api } from '../services/api'
import { useStore } from '../store/useStore'
import { money } from '../types'

type Period = { placedOrders: number; deliveredOrders: number; merchandiseRevenue: number; supplierCost: number; averageOrderValue: number; directCosts: number; platformProfit: number }
type Stats = { totalCustomers: number; totalSuppliers: number; pendingSuppliers: number; totalOrders: number; deliveredOrders: number; totalRevenue: number; platformProfit: number; today: Period; thisMonth: Period }
type Business = { topProducts: { id: string; nameRu: string; nameEn: string; quantity: number }[]; topSizes: { sizeMl: number; quantity: number }[]; lowStock: { id: string; sizeMl: number; stock: number; product: { nameRu: string; nameEn: string } }[]; recentOrders: { id: string; orderNumber: string; status: string; total: number; customer: { name: string } }[]; cancelledOrders: number; ordersByStatus: Record<string, number> }
type AdminUser = { id: string; name: string; email: string; role: string; isActive: boolean; createdAt: string }
type AdminSupplier = { id: string; shopName: string; isApproved: boolean; user: { name: string; email: string }; _count?: { products: number } }
type AdminVariant = { id: string; sizeMl: number; sku: string; supplierPrice: number; sellingPrice: number; stock: number; currency: string; isActive: boolean; updatedAt: string }
type AdminProduct = { id: string; updatedAt: string; nameEn: string; nameAr: string; nameRu: string; descriptionEn: string; descriptionAr: string; descriptionRu: string; inspirationName: string | null; brand: string; category: string; familyEn: string | null; familyAr: string | null; familyRu: string | null; gender: 'MEN' | 'WOMEN' | 'UNISEX'; mainImage: string; images: string[]; topNotes: string[]; topNotesRu: string[]; topNotesAr: string[]; middleNotes: string[]; middleNotesRu: string[]; middleNotesAr: string[]; baseNotes: string[]; baseNotesRu: string[]; baseNotesAr: string[]; isPublished: boolean; isFeatured: boolean; supplier: { shopName: string }; variants: AdminVariant[] }
type AdminOrder = { id: string; orderNumber: string; status: string; createdAt: string; currency: string; subtotal: number; discountTotal: number; deliveryFee: number; total: number; directCost: number; platformProfit: number; paymentMethod: string; paymentStatus: string; customer: { name: string; email: string }; items: { id: string; productName: string; productNameRu: string; sizeMl: number; quantity: number; supplier: { shopName: string } }[] }
type AdminReview = { id: string; rating: number; comment: string; isApproved: boolean; user: { name: string }; product: { nameEn: string } }
type Customer = { id: string; name: string; email: string; isActive: boolean; orderCount: number; lifetimeValue: number; lastOrderAt: string | null; customerProfile: { phone: string | null; marketingConsent: boolean } | null }
type CustomerDetail = Customer & { favorites: { product: { id: string; nameRu: string; nameEn: string } }[]; orders: { id: string; orderNumber: string; status: string; total: number; currency: string; createdAt: string }[] }
type Commission = { type: 'FIXED' | 'PERCENTAGE'; value: number }
type Delivery = { courierFee: number; freeThreshold: number | null; isEnabled: boolean }
type Promo = { id: string; code: string; type: 'FIXED' | 'PERCENTAGE'; value: number; minimumOrder: number; expiresAt: string | null; usageLimit: number | null; usedCount: number; isEnabled: boolean }
type MarketingDraft = { title: string; copy: string; keywords: string[] }
type Tab = 'overview' | 'customers' | 'users' | 'suppliers' | 'products' | 'orders' | 'reviews' | 'promos' | 'delivery' | 'commission' | 'marketing'
const tabs: Tab[] = ['overview', 'customers', 'users', 'suppliers', 'products', 'orders', 'reviews', 'promos', 'delivery', 'commission', 'marketing']
const nextStatus: Record<string, string> = { PENDING: 'CONFIRMED' }
const rows = <T,>(data: { items: T[] }): T[] => data.items || []

function VariantEditor({ variant, language, busy, onChange }: { variant: AdminVariant; language: string; busy: boolean; onChange: (path: string, body: Record<string, unknown>) => Promise<boolean> }) {
  const { t } = useTranslation()
  const legacy = variant.currency !== 'RUB'
  const [cost, setCost] = useState(legacy ? '' : String(variant.supplierPrice))
  const [price, setPrice] = useState(legacy ? '' : String(variant.sellingPrice))
  const [stock, setStock] = useState(String(variant.stock))
  const [sku, setSku] = useState(variant.sku)
  const [sizeMl, setSizeMl] = useState(String(variant.sizeMl))

  function save(event: React.FormEvent) {
    event.preventDefault()
    if (!cost || !price || !sku) return
    void onChange(`/admin/variants/${variant.id}`, {
      sizeMl: Number(sizeMl), supplierPrice: Number(cost), sellingPrice: Number(price), stock: Number(stock), sku: sku.trim(),
      ...(legacy && { currency: 'RUB' }),
    })
  }

  return <form className="admin-variant-row" onSubmit={save}>
    <div className="admin-variant-title"><strong>{variant.sizeMl} {t('product.ml')}</strong><small>{legacy ? t('dashboard.legacyCurrency', { currency: variant.currency }) : money(variant.sellingPrice, language)} · {variant.stock} {t('dashboard.stock')}</small></div>
    <label className="form-field"><span>{t('product.chooseSize')}</span><select value={sizeMl} onChange={(event) => setSizeMl(event.target.value)}>{[12, 17, 20, 35, 55, 100].map((size) => <option key={size} value={size}>{size} {t('product.ml')}</option>)}</select></label>
    <label className="form-field"><span>{t('dashboard.basePrice')} (₽)</span><input required type="number" min="0.01" step="0.01" value={cost} onChange={(event) => setCost(event.target.value)} /></label>
    <label className="form-field"><span>{t('dashboard.sellingPrice')} (₽)</span><input required type="number" min="0.01" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
    <label className="form-field"><span>{t('dashboard.stock')}</span><input required type="number" min="0" step="1" value={stock} onChange={(event) => setStock(event.target.value)} /></label>
    <label className="form-field"><span>SKU</span><input required value={sku} onChange={(event) => setSku(event.target.value)} /></label>
    <button className="outline-button" disabled={busy || !cost || !price}>{legacy ? t('dashboard.convertToRub') : t('common.save')}</button>
    {!legacy && <button type="button" className="text-button" disabled={busy} onClick={() => void onChange(`/admin/variants/${variant.id}`, { resetPrice: true })}>{t('dashboard.autoPrice')}</button>}
    <button type="button" className="text-button" disabled={busy} onClick={() => void onChange(`/admin/variants/${variant.id}`, { isActive: !variant.isActive })}>{t(variant.isActive ? 'dashboard.deactivate' : 'dashboard.activate')}</button>
  </form>
}

const textFields = ['nameRu', 'nameEn', 'nameAr', 'descriptionRu', 'descriptionEn', 'descriptionAr', 'familyRu', 'familyEn', 'familyAr', 'inspirationName', 'mainImage', 'images', 'topNotesRu', 'topNotes', 'topNotesAr', 'middleNotesRu', 'middleNotes', 'middleNotesAr', 'baseNotesRu', 'baseNotes', 'baseNotesAr'] as const
const noteFields = ['topNotesRu', 'topNotes', 'topNotesAr', 'middleNotesRu', 'middleNotes', 'middleNotesAr', 'baseNotesRu', 'baseNotes', 'baseNotesAr'] as const

function ProductDetailsEditor({ product, busy, onChange }: { product: AdminProduct; busy: boolean; onChange: (path: string, body: Record<string, unknown>) => Promise<boolean> }) {
  const { t } = useTranslation()
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(textFields.map((field) => [field, field === 'images' ? product.images.join('\n') : Array.isArray(product[field]) ? product[field].join('\n') : String(product[field] ?? (field === 'familyEn' ? product.category : ''))])))
  const [gender, setGender] = useState(product.gender)
  const set = (field: string, value: string) => setValues((current) => ({ ...current, [field]: value }))
  function save(event: React.FormEvent) {
    event.preventDefault()
    const body: Record<string, unknown> = Object.fromEntries(textFields.filter((field) => field !== 'images' && field !== 'inspirationName' && !noteFields.includes(field as typeof noteFields[number])).map((field) => [field, values[field].trim()]))
    for (const field of noteFields) body[field] = values[field].split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)
    body.images = values.images.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
    body.inspirationName = values.inspirationName.trim() || null
    body.category = values.familyEn.trim()
    body.gender = gender
    void onChange(`/admin/products/${product.id}`, body)
  }
  return <form className="admin-details-form" onSubmit={save}>
    <div className="admin-details-grid">
      {(['nameRu', 'nameEn', 'nameAr'] as const).map((field) => <label className="form-field" key={field}><span>{t(`editor.${field}`)}</span><input required minLength={2} maxLength={160} value={values[field]} onChange={(event) => set(field, event.target.value)} /></label>)}
      <label className="form-field"><span>{t('editor.gender')}</span><select value={gender} onChange={(event) => setGender(event.target.value as AdminProduct['gender'])}><option value="MEN">{t('catalog.men')}</option><option value="WOMEN">{t('catalog.women')}</option><option value="UNISEX">{t('catalog.unisex')}</option></select></label>
      {(['familyRu', 'familyEn', 'familyAr'] as const).map((field) => <label className="form-field" key={field}><span>{t(`editor.${field}`)}</span><input required minLength={2} value={values[field]} onChange={(event) => set(field, event.target.value)} /></label>)}
      <label className="form-field"><span>{t('editor.inspirationName')}</span><input value={values.inspirationName} onChange={(event) => set('inspirationName', event.target.value)} placeholder={t('editor.originalHint')} /></label>
      <label className="form-field"><span>{t('editor.mainImage')}</span><input required value={values.mainImage} onChange={(event) => set('mainImage', event.target.value)} /></label>
      <label className="form-field"><span>{t('editor.images')}</span><textarea value={values.images} onChange={(event) => set('images', event.target.value)} /></label>
      {(['descriptionRu', 'descriptionEn', 'descriptionAr'] as const).map((field) => <label className="form-field admin-wide-field" key={field}><span>{t(`editor.${field}`)}</span><textarea required minLength={10} value={values[field]} onChange={(event) => set(field, event.target.value)} /></label>)}
      {noteFields.map((field) => <label className="form-field" key={field}><span>{t(`editor.${field}`)}</span><textarea value={values[field]} onChange={(event) => set(field, event.target.value)} placeholder={t('editor.onePerLine')} /></label>)}
    </div>
    <button className="gold-button" disabled={busy}>{t('common.save')}</button>
  </form>
}

export default function AdminPage() {
  const { t, i18n } = useTranslation()
  const user = useStore((state) => state.user)
  const language = i18n.language
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<Stats | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [suppliers, setSuppliers] = useState<AdminSupplier[]>([])
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null)
  const [promos, setPromos] = useState<Promo[]>([])
  const [commission, setCommission] = useState<Commission>({ type: 'PERCENTAGE', value: 30 })
  const [delivery, setDelivery] = useState<Delivery>({ courierFee: 0, freeThreshold: null, isEnabled: false })
  const [promoForm, setPromoForm] = useState({ code: '', type: 'PERCENTAGE' as Promo['type'], value: '', minimumOrder: '0', expiresAt: '', usageLimit: '' })
  const [marketing, setMarketing] = useState({ productId: '', channel: 'instagram' })
  const [draft, setDraft] = useState<MarketingDraft | null>(null)
  const [sampleCost, setSampleCost] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      api<Stats>('/admin/stats').then(setStats),
      api<Business>('/admin/business-stats').then(setBusiness),
      api<{ items: AdminUser[] }>('/admin/users?limit=100').then((data) => setUsers(rows(data))),
      api<{ items: AdminSupplier[] }>('/admin/suppliers?limit=100').then((data) => setSuppliers(rows(data))),
      api<{ items: AdminProduct[] }>('/admin/products?limit=100').then((data) => setProducts(rows(data))),
      api<{ items: AdminOrder[] }>('/admin/orders?limit=100').then((data) => setOrders(rows(data))),
      api<{ items: AdminReview[] }>('/admin/reviews?limit=100').then((data) => setReviews(rows(data))),
      api<{ items: Customer[] }>('/admin/customers?limit=100').then((data) => setCustomers(rows(data))),
      api<{ items: Promo[] }>('/admin/promos?limit=100').then((data) => setPromos(rows(data))),
      api<Delivery>('/admin/delivery').then(setDelivery),
      api<Commission>('/admin/commission').then(setCommission),
    ])
    if (results.some((result) => result.status === 'rejected')) setError(t('dashboard.loadingError'))
  }, [t])

  useEffect(() => { if (user?.role !== 'ADMIN') return; const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer) }, [user?.role, load])

  async function change(path: string, body: Record<string, unknown>, method = 'PATCH') {
    setBusy(true); setError(''); setMessage('')
    try { await api(path, { method, body: JSON.stringify(body) }); setMessage(t('common.success')); await load(); return true }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('common.error')); return false }
    finally { setBusy(false) }
  }

  async function openCustomer(id: string) {
    setError('')
    try { setCustomerDetail(await api<CustomerDetail>(`/admin/customers/${id}`)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('common.error')) }
  }

  async function createPromo(event: React.FormEvent) {
    event.preventDefault()
    const success = await change('/admin/promos', {
      code: promoForm.code.trim(), type: promoForm.type, value: Number(promoForm.value),
      minimumOrder: Number(promoForm.minimumOrder), expiresAt: promoForm.expiresAt ? new Date(promoForm.expiresAt).toISOString() : null,
      usageLimit: promoForm.usageLimit ? Number(promoForm.usageLimit) : null, isEnabled: true,
    }, 'POST')
    if (success) setPromoForm({ code: '', type: 'PERCENTAGE', value: '', minimumOrder: '0', expiresAt: '', usageLimit: '' })
  }

  async function generateDraft(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setDraft(null)
    try { setDraft(await api<MarketingDraft>('/ai/marketing/draft', { method: 'POST', body: JSON.stringify({ ...marketing, language: i18n.language.slice(0, 2) }) })) }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('common.error')) }
    finally { setBusy(false) }
  }

  if (user?.role !== 'ADMIN') return <div className="page-shell empty-state"><h1>{t('dashboard.adminTitle')}</h1><p>{t('dashboard.accessDenied')}</p><Link className="gold-button" to="/login">{t('auth.login')}</Link></div>

  const productName = (product: { nameEn: string; nameRu?: string; nameAr?: string }) => language === 'ar' ? product.nameAr || product.nameEn : language === 'ru' ? product.nameRu || product.nameEn : product.nameEn
  const metric = (label: string, value: number | string, highlight = false) => <div className={`stat-card ${highlight ? 'highlight' : ''}`} key={label}><span>{label}</span><strong>{value}</strong></div>

  return <div className="page-shell dashboard-page admin-page">
    <div className="dashboard-heading"><div><span className="eyebrow">OSIRIS · {t('dashboard.controlRoom')}</span><h1>{t('dashboard.adminTitle')}</h1></div><span className="admin-badge"><Gem size={18} /> {t('dashboard.adminRole')}</span></div>
    <div className="dashboard-tabs">{tabs.map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{t(`dashboard.${item}`)}{item === 'suppliers' && !!stats?.pendingSuppliers && <span className="tab-count">{stats.pendingSuppliers}</span>}</button>)}</div>
    {message && <p className="inline-message" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}

    {tab === 'overview' && <>
      <div className="dashboard-grid admin-stats">
        {metric(t('dashboard.customers'), stats?.totalCustomers ?? '—')}{metric(t('dashboard.suppliers'), stats?.totalSuppliers ?? '—')}
        {metric(t('dashboard.totalOrders'), stats?.totalOrders ?? '—')}{metric(t('dashboard.revenue'), money(stats?.totalRevenue ?? 0, language))}
        {metric(t('dashboard.profit'), money(stats?.platformProfit ?? 0, language), true)}
      </div>
      {([['today', stats?.today], ['thisMonth', stats?.thisMonth]] as const).map(([key, period]) => <section key={key} className="admin-period"><div className="dashboard-section-head"><h2>{t(`dashboard.${key}`)}</h2><small>{t('dashboard.kazanTime')}</small></div><div className="dashboard-grid admin-period-grid">
        {metric(t('dashboard.placedOrders'), period?.placedOrders ?? '—')}{metric(t('dashboard.deliveredOrders'), period?.deliveredOrders ?? '—')}
        {metric(t('dashboard.sales'), money(period?.merchandiseRevenue ?? 0, language))}{metric(t('dashboard.supplierCost'), money(period?.supplierCost ?? 0, language))}
        {metric(t('dashboard.profit'), money(period?.platformProfit ?? 0, language), true)}{metric(t('dashboard.averageOrderValue'), money(period?.averageOrderValue ?? 0, language))}
      </div></section>)}
      <div className="dashboard-two-col"><section className="panel"><div className="dashboard-section-head"><h2>{t('dashboard.topPerfumes')}</h2></div>{business?.topProducts.map((product) => <div className="mini-order" key={product.id}><strong>{productName(product)}</strong><span>{product.quantity}</span></div>)}{!business?.topProducts.length && <p className="muted">{t('common.empty')}</p>}</section>
        <section className="panel"><div className="dashboard-section-head"><h2>{t('dashboard.topSizes')}</h2></div>{business?.topSizes.map((size) => <div className="mini-order" key={size.sizeMl}><strong>{size.sizeMl} {t('product.ml')}</strong><span>{size.quantity}</span></div>)}{!business?.topSizes.length && <p className="muted">{t('common.empty')}</p>}</section></div>
      <div className="dashboard-two-col"><section className="panel"><div className="dashboard-section-head"><h2>{t('dashboard.recentOrders')}</h2><button className="text-button" onClick={() => setTab('orders')}>{t('common.viewAll')}</button></div>{business?.recentOrders.map((order) => <div className="mini-order" key={order.id}><div><strong>{order.orderNumber}</strong><small>{order.customer.name}</small></div><span>{t(`orderStatus.${order.status}`)}</span><strong>{money(order.total, language)}</strong></div>)}{!business?.recentOrders.length && <p className="muted">{t('common.empty')}</p>}</section>
        <section className="panel"><div className="dashboard-section-head"><h2>{t('dashboard.lowStock')}</h2><span>{t('dashboard.cancelledOrders')}: {business?.cancelledOrders ?? 0}</span></div>{business?.lowStock.map((item) => <div className="mini-order" key={item.id}><strong>{productName(item.product)} · {item.sizeMl} {t('product.ml')}</strong><span>{item.stock}</span></div>)}{!business?.lowStock.length && <p className="muted">{t('common.empty')}</p>}</section></div>
    </>}

    {tab === 'customers' && <><div className="dashboard-section-head"><h2>{t('dashboard.customerDatabase')}</h2></div><div className="table-wrap"><table><thead><tr><th>{t('auth.name')}</th><th>{t('dashboard.phone')}</th><th>{t('auth.email')}</th><th>{t('dashboard.totalOrders')}</th><th>{t('dashboard.amountSpent')}</th><th>{t('dashboard.lastOrder')}</th><th>{t('dashboard.actions')}</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td><strong>{customer.name}</strong></td><td>{customer.customerProfile?.phone || '—'}</td><td>{customer.email}</td><td>{customer.orderCount}</td><td>{money(customer.lifetimeValue, language)}</td><td>{customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString(language) : '—'}</td><td><button className="text-button" onClick={() => void openCustomer(customer.id)}>{t('dashboard.viewProfile')}</button></td></tr>)}</tbody></table></div>{customerDetail && <div className="panel admin-customer-detail"><button className="text-button" onClick={() => setCustomerDetail(null)}>{t('common.close')}</button><h2>{customerDetail.name}</h2><p>{customerDetail.customerProfile?.phone || '—'} · {customerDetail.email}</p><h3>{t('dashboard.favoriteFragrances')}</h3><p>{customerDetail.favorites?.map((item) => productName(item.product)).join(', ') || t('common.empty')}</p><h3>{t('dashboard.orderHistory')}</h3>{customerDetail.orders?.map((order) => <div className="mini-order" key={order.id}><strong>{order.orderNumber}</strong><span>{t(`orderStatus.${order.status}`)}</span><span>{money(order.total, language)}</span></div>)}</div>}</>}

    {tab === 'users' && <><div className="dashboard-section-head"><h2>{t('dashboard.users')}</h2></div><div className="table-wrap"><table><thead><tr><th>{t('auth.name')}</th><th>{t('auth.email')}</th><th>{t('dashboard.role')}</th><th>{t('dashboard.joined')}</th><th>{t('dashboard.status')}</th><th>{t('dashboard.actions')}</th></tr></thead><tbody>{users.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.email}</td><td>{t(`dashboard.role${row.role}`)}</td><td>{new Date(row.createdAt).toLocaleDateString(language)}</td><td><span className={`status-pill ${row.isActive ? 'status-delivered' : 'status-cancelled'}`}>{t(row.isActive ? 'dashboard.active' : 'dashboard.inactive')}</span></td><td><button className="text-button" disabled={busy || row.id === user.id} onClick={() => void change(`/admin/users/${row.id}`, { isActive: !row.isActive })}>{t(row.isActive ? 'dashboard.deactivate' : 'dashboard.activate')}</button></td></tr>)}</tbody></table></div></>}

    {tab === 'suppliers' && <><div className="dashboard-section-head"><h2>{t('dashboard.suppliers')}</h2></div><div className="table-wrap"><table><thead><tr><th>{t('dashboard.shopName')}</th><th>{t('auth.email')}</th><th>{t('dashboard.products')}</th><th>{t('dashboard.status')}</th><th>{t('dashboard.actions')}</th></tr></thead><tbody>{suppliers.map((supplier) => <tr key={supplier.id}><td><strong>{supplier.shopName}</strong><small>{supplier.user.name}</small></td><td>{supplier.user.email}</td><td>{supplier._count?.products ?? 0}</td><td><span className={`status-pill ${supplier.isApproved ? 'status-delivered' : 'status-pending'}`}>{supplier.isApproved ? t('dashboard.approve') : t('dashboard.pendingApproval')}</span></td><td><button className="text-button" disabled={busy} onClick={() => void change(`/admin/suppliers/${supplier.id}`, { isApproved: !supplier.isApproved })}>{supplier.isApproved ? t('dashboard.reject') : t('dashboard.approve')}</button></td></tr>)}</tbody></table></div></>}

    {tab === 'products' && <><div className="dashboard-section-head"><h2>{t('dashboard.products')}</h2></div><div className="admin-product-list">{products.map((product) => <section className="panel admin-product-panel" key={product.id}><div className="admin-product-heading"><img src={product.mainImage} alt="" loading="lazy" /><div><h3>{productName(product)}</h3><p>OSIRIS</p><span className={`status-pill ${product.isPublished ? 'status-delivered' : 'status-pending'}`}>{t(product.isPublished ? 'dashboard.live' : 'dashboard.draft')}</span></div><div className="table-actions"><button className="text-button" disabled={busy} onClick={() => void change(`/admin/products/${product.id}`, { isPublished: !product.isPublished })}>{t(product.isPublished ? 'dashboard.unpublish' : 'dashboard.publish')}</button><button className="text-button" disabled={busy} onClick={() => void change(`/admin/products/${product.id}`, { isFeatured: !product.isFeatured })}>{product.isFeatured ? '★' : '☆'} {t('dashboard.featured')}</button></div></div><details className="admin-variant-details"><summary>{t('editor.productDetails')}</summary><ProductDetailsEditor key={`${product.id}-${product.updatedAt}`} product={product} busy={busy} onChange={change} /></details><details className="admin-variant-details"><summary>{t('dashboard.sizesAndPrices')} · {product.variants.length}</summary><div className="admin-variant-list">{product.variants.map((variant) => <VariantEditor key={`${variant.id}-${variant.updatedAt}`} variant={variant} language={language} busy={busy} onChange={change} />)}</div></details></section>)}</div></>}

    {tab === 'orders' && <><div className="dashboard-section-head"><h2>{t('dashboard.orders')}</h2></div><div className="table-wrap"><table><thead><tr><th>{t('account.order')}</th><th>{t('dashboard.customers')}</th><th>{t('dashboard.products')}</th><th>{t('common.total')}</th><th>{t('dashboard.profit')}</th><th>{t('dashboard.status')}</th><th>{t('dashboard.paymentStatusLabel')}</th><th>{t('dashboard.actions')}</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><strong>{order.orderNumber}</strong><small>{new Date(order.createdAt).toLocaleDateString(language)}</small></td><td>{order.customer.name}<small>{order.customer.email}</small></td><td><details><summary>{order.items.length} {t('account.items')}</summary>{order.items.map((item) => <small key={item.id}>{item.productNameRu || item.productName} · {item.sizeMl} {t('product.ml')} × {item.quantity} · {item.supplier.shopName}</small>)}</details></td><td>{money(order.total, language)}</td><td>{money(order.platformProfit, language)}</td><td><span className={`status-pill status-${order.status.toLowerCase()}`}>{t(`orderStatus.${order.status}`)}</span></td><td><select aria-label={t('dashboard.paymentStatusLabel')} disabled={busy || order.status === 'CANCELLED'} value={order.paymentStatus} onChange={(event) => void change(`/admin/orders/${order.id}/payment`, { paymentStatus: event.target.value })}>{['PENDING', 'AWAITING_TRANSFER', 'PAID', 'FAILED'].filter((status) => status !== 'AWAITING_TRANSFER' || order.paymentMethod === 'BANK_TRANSFER').map((status) => <option key={status} value={status} disabled={status === 'PAID' && order.status === 'PENDING'}>{t(`dashboard.paymentStatus.${status}`)}</option>)}</select><small>{t(`confirmation.${order.paymentMethod}`)}</small></td><td><div className="table-actions">{nextStatus[order.status] && <button className="text-button" disabled={busy} onClick={() => void change(`/admin/orders/${order.id}/status`, { status: nextStatus[order.status] })}>{t(`orderStatus.${nextStatus[order.status]}`)}</button>}{['PENDING', 'CONFIRMED', 'PREPARING'].includes(order.status) && <button className="text-button danger" disabled={busy} onClick={() => void change(`/admin/orders/${order.id}/status`, { status: 'CANCELLED' })}>{t('common.cancel')}</button>}<form className="admin-cost-form" onSubmit={(event) => { event.preventDefault(); const input = event.currentTarget.elements.namedItem('directCost') as HTMLInputElement; void change(`/admin/orders/${order.id}/costs`, { directCost: Number(input.value) }) }}><label>{t('dashboard.directCost')} (₽)<input name="directCost" type="number" min="0" step="0.01" defaultValue={order.directCost} key={`${order.id}-${order.directCost}`} /></label><button className="text-button" disabled={busy}>{t('common.save')}</button></form></div></td></tr>)}</tbody></table></div></>}

    {tab === 'reviews' && <><div className="dashboard-section-head"><h2>{t('dashboard.reviews')}</h2></div><div className="table-wrap"><table><thead><tr><th>{t('dashboard.products')}</th><th>{t('dashboard.users')}</th><th>{t('product.rating')}</th><th>{t('dashboard.reviewText')}</th><th>{t('dashboard.status')}</th><th>{t('dashboard.actions')}</th></tr></thead><tbody>{reviews.map((review) => <tr key={review.id}><td>{review.product.nameEn}</td><td>{review.user.name}</td><td><span className="stars">{'★'.repeat(review.rating)}</span></td><td className="review-cell">{review.comment}</td><td>{t(review.isApproved ? 'dashboard.active' : 'dashboard.inactive')}</td><td><button className="text-button" disabled={busy} onClick={() => void change(`/admin/reviews/${review.id}`, { isApproved: !review.isApproved })}>{t(review.isApproved ? 'dashboard.reject' : 'dashboard.approve')}</button></td></tr>)}</tbody></table></div></>}

    {tab === 'promos' && <div className="admin-management-layout"><form className="panel dashboard-form" onSubmit={createPromo}><h2>{t('dashboard.createPromo')}</h2><label className="form-field"><span>{t('dashboard.promoCode')}</span><input required minLength={2} value={promoForm.code} onChange={(event) => setPromoForm({ ...promoForm, code: event.target.value.toUpperCase() })} /></label><label className="form-field"><span>{t('dashboard.promoType')}</span><select value={promoForm.type} onChange={(event) => setPromoForm({ ...promoForm, type: event.target.value as Promo['type'] })}><option value="PERCENTAGE">{t('dashboard.percentage')}</option><option value="FIXED">{t('dashboard.fixed')}</option></select></label><label className="form-field"><span>{t('dashboard.promoValue')} {promoForm.type === 'PERCENTAGE' ? '(%)' : '(₽)'}</span><input required type="number" min="0.01" max={promoForm.type === 'PERCENTAGE' ? 100 : undefined} step="0.01" value={promoForm.value} onChange={(event) => setPromoForm({ ...promoForm, value: event.target.value })} /></label><label className="form-field"><span>{t('dashboard.minimumOrder')} (₽)</span><input required type="number" min="0" step="0.01" value={promoForm.minimumOrder} onChange={(event) => setPromoForm({ ...promoForm, minimumOrder: event.target.value })} /></label><label className="form-field"><span>{t('dashboard.expiresAt')}</span><input type="datetime-local" value={promoForm.expiresAt} onChange={(event) => setPromoForm({ ...promoForm, expiresAt: event.target.value })} /></label><label className="form-field"><span>{t('dashboard.usageLimit')}</span><input type="number" min="1" step="1" value={promoForm.usageLimit} onChange={(event) => setPromoForm({ ...promoForm, usageLimit: event.target.value })} /></label><button className="gold-button" disabled={busy}>{t('dashboard.createPromo')}</button></form><section className="panel admin-promo-list"><h2>{t('dashboard.promos')}</h2>{promos.map((promo) => <div className="admin-promo-row" key={promo.id}><div><strong>{promo.code}</strong><small>{promo.type === 'PERCENTAGE' ? `${promo.value}%` : money(promo.value, language)} · {promo.usedCount}/{promo.usageLimit ?? '∞'} · {t('dashboard.minimumOrder')}: {money(promo.minimumOrder, language)}</small>{promo.expiresAt && <small>{t('dashboard.expiresAt')}: {new Date(promo.expiresAt).toLocaleDateString(language)}</small>}</div><button className="text-button" disabled={busy} onClick={() => void change(`/admin/promos/${promo.id}`, { isEnabled: !promo.isEnabled })}>{t(promo.isEnabled ? 'dashboard.deactivate' : 'dashboard.activate')}</button></div>)}{!promos.length && <p className="muted">{t('common.empty')}</p>}</section></div>}

    {tab === 'delivery' && <form className="panel dashboard-form" onSubmit={(event) => { event.preventDefault(); void change('/admin/delivery', delivery, 'PUT') }}><h2>{t('dashboard.deliverySettings')}</h2><p className="muted">{t('checkout.kazanCourier')}</p><label className="form-field"><span>{t('dashboard.deliveryFee')} (₽)</span><input type="number" required min="0" step="0.01" value={delivery.courierFee} onChange={(event) => setDelivery({ ...delivery, courierFee: Number(event.target.value) })} /></label><label className="form-field"><span>{t('dashboard.freeThreshold')} (₽)</span><input type="number" min="0" step="0.01" value={delivery.freeThreshold ?? ''} onChange={(event) => setDelivery({ ...delivery, freeThreshold: event.target.value ? Number(event.target.value) : null })} /></label><label className="check-field"><input type="checkbox" checked={delivery.isEnabled} onChange={(event) => setDelivery({ ...delivery, isEnabled: event.target.checked })} />{t('dashboard.deliveryEnabled')}</label><button className="gold-button" disabled={busy}>{t('common.save')}</button></form>}

    {tab === 'commission' && <div className="commission-layout"><form className="panel dashboard-form" onSubmit={(event) => { event.preventDefault(); void change('/admin/commission', commission, 'PUT') }}><h2>{t('dashboard.commission')}</h2><label className="form-field"><span>{t('dashboard.commissionType')}</span><select value={commission.type} onChange={(event) => setCommission({ ...commission, type: event.target.value as Commission['type'] })}><option value="PERCENTAGE">{t('dashboard.percentage')}</option><option value="FIXED">{t('dashboard.fixed')}</option></select></label><label className="form-field"><span>{t('dashboard.commissionValue')} {commission.type === 'PERCENTAGE' ? '(%)' : '(₽)'}</span><input type="number" required min="0" max={commission.type === 'PERCENTAGE' ? 100 : 100000} step="0.01" value={commission.value} onChange={(event) => setCommission({ ...commission, value: Number(event.target.value) })} /></label><button className="gold-button" disabled={busy}>{t('common.save')}</button></form><div className="panel commission-example"><span className="eyebrow">{t('dashboard.example')}</span><h2>{t('dashboard.sellingPrice')}</h2><label className="form-field"><span>{t('dashboard.basePrice')} (₽)</span><input type="number" min="0" step="0.01" value={sampleCost} onChange={(event) => setSampleCost(event.target.value)} /></label>{sampleCost && <div className="summary-row total-row"><strong>{t('dashboard.sellingPrice')}</strong><strong>{money(Number(sampleCost) + (commission.type === 'FIXED' ? commission.value : Number(sampleCost) * commission.value / 100), language)}</strong></div>}</div></div>}

    {tab === 'marketing' && <div className="marketing-layout"><form className="panel dashboard-form" onSubmit={generateDraft}><span className="eyebrow">{t('marketing.eyebrow')}</span><h2>{t('marketing.title')}</h2><p className="muted">{t('marketing.disclosure')}</p><label className="form-field"><span>{t('dashboard.products')}</span><select required value={marketing.productId} onChange={(event) => setMarketing({ ...marketing, productId: event.target.value })}><option value="">{t('marketing.chooseProduct')}</option>{products.map((product) => <option key={product.id} value={product.id}>{productName(product)}</option>)}</select></label><label className="form-field"><span>{t('marketing.channel')}</span><select value={marketing.channel} onChange={(event) => setMarketing({ ...marketing, channel: event.target.value })}><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="seo">SEO</option></select></label><button type="submit" disabled={busy || !marketing.productId} className="gold-button">{busy ? t('common.loading') : t('marketing.generate')}</button></form><div className="panel marketing-draft"><span className="eyebrow">{t('marketing.preview')}</span>{draft ? <><h2>{draft.title}</h2><p>{draft.copy}</p><h3>{t('marketing.keywords')}</h3><div className="keyword-list">{draft.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div></> : <div className="empty-state"><p>{t('marketing.placeholder')}</p></div>}</div></div>}
  </div>
}
