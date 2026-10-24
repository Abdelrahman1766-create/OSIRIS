import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ProductCard from '../components/ProductCard'
import { api, normalizeProduct } from '../services/api'
import { useStore } from '../store/useStore'
import type { Order, Product } from '../types'
import { localized, money } from '../types'

const statuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPING', 'DELIVERED'] as const

export default function AccountPage() {
  const { t, i18n } = useTranslation()
  const [params, setParams] = useSearchParams()
  const user = useStore((s) => s.user)
  const signOut = useStore((s) => s.signOut)
  const favorites = useStore((s) => s.favorites)
  const [orders, setOrders] = useState<Order[]>([])
  const [saved, setSaved] = useState<Product[]>([])
  const [loading, setLoading] = useState(!!user)
  const tab = params.get('tab') || 'orders'

  useEffect(() => {
    if (!user) return
    api<Order[]>('/orders').then(setOrders).catch(() => {}).finally(() => setLoading(false))
    api<Record<string, unknown>[]>('/favorites').then((records) => {
      const products = records.map((record) => normalizeProduct((record.product || record) as Record<string, unknown>)).filter((product) => product.id)
      if (products.length) setSaved(products)
    }).catch(() => {})
  }, [user])

  return <div className="page-shell account-page"><div className="page-intro"><span className="eyebrow">OSIRIS</span><h1>{user ? t('account.welcome', { name: user.name }) : t('account.title')}</h1></div>
    {!user ? <div className="empty-state"><p>{t('cart.authPrompt')}</p><Link className="gold-button" to="/login">{t('auth.login')}</Link></div> : <>
      <div className="account-tabs"><button className={tab === 'orders' ? 'active' : ''} onClick={() => setParams({ tab: 'orders' })}>{t('account.orders')}</button><button className={tab === 'favorites' ? 'active' : ''} onClick={() => setParams({ tab: 'favorites' })}>{t('account.favorites')}</button><button className="signout" onClick={signOut}>{t('nav.signout')}</button></div>
      {tab === 'favorites' ? favorites.length ? <div className="product-grid">{saved.filter((product) => favorites.includes(product.id)).map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="empty-state"><h2>{t('account.emptyFavorites')}</h2><Link to="/shop" className="gold-button">{t('common.startShopping')}</Link></div>
        : loading ? <p className="muted">{t('common.loading')}</p>
          : orders.length ? <div className="orders-list">{orders.map((order) => <article className="order-card panel" key={order.orderNumber || order.id}><div className="order-card-head"><div><span className="eyebrow">{t('account.order')} № {order.orderNumber || '—'}</span><p>{new Date(order.createdAt).toLocaleDateString(i18n.language)}</p></div><span className={`status-pill status-${order.status.toLowerCase()}`}>{t(`orderStatus.${order.status}`)}</span></div>
            <div className="order-products">{order.items?.map((item, index) => <div key={item.id || index}><span>{item.product?.name ? localized(item.product.name, i18n.language) : item.productName || t('confirmation.perfume')} · {item.sizeMl || item.variantSizeMl || item.variant?.sizeMl || 100} {t('product.ml')} × {item.quantity}</span><span>{money(item.unitPrice * item.quantity, i18n.language)}</span></div>)}</div>
            <div className="summary-row total-row"><strong>{t('common.total')}</strong><strong>{money(Number(order.total), i18n.language)}</strong></div>
            {order.status !== 'CANCELLED' && <div className="order-timeline" aria-label={t('account.timeline')}>{statuses.map((status, index) => <div key={status} className={statuses.indexOf(order.status as typeof statuses[number]) >= index ? 'done' : ''}><span></span><small>{t(`orderStatus.${status}`)}</small></div>)}</div>}
            {order.orderNumber && <Link className="text-button order-detail-link" to={`/order-confirmation/${encodeURIComponent(order.orderNumber)}`}>{t('account.track')} ↗</Link>}
          </article>)}</div>
            : <div className="empty-state"><h2>{t('account.emptyOrders')}</h2><Link to="/shop" className="gold-button">{t('common.startShopping')}</Link></div>}
    </>}
  </div>
}
