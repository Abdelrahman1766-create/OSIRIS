import { MessageCircle, MessageSquareText, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { CONTACT, maxContactUrl, telegramUrl, whatsappUrl } from '../config/contact'
import { money } from '../types'

export default function ContactButtons({ product, quantity = 1, price = 0 }: { product?: string; quantity?: number; price?: number }) {
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  const message = product
    ? t('contact.whatsappMessage', { product, quantity, price: money(price * quantity, i18n.language) })
    : t('contact.whatsappGeneral')
  const maxUrl = maxContactUrl()
  if (pathname.startsWith('/admin') || pathname.startsWith('/supplier')) return null
  if (!CONTACT.whatsapp && !CONTACT.telegram && !maxUrl) return null
  return <div className="floating-contact" aria-label="Contact options">
    {CONTACT.whatsapp && <a href={whatsappUrl(message)} target="_blank" rel="noopener noreferrer" aria-label={t('contact.whatsapp')} title={t('contact.whatsapp')} className="contact-whatsapp"><MessageCircle size={23} /></a>}
    {CONTACT.telegram && <a href={telegramUrl()} target="_blank" rel="noopener noreferrer" aria-label={t('contact.telegram')} title={t('contact.telegram')} className="contact-telegram"><Send size={20} /></a>}
    {maxUrl && <a href={maxUrl} target="_blank" rel="noopener noreferrer" aria-label="MAX" title="MAX" className="contact-max"><MessageSquareText size={21} /></a>}
  </div>
}
