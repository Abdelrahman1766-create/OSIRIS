import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Heart, Menu, Search, ShoppingBag, UserRound, X } from 'lucide-react'
import { setLanguage } from '../locales/i18n'
import { useStore } from '../store/useStore'

const nav = [
  { to: '/', key: 'home' }, { to: '/shop', key: 'shop' }, { to: '/fragrance-finder', key: 'finder' },
  { to: '/#story', key: 'about' }, { to: '/#contact', key: 'contact' },
]

export default function Navbar() {
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const cartCount = useStore((s) => s.cart.reduce((total, item) => total + item.quantity, 0))
  const favoriteCount = useStore((s) => s.favorites.length)
  const user = useStore((s) => s.user)
  const handleClose = () => setOpen(false)

  return <header className={`site-header ${pathname === '/' ? 'on-home' : ''}`}>
    <div className="header-inner">
      <button className="icon-button menu-trigger" onClick={() => setOpen(!open)} aria-label={open ? t('common.close') : 'Menu'}>{open ? <X size={22} /> : <Menu size={22} />}</button>
      <Link to="/" className="brand" onClick={handleClose} aria-label="OSIRIS home"><span className="brand-mark" aria-hidden="true">O</span><span>OSIRIS</span></Link>
      <nav className={`main-nav ${open ? 'is-open' : ''}`} aria-label="Main navigation">
        {nav.map(({ to, key }) => to.includes('#')
          ? <a key={key} href={to} onClick={handleClose}>{t(`nav.${key}`)}</a>
          : <NavLink key={key} to={to} end={to === '/'} onClick={handleClose}>{t(`nav.${key}`)}</NavLink>)}
        {user?.role === 'SUPPLIER' && <NavLink to="/supplier" onClick={handleClose}>{t('nav.supplier')}</NavLink>}
        {user?.role === 'ADMIN' && <NavLink to="/admin" onClick={handleClose}>{t('nav.admin')}</NavLink>}
      </nav>
      <div className="header-actions">
        <label className="language-control" aria-label="Language"><span aria-hidden>🌐</span><select aria-label="Language" value={i18n.language.slice(0, 2)} onChange={(event) => setLanguage(event.target.value as 'en' | 'ar' | 'ru')}><option value="ar">العربية</option><option value="en">English</option><option value="ru">Русский</option></select></label>
        <Link className="icon-button header-search" to="/shop" aria-label={t('common.search')}><Search size={19} /></Link>
        <Link className="icon-button header-favorites" to="/account?tab=favorites" aria-label={t('nav.favorites')}><Heart size={19} />{favoriteCount > 0 && <span className="mini-count">{favoriteCount}</span>}</Link>
        <Link className="icon-button header-account" to={user ? '/account' : '/login'} aria-label={t('nav.account')}><UserRound size={19} /></Link>
        <Link className="icon-button header-cart" to="/cart" aria-label={t('nav.cart')}><ShoppingBag size={19} />{cartCount > 0 && <span className="mini-count">{cartCount}</span>}</Link>
      </div>
    </div>
  </header>
}
