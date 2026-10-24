import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, MapPin, MessageCircle, MessageSquareText, Send, Truck } from 'lucide-react'
import { api } from '../services/api'
import { useStore } from '../store/useStore'
import type { Order } from '../types'
import { localized, money } from '../types'

type DeliveryOption = { method?: string; code?: string; enabled?: boolean; fee?: number; freeThreshold?: number | null }
type DeliveryOptionsResponse = { options?: DeliveryOption[]; items?: DeliveryOption[]; methods?: DeliveryOption[]; courier?: DeliveryOption }
type PromoPreview = { valid?: boolean; code?: string; discountTotal?: number; discount?: number; deliveryFee?: number; total?: number; message?: string }

export default function CheckoutPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const cart = useStore((s) => s.cart)
  const user = useStore((s) => s.user)
  const clearCart = useStore((s) => s.clearCart)
  const formRef = useRef<HTMLFormElement>(null)
  const requestId = useRef(crypto.randomUUID())
  const [orderCompleted, setOrderCompleted] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [form, setForm] = useState({ fullName: user?.name || '', phone: '', street: '', houseNumber: '', apartment: '', entrance: '', floor: '', deliveryComment: '' })
  const [deliveryOption, setDeliveryOption] = useState<DeliveryOption | null>(null)
  const [promoInput, setPromoInput] = useState('')
  const [promo, setPromo] = useState<PromoPreview | null>(null)
  const [promoError, setPromoError] = useState('')
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState('')
  const subtotal = cart.reduce((sum, item) => sum + item.variant.sellingPrice * item.quantity, 0)
  const baseFee = Number(deliveryOption?.fee || 0)
  const threshold = deliveryOption?.freeThreshold == null ? null : Number(deliveryOption.freeThreshold)
  const deliveryFee = promo?.deliveryFee !== undefined ? Number(promo.deliveryFee) : threshold !== null && subtotal >= threshold ? 0 : baseFee
  const discount = Number(promo?.discountTotal ?? promo?.discount ?? 0)
  const estimatedTotal = promo?.total !== undefined ? Number(promo.total) : subtotal + deliveryFee - discount
  const deliveryLabel = !deliveryOption ? t('common.loading') : deliveryOption.enabled === false ? t('checkout.deliveryUnavailable') : deliveryFee === 0 ? t('checkout.freeDelivery') : money(deliveryFee, i18n.language)
  const totalLabel = !deliveryOption || deliveryOption.enabled === false ? '—' : money(estimatedTotal, i18n.language)

  useEffect(() => {
    let active = true
    api<DeliveryOptionsResponse | DeliveryOption[]>('/delivery/options').then((data) => {
      if (!active) return
      const options = Array.isArray(data) ? data : data.options || data.items || data.methods || (data.courier ? [data.courier] : [])
      const courier = options.find((item) => (item.method || item.code) === 'KAZAN_COURIER')
      if (courier) setDeliveryOption(courier)
    }).catch(() => {})
    return () => { active = false }
  }, [])

  if (!cart.length && !orderCompleted) return <Navigate to="/cart" replace />
  if (!user) return <div className="page-shell empty-state"><h1>{t('cart.authPrompt')}</h1><Link to="/login" state={{ from: '/checkout' }} className="gold-button">{t('auth.login')}</Link></div>

  const items = cart.map((item) => ({ variantId: item.variant.id, quantity: item.quantity }))

  async function validatePromo() {
    const code = promoInput.trim().toUpperCase()
    if (!code) { setPromo(null); setPromoError(''); return }
    setValidating(true); setPromoError('')
    try {
      const result = await api<PromoPreview>('/promos/validate', { method: 'POST', body: JSON.stringify({ code, items }) })
      if (result.valid === false) { setPromo(null); setPromoError(result.message || t('checkout.promoInvalid')) }
      else { setPromo({ ...result, code }); setPromoInput(code) }
    } catch (cause) { setPromo(null); setPromoError(cause instanceof Error ? cause.message : t('checkout.promoInvalid')) }
    finally { setValidating(false) }
  }

  function nextStep() {
    if (formRef.current?.reportValidity()) { setError(''); setStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (step === 1) { nextStep(); return }
    if (!deliveryOption || deliveryOption.enabled === false) { setError(t('checkout.deliveryUnavailable')); return }
    if (cart.some((item) => item.variant.id.startsWith('preview-'))) { setError(t('checkout.demoError')); return }
    setLoading(true); setError('')
    try {
      const order = await api<Order>('/orders', { method: 'POST', body: JSON.stringify({
        items,
        shippingAddress: { fullName: form.fullName, city: 'Казань', street: form.street, houseNumber: form.houseNumber, apartment: form.apartment || undefined, entrance: form.entrance || undefined, floor: form.floor || undefined, deliveryComment: form.deliveryComment || undefined },
        phone: form.phone, deliveryMethod: 'KAZAN_COURIER', paymentMethod: 'CASH_ON_DELIVERY',
        promoCode: promo?.code, clientRequestId: requestId.current,
      }) })
      if (!order.orderNumber) throw new Error(t('checkout.error'))
      flushSync(() => setOrderCompleted(true))
      clearCart()
      navigate(`/order-confirmation/${encodeURIComponent(order.orderNumber)}`, { state: { order }, replace: true })
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('checkout.error')) }
    finally { setLoading(false) }
  }

  return <div className="page-shell checkout-page"><div className="page-intro"><span className="eyebrow">OSIRIS</span><h1>{t('checkout.title')}</h1><p>{t('checkout.kazanOnly')}</p></div>
    <div className="checkout-stepper"><span className={step === 1 ? 'active' : 'done'}>01 · {t('checkout.delivery')}</span><span className={step === 2 ? 'active' : ''}>02 · {t('checkout.payment')}</span></div>
    <div className="checkout-layout"><form ref={formRef} className="checkout-form panel" onSubmit={submit}>
      {step === 1 ? <><h2>{t('checkout.delivery')}</h2><div className="delivery-methods"><div className="delivery-choice selected"><Truck size={22} /><div><strong>{t('checkout.kazanCourier')}</strong><small>{deliveryLabel}</small></div></div><div className="delivery-choice disabled"><MapPin size={22} /><div><strong>{t('checkout.pickup')}</strong><small>{t('checkout.comingSoon')}</small></div></div><div className="delivery-choice disabled"><Truck size={22} /><div><strong>{t('checkout.otherCities')}</strong><small>{t('checkout.comingSoon')}</small></div></div></div>
        <div className="field-grid"><label className="form-field"><span>{t('checkout.fullName')}</span><input required autoComplete="name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label><label className="form-field"><span>{t('checkout.phone')}</span><input required type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label className="form-field"><span>{t('checkout.city')}</span><input value={t('checkout.kazan')} disabled /></label><label className="form-field"><span>{t('checkout.street')}</span><input required autoComplete="address-line1" value={form.street} onChange={(event) => setForm({ ...form, street: event.target.value })} /></label><label className="form-field"><span>{t('checkout.houseNumber')}</span><input required value={form.houseNumber} onChange={(event) => setForm({ ...form, houseNumber: event.target.value })} /></label><label className="form-field"><span>{t('checkout.apartment')} <small>{t('common.optional')}</small></span><input value={form.apartment} onChange={(event) => setForm({ ...form, apartment: event.target.value })} /></label><label className="form-field"><span>{t('checkout.entrance')} <small>{t('common.optional')}</small></span><input value={form.entrance} onChange={(event) => setForm({ ...form, entrance: event.target.value })} /></label><label className="form-field"><span>{t('checkout.floor')} <small>{t('common.optional')}</small></span><input value={form.floor} onChange={(event) => setForm({ ...form, floor: event.target.value })} /></label></div><label className="form-field"><span>{t('checkout.deliveryComment')} <small>{t('common.optional')}</small></span><textarea rows={3} value={form.deliveryComment} onChange={(event) => setForm({ ...form, deliveryComment: event.target.value })} /></label>
        {deliveryOption?.enabled === false && <p className="form-error">{t('checkout.deliveryUnavailable')}</p>}<button type="button" className="gold-button" disabled={!deliveryOption || deliveryOption.enabled === false} onClick={nextStep}>{t('checkout.continuePayment')} <ArrowRight size={16} /></button></>
        : <><button type="button" className="text-button checkout-back" onClick={() => setStep(1)}><ArrowLeft size={15} />{t('common.back')}</button><h2>{t('checkout.payment')}</h2><div className="checkout-contact-panel"><span className="checkout-contact-emblem"><MessageCircle size={25} /></span><div><h3>{t('checkout.contactPaymentTitle')}</h3><p>{t('checkout.contactPaymentCopy')}</p></div><div className="checkout-contact-channels" aria-label={t('checkout.contactChannelsLabel')}><span><MessageCircle size={18} />WhatsApp</span><span><Send size={18} />Telegram</span><span><MessageSquareText size={18} />MAX</span></div></div><div className="promo-form"><label className="form-field"><span>{t('checkout.promoCode')}</span><input value={promoInput} onChange={(event) => { setPromoInput(event.target.value); setPromo(null); setPromoError('') }} placeholder={t('checkout.promoPlaceholder')} /></label><button type="button" className="outline-button" onClick={validatePromo} disabled={validating || !promoInput.trim()}>{validating ? t('common.loading') : t('checkout.applyPromo')}</button></div>{promo && <p className="inline-message">{t('checkout.promoApplied', { code: promo.code })}</p>}{promoError && <p className="form-error" role="alert">{promoError}</p>}{error && <p className="form-error" role="alert">{error}</p>}<button className="gold-button" type="submit" disabled={loading}>{loading ? t('checkout.placing') : t('checkout.placeOrder')}</button><p className="muted payment-footnote">{t('checkout.paymentFootnote')}</p></>}
    </form><aside className="order-summary panel"><h2>{t('cart.summary')}</h2>{cart.map(({ product, variant, quantity }) => <div className="checkout-item" key={variant.id}><img src={product.mainImage} alt="" /><div><span>{localized(product.name, i18n.language)}</span><small>{variant.sizeMl} {t('product.ml')} × {quantity}</small></div><strong>{money(variant.sellingPrice * quantity, i18n.language)}</strong></div>)}<div className="summary-row"><span>{t('common.subtotal')}</span><span>{money(subtotal, i18n.language)}</span></div><div className="summary-row"><span>{t('checkout.deliveryFee')}</span><span>{deliveryLabel}</span></div>{promo && <div className="summary-row discount-row"><span>{t('checkout.discount')}</span><span>−{money(discount, i18n.language)}</span></div>}<div className="summary-row total-row"><strong>{t('common.total')}</strong><strong>{totalLabel}</strong></div></aside></div>
  </div>
}
