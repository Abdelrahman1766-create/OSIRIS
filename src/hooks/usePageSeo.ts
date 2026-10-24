import { useEffect } from 'react'

export interface PageSeo {
  title: string
  description: string
  canonicalPath?: string
  imagePath?: string
  type?: 'website' | 'product'
  locale?: 'ru' | 'en' | 'ar'
  noIndex?: boolean
  structuredData?: Record<string, unknown>
}

function siteOrigin() {
  const configured = import.meta.env.VITE_SITE_URL?.trim()
  return (configured || window.location.origin).replace(/\/$/, '')
}

function setMeta(attribute: 'name' | 'property', key: string, value: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attribute, key)
    document.head.append(tag)
  }
  tag.content = value
}

export function usePageSeo({
  title, description, canonicalPath, imagePath = '/og-image.jpg', type = 'website', locale,
  noIndex = false, structuredData,
}: PageSeo) {
  const structuredJson = structuredData ? JSON.stringify(structuredData) : ''

  useEffect(() => {
    const origin = siteOrigin()
    const canonical = new URL(canonicalPath || window.location.pathname, `${origin}/`).href
    const image = new URL(imagePath, `${origin}/`).href
    document.title = `${title} | OSIRIS`
    setMeta('name', 'description', description)
    setMeta('name', 'robots', noIndex ? 'noindex,nofollow' : 'index,follow')
    setMeta('property', 'og:site_name', 'OSIRIS')
    const language = locale || document.documentElement.lang
    setMeta('property', 'og:locale', language === 'ru' ? 'ru_RU' : language === 'ar' ? 'ar_SA' : 'en_US')
    setMeta('property', 'og:title', document.title)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:type', type)
    setMeta('property', 'og:url', canonical)
    setMeta('property', 'og:image', image)
    setMeta('name', 'twitter:card', 'summary_large_image')

    let canonicalLink = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonicalLink) {
      canonicalLink = document.createElement('link')
      canonicalLink.rel = 'canonical'
      document.head.append(canonicalLink)
    }
    canonicalLink.href = canonical

    let structuredScript = document.head.querySelector<HTMLScriptElement>('script[data-osiris-seo]')
    if (structuredJson) {
      if (!structuredScript) {
        structuredScript = document.createElement('script')
        structuredScript.type = 'application/ld+json'
        structuredScript.dataset.osirisSeo = ''
        document.head.append(structuredScript)
      }
      structuredScript.textContent = structuredJson
    } else {
      structuredScript?.remove()
    }
  }, [title, description, canonicalPath, imagePath, type, locale, noIndex, structuredJson])
}
