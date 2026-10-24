import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, Check, MessageCircle, MessageSquareText, PackageCheck, Send } from 'lucide-react'
import { copyContactMessage, maxContactUrl, telegramUrl, whatsappUrl } from '../config/contact'
import { api } from '../services/api'
import type { Order } from '../types'
import { money } from '../types'
import { buildOrderContactMessage, orderAddressLine, orderItemName, orderItemSize, type OrderContactCopy } from '../utils/orderContactMessage'

const journey = ['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPING', 'DELIVERED'] as const

export default function OrderConfirmationPage() {
  const { orderNumber } = useParams()
  const location = useLocation()
  const { t, i18n } = useTranslation()
  const initial = (location.state as { order?: Order } | null)?.order || null
  const [order, setOrder] = useState<Order | null>(initial)
  const [loading, setLoading] = useState(!initial)
  const [error, setError] = useState('')
  const [maxNotice, setMaxNotice] = useState('')

  useEffect(() => {
    if (!orderNumber) return
    let active = true
    api<Order>(`/orders/${encodeURIComponent(orderNumber)}`).then((data) => { if (active) setOrder(data) })
      .catch((cause) => { if (active && !initial) setError(cause instanceof Error ? cause.message : t('common.error')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [orderNumber, initial, t])

  useEffect(() => {
    if (!maxNotice) return
    const timer = window.setTimeout(() => setMaxNotice(''), 4200)
    return () => window.clearTimeout(timer)
  }, [maxNotice])

  if (loading) return <div className="page-shell empty-state">{t('common.loading')}</div>
  if (!order) return <div className="page-shell empty-state"><h1>{t('confirmation.notFound')}</h1><p>{error}</p><Link className="gold-button" to="/account">{t('account.orders')}</Link></div>

  const number = order.orderNumber || orderNumber || ''
  const messageCopy: OrderContactCopy = {
    greeting: t('confirmation.message.greeting'),
    orderCreated: t('confirmation.message.orderCreated', { number }),
    items: t('confirmation.message.items'),
    subtotal: t('confirmation.message.subtotal'),
    discount: t('checkout.discount'),
    delivery: t('checkout.deliveryFee'),
    total: t('confirmation.message.total'),
    customer: t('confirmation.message.customer'),
    phone: t('checkout.phone'),
    deliveryMethod: t('confirmation.message.deliveryMethod'),
    deliveryMethodValue: t('checkout.kazanCourier'),
    address: t('confirmation.message.address'),
    apartment: t('checkout.apartment'),
    entrance: t('checkout.entrance'),
    floor: t('checkout.floor'),
    closing: t('confirmation.message.closing'),
    milliliters: t('product.ml'),
    fallbackProduct: t('confirmation.perfume'),
  }
  const message = buildOrderContactMessage(order, i18n.language, messageCopy)
  const addressLine = orderAddressLine(order, messageCopy)
  const position = journey.indexOf(order.status as typeof journey[number])
  const whatsapp = whatsappUrl(message)
  const telegram = telegramUrl(message)
  const max = maxContactUrl()

  function openMax() {
    if (!max) return
    const copyResult = copyContactMessage(message)
    window.open(max, '_blank', 'noopener,noreferrer')
    void copyResult.then((copied) => setMaxNotice(t(copied ? 'confirmation.maxCopied' : 'confirmation.maxCopyFailed')))
  }

  return <div className="page-shell confirmation-page">
    <div className="confirmation-hero">
      <span className="confirmation-seal"><Check size={35} /></span>
      <span className="eyebrow">OSIRIS · {t('confirmation.eyebrow')}</span>
      <h1>{t('confirmation.title')}</h1>
      <p>{t('confirmation.intro')}</p>
      <div className="confirmation-number"><small>{t('checkout.orderNumber')}</small><strong>{number}</strong></div>
    </div>
    <div className="panel confirmation-section confirmation-contact confirmation-contact-primary">
      <span className="eyebrow">OSIRIS CONTACT</span>
      <h2>{t('confirmation.contactTitle')}</h2>
      <div className="confirmation-contact-order"><Check size={18} /><span>{t('confirmation.accepted')}<strong>№ {number}</strong></span></div>
      <div className="confirmation-contact-summary" aria-label={t('cart.summary')}>
        {order.items.map((item, index) => <div key={item.id || index}><span>{orderItemName(item, i18n.language, t('confirmation.perfume'))}<small>{orderItemSize(item)} {t('product.ml')} × {item.quantity}</small></span><strong>{money(item.unitPrice * item.quantity, i18n.language)}</strong></div>)}
        <div className="confirmation-contact-total"><span>{t('common.total')}</span><strong>{money(order.total, i18n.language)}</strong></div>
      </div>
      <p>{t('confirmation.contactPrompt')}</p>
      <div className="confirmation-contact-actions">
        {whatsapp ? <a className="confirmation-contact-button channel-whatsapp" href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={22} /><span>WhatsApp</span><ArrowUpRight size={17} /></a> : <span className="confirmation-contact-button channel-whatsapp is-disabled" aria-disabled="true"><MessageCircle size={22} /><span>WhatsApp<small>{t('confirmation.contactUnavailable')}</small></span></span>}
        {telegram ? <a className="confirmation-contact-button channel-telegram" href={telegram} target="_blank" rel="noopener noreferrer"><Send size={22} /><span>Telegram</span><ArrowUpRight size={17} /></a> : <span className="confirmation-contact-button channel-telegram is-disabled" aria-disabled="true"><Send size={22} /><span>Telegram<small>{t('confirmation.contactUnavailable')}</small></span></span>}
        {max ? <button className="confirmation-contact-button channel-max" type="button" onClick={openMax}><MessageSquareText size={22} /><span>MAX</span><ArrowUpRight size={17} /></button> : <span className="confirmation-contact-button channel-max is-disabled" aria-disabled="true"><MessageSquareText size={22} /><span>MAX<small>{t('confirmation.contactUnavailable')}</small></span></span>}
      </div>
      {maxNotice && <p className="confirmation-copy-notice" role="status" aria-live="polite">{maxNotice}</p>}
      <p className="confirmation-contact-note">{t('confirmation.contactNote')}</p>
    </div>
    <div className="confirmation-layout">
      <div className="confirmation-main">
        <section className="panel confirmation-section">
          <div className="confirmation-heading"><PackageCheck size={23} /><h2>{t('confirmation.statusTitle')}</h2></div>
          <p className="muted">{t('confirmation.statusCopy')}</p>
          <div className="order-timeline">{journey.map((status, index) => <div key={status} className={position >= index ? 'done' : ''}><span></span><small>{t(`orderStatus.${status}`)}</small></div>)}</div>
          {order.status === 'CANCELLED' && <p className="form-error">{t('orderStatus.CANCELLED')}</p>}
        </section>
        <section className="panel confirmation-section">
          <h2>{t('confirmation.items')}</h2>
          {order.items.map((item, index) => <div className="confirmation-item" key={item.id || index}><img src={item.product?.mainImage || item.productImage || ''} alt="" /><div><strong>{orderItemName(item, i18n.language, t('confirmation.perfume'))}</strong><span>{orderItemSize(item)} {t('product.ml')} · {t('common.quantity')}: {item.quantity}</span></div><strong>{money(item.unitPrice * item.quantity, i18n.language)}</strong></div>)}
        </section>
      </div>
      <aside className="confirmation-aside">
        <div className="panel confirmation-section">
          <h2>{t('cart.summary')}</h2>
          <div className="summary-row"><span>{t('common.subtotal')}</span><span>{money(order.subtotal ?? order.total, i18n.language)}</span></div>
          <div className="summary-row"><span>{t('checkout.deliveryFee')}</span><span>{order.deliveryFee ? money(order.deliveryFee, i18n.language) : t('checkout.freeDelivery')}</span></div>
          {!!order.discountTotal && <div className="summary-row discount-row"><span>{t('checkout.discount')}</span><span>−{money(order.discountTotal, i18n.language)}</span></div>}
          <div className="summary-row total-row"><strong>{t('common.total')}</strong><strong>{money(order.total, i18n.language)}</strong></div>
          <div className="confirmation-meta"><span>{t('checkout.payment')}</span><strong>{t('confirmation.paymentPending')}</strong></div>
          <div className="confirmation-meta"><span>{t('checkout.delivery')}</span><strong>{t('checkout.kazanCourier')}</strong></div>
          {addressLine && <div className="confirmation-meta"><span>{t('checkout.street')}</span><strong>{addressLine}</strong></div>}
        </div>
        <Link to="/account" className="gold-button confirmation-track">{t('confirmation.trackOrder')}</Link>
      </aside>
    </div>
  </div>
}
