import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const siteUrl = (process.env.VITE_SITE_URL || process.env.SITE_URL || '').trim().replace(/\/$/, '')
const baseRobots = `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /supplier\nDisallow: /account\nDisallow: /cart\nDisallow: /checkout\nDisallow: /order-confirmation/\nDisallow: /login\nDisallow: /register\n`

if (!siteUrl) {
  writeFileSync(join('dist', 'robots.txt'), baseRobots)
  console.log('Sitemap skipped: set VITE_SITE_URL to the public storefront origin.')
  process.exit(0)
}

const origin = new URL(siteUrl)
if (!['https:', 'http:'].includes(origin.protocol)) throw new Error('VITE_SITE_URL must use HTTP or HTTPS')
const apiUrl = (process.env.SITEMAP_API_URL || process.env.VITE_API_URL || '').trim()
const paths = new Set(['/', '/shop', '/fragrance-finder'])

if (/^https?:\/\//.test(apiUrl)) {
  try {
    for (let page = 1; page <= 100; page++) {
      const url = new URL(`${apiUrl.replace(/\/$/, '')}/products`)
      url.searchParams.set('page', String(page))
      url.searchParams.set('limit', '48')
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (!response.ok) throw new Error(`Catalog returned ${response.status}`)
      const result = await response.json()
      for (const product of result.items || []) if (product.slug) paths.add(`/product/${encodeURIComponent(product.slug)}`)
      if (page >= (result.pages || 1)) break
    }
  } catch (error) {
    console.warn(`Product sitemap entries skipped: ${error instanceof Error ? error.message : error}`)
  }
}

const escapeXml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const entries = [...paths].map((path) => `  <url><loc>${escapeXml(new URL(path, origin).href)}</loc></url>`).join('\n')
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`
writeFileSync(join('dist', 'sitemap.xml'), sitemap)
writeFileSync(join('dist', 'robots.txt'), `${baseRobots}Sitemap: ${new URL('/sitemap.xml', origin).href}\n`)
console.log(`Generated sitemap with ${paths.size} URLs for ${origin.origin}`)
