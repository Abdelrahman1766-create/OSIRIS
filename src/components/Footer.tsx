import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CONTACT, telegramUrl, whatsappUrl } from '../config/contact'

export default function Footer() {
  const { t } = useTranslation()
  return <footer className="site-footer" id="contact">
    <div className="footer-inner">
      <div className="footer-brand"><Link to="/" className="brand"><span className="brand-mark" aria-hidden="true">O</span><span>OSIRIS</span></Link><p>{t('footer.tagline')}</p></div>
      <div className="footer-links"><span className="footer-label">{t('footer.explore')}</span><Link to="/shop">{t('nav.shop')}</Link><Link to="/fragrance-finder">{t('nav.finder')}</Link><Link to="/#story">{t('nav.about')}</Link></div>
      <div className="footer-links"><span className="footer-label">{t('footer.help')}</span>{CONTACT.whatsapp && <a href={whatsappUrl(t('contact.whatsappGeneral'))} target="_blank" rel="noopener noreferrer">WhatsApp</a>}{CONTACT.telegram && <a href={telegramUrl()} target="_blank" rel="noopener noreferrer">Telegram</a>}<Link to="/account">{t('nav.account')}</Link></div>
    </div>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} OSIRIS. {t('footer.rights')}</span><span>{t('footer.crafted')} ✦</span></div>
  </footer>
}
