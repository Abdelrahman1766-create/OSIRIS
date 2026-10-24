import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { CONTACT, whatsappUrl } from '../config/contact'
import { useStore } from '../store/useStore'
import { localized, money } from '../types'

export default function CartPage() {
  const { t, i18n } = useTranslation()
  const cart = useStore((s) => s.cart)
  const updateQuantity = useStore((s) => s.updateQuantity)
  const remove = useStore((s) => s.removeFromCart)
  const subtotal = cart.reduce((sum, item) => sum + item.variant.sellingPrice * item.quantity, 0)
  const whatsappMessage = cart.map((item) => t('contact.whatsappMessage', {
    product: `${localized(item.product.name, i18n.language)} · ${item.variant.sizeMl} ${t('product.ml')}`,
    quantity: item.quantity,
    price: money(item.variant.sellingPrice * item.quantity, i18n.language),
  })).join('\n\n')

  return <div className="page-shell cart-page"><div className="page-intro"><span className="eyebrow">{t('cart.eyebrow')}</span><h1>{t('cart.title')}</h1></div>
    {cart.length ? <div className="cart-layout"><div className="cart-items">{cart.map(({ product, variant, quantity }) => <article className="cart-item" key={variant.id}>
      <Link to={`/product/${product.slug}`} className="cart-image"><img src={product.mainImage} alt={localized(product.name, i18n.language)} /></Link>
      <div className="cart-item-info"><span className="eyebrow">OSIRIS</span><Link to={`/product/${product.slug}`}><h2>{localized(product.name, i18n.language)}</h2></Link><p className="cart-variant">{variant.sizeMl} {t('product.ml')}</p><span>{money(variant.sellingPrice, i18n.language)}</span><div className="quantity-control"><button onClick={() => updateQuantity(variant.id, quantity - 1)} aria-label={t('common.decreaseQuantity')}><Minus size={15} /></button><span>{quantity}</span><button onClick={() => updateQuantity(variant.id, quantity + 1)} aria-label={t('common.increaseQuantity')}><Plus size={15} /></button></div></div>
      <div className="cart-item-end"><strong>{money(variant.sellingPrice * quantity, i18n.language)}</strong><button className="icon-button" aria-label={t('common.remove')} onClick={() => remove(variant.id)}><Trash2 size={17} /></button></div>
    </article>)}</div><aside className="order-summary panel"><h2>{t('cart.summary')}</h2><div className="summary-row"><span>{t('common.subtotal')}</span><span>{money(subtotal, i18n.language)}</span></div><p className="muted">{t('cart.shipping')}</p><div className="summary-row total-row"><strong>{t('common.total')}</strong><strong>{money(subtotal, i18n.language)}</strong></div><Link to="/checkout" className="gold-button">{t('cart.checkout')}</Link>{CONTACT.whatsapp && <a className="outline-button" href={whatsappUrl(whatsappMessage)} target="_blank" rel="noopener noreferrer">{t('cart.whatsapp')}</a>}</aside></div>
      : <div className="empty-state cart-empty"><span className="empty-icon">✦</span><h2>{t('cart.empty')}</h2><Link to="/shop" className="gold-button">{t('common.startShopping')}</Link></div>}
  </div>
}
