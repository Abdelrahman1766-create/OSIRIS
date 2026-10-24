import { useEffect, useState } from 'react'
import { MessageCircle, MessageSquareText, Search, Send, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { copyContactMessage, maxContactUrl, telegramUrl, whatsappUrl } from '../config/contact'
import './FragranceInquiryBanner.css'

export default function FragranceInquiryBanner() {
  const { t } = useTranslation()
  const [notice, setNotice] = useState('')
  const inquiry = t('home.fragranceInquiryMessage')
  const whatsapp = whatsappUrl(inquiry)
  const telegram = telegramUrl(inquiry)
  const max = maxContactUrl()

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 4200)
    return () => window.clearTimeout(timer)
  }, [notice])

  function openMax() {
    if (!max) return
    const copied = copyContactMessage(inquiry)
    window.open(max, '_blank', 'noopener,noreferrer')
    void copied.then((success) => setNotice(t(success ? 'contact.maxCopied' : 'contact.maxCopyFailed')))
  }

  return <aside className="fragrance-inquiry" aria-labelledby="fragrance-inquiry-title">
    <span className="fragrance-inquiry-glow" aria-hidden="true" />
    <div className="page-shell fragrance-inquiry-inner">
      <div className="fragrance-inquiry-icon" aria-hidden="true"><Search size={23} strokeWidth={1.45} /><Sparkles size={12} strokeWidth={1.4} /></div>
      <div className="fragrance-inquiry-copy">
        <h2 id="fragrance-inquiry-title">{t('home.fragranceInquiryTitle')}</h2>
        <p>{t('home.fragranceInquiryDescription')}</p>
        <strong>{t('home.fragranceInquiryCta')}</strong>
      </div>
      <div className="fragrance-inquiry-actions" aria-label={t('home.fragranceInquiryContacts')}>
        {whatsapp
          ? <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label={t('contact.whatsapp')}><MessageCircle size={18} /><span>WhatsApp</span></a>
          : <span className="is-disabled" aria-disabled="true"><MessageCircle size={18} /><span>WhatsApp</span></span>}
        {telegram
          ? <a href={telegram} target="_blank" rel="noopener noreferrer" aria-label={t('contact.telegram')}><Send size={17} /><span>Telegram</span></a>
          : <span className="is-disabled" aria-disabled="true"><Send size={17} /><span>Telegram</span></span>}
        {max
          ? <button type="button" onClick={openMax} aria-label={t('contact.max')}><MessageSquareText size={18} /><span>MAX</span></button>
          : <span className="is-disabled" aria-disabled="true"><MessageSquareText size={18} /><span>MAX</span></span>}
      </div>
      {notice && <p className="fragrance-inquiry-notice" role="status" aria-live="polite">{notice}</p>}
    </div>
  </aside>
}
