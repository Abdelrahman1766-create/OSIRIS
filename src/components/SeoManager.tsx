import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePageSeo, type PageSeo } from '../hooks/usePageSeo'

function StaticSeo(props: PageSeo) {
  usePageSeo(props)
  return null
}

export default function SeoManager() {
  const { pathname } = useLocation()
  const { t, i18n } = useTranslation()
  const locale = i18n.language.slice(0, 2) as 'ru' | 'en' | 'ar'
  if (pathname.startsWith('/product/') || pathname.startsWith('/products/')) return null

  let title = t('seo.homeTitle')
  let description = t('seo.homeDescription')
  let canonicalPath = '/'
  let noIndex = false

  if (pathname === '/shop' || pathname === '/products') {
    title = t('seo.shopTitle')
    description = t('seo.shopDescription')
    canonicalPath = '/shop'
  } else if (pathname === '/fragrance-finder') {
    title = t('seo.finderTitle')
    description = t('seo.finderDescription')
    canonicalPath = '/fragrance-finder'
  } else if (pathname === '/cart') {
    title = t('seo.cartTitle')
    description = t('seo.genericDescription')
    canonicalPath = '/cart'
    noIndex = true
  } else if (pathname === '/checkout') {
    title = t('seo.checkoutTitle')
    description = t('seo.genericDescription')
    canonicalPath = '/checkout'
    noIndex = true
  } else if (pathname.startsWith('/order-confirmation/')) {
    title = t('seo.confirmationTitle')
    description = t('seo.genericDescription')
    canonicalPath = pathname
    noIndex = true
  } else if (pathname === '/account') {
    title = t('seo.accountTitle')
    description = t('seo.genericDescription')
    canonicalPath = '/account'
    noIndex = true
  } else if (pathname === '/login') {
    title = t('seo.loginTitle')
    description = t('seo.genericDescription')
    canonicalPath = '/login'
    noIndex = true
  } else if (pathname === '/register' || pathname === '/supplier/register') {
    title = pathname.startsWith('/supplier') ? t('seo.supplierTitle') : t('seo.registerTitle')
    description = t('seo.genericDescription')
    canonicalPath = pathname
    noIndex = true
  } else if (pathname.startsWith('/supplier')) {
    title = t('seo.supplierTitle')
    description = t('seo.genericDescription')
    canonicalPath = '/supplier'
    noIndex = true
  } else if (pathname.startsWith('/admin')) {
    title = t('seo.adminTitle')
    description = t('seo.genericDescription')
    canonicalPath = '/admin'
    noIndex = true
  } else if (pathname !== '/') {
    noIndex = true
    canonicalPath = pathname
  }

  return <StaticSeo key={`${pathname}-${locale}`} title={title} description={description} canonicalPath={canonicalPath} noIndex={noIndex} locale={locale} />
}
