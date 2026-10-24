import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const env = Object.fromEntries(readFileSync(new URL('../server/.env', import.meta.url), 'utf8').split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => {
  const [name, ...parts] = line.split('=')
  return [name, parts.join('=').trim().replace(/^"|"$/g, '')]
}))
const api = 'http://127.0.0.1:4000/api/v1'
const origin = 'http://127.0.0.1:5173'

async function post(path, body, token) {
  const response = await fetch(`${api}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: JSON.stringify(body) })
  const data = await response.json()
  assert.ok(response.ok, `${path}: ${JSON.stringify(data)}`)
  return data
}

const product = (await (await fetch(`${api}/products?limit=1`)).json()).items[0]
const deliveryDisabled = !(await (await fetch(`${api}/delivery/options`)).json()).options[0].enabled
const variant = product.variants.find((item) => item.stock > 0)
const customer = await post('/auth/register', { name: 'Browser QA', email: `browser-${randomUUID().slice(0, 8)}@example.test`, password: `Qa!${randomUUID()}` })
const admin = await post('/auth/login', { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD })
const supplier = await post('/auth/login', { email: env.DEMO_SUPPLIER_EMAIL, password: env.DEMO_SUPPLIER_PASSWORD })
const browser = await chromium.launch({ headless: true })
const widths = process.env.QA_WIDTHS ? process.env.QA_WIDTHS.split(',').map(Number) : [320, 375, 390, 430, 768, 1440]
const results = []

async function check(width, route, identity, language = 'ru') {
  const context = await browser.newContext({ viewport: { width, height: 850 }, reducedMotion: 'reduce' })
  await context.addInitScript(({ identity, language, product, variant }) => {
    localStorage.setItem('royal-essence-language', language)
    if (identity) {
      localStorage.setItem('royal-essence-token', identity.token)
      localStorage.setItem('royal-essence-store', JSON.stringify({ state: { user: identity.user, cart: identity.user.role === 'CUSTOMER' ? [{ product, variant, quantity: 1 }] : [], favorites: [] }, version: 0 }))
    }
  }, { identity, language, product, variant })
  const page = await context.newPage()
  if (identity) await page.route('**/api/v1/auth/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(identity.user) }))
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' })
  await page.locator('h1').first().waitFor({ timeout: 20000 })
  if (route === '/admin') {
    try { await page.locator('.dashboard-tabs').waitFor({ timeout: 10000 }) }
    catch (error) { console.log('ADMIN DIAGNOSTIC', width, (await page.locator('body').innerText()).slice(0, 1000)); throw error }
  }
  if (route === '/supplier') await page.locator('.dashboard-tabs').waitFor({ timeout: 20000 })
  if (route === '/checkout' && deliveryDisabled) {
    await page.locator('.checkout-form .form-error').waitFor({ timeout: 10000 })
    assert.ok(await page.locator('.checkout-form .gold-button').first().isDisabled())
    assert.ok(!(await page.locator('.order-summary').innerText()).includes('Бесплатная доставка'))
  }
  await page.waitForTimeout(250)
  const metrics = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth, direction: document.documentElement.dir, title: document.title, heading: document.querySelector('h1')?.textContent?.trim() }))
  const result = { width, route, role: identity?.user.role || 'PUBLIC', language, errors, ...metrics }
  results.push(result)
  console.log(JSON.stringify(result))
  if (metrics.width > width + 1 || errors.length) await page.screenshot({ path: `qa/error-${identity?.user.role || 'public'}-${language}-${width}-${route.replaceAll('/', '-') || 'home'}.png`, fullPage: true, animations: 'disabled' })
  if (width === 390 && ['/admin', '/supplier', '/checkout'].includes(route)) await page.screenshot({ path: `qa/review-${route.slice(1)}-390.png`, fullPage: true, animations: 'disabled' })
  if (route.startsWith('/product/') && language === 'ru') {
    const options = page.locator('.variant-options button')
    assert.ok(await options.count() >= 2)
    await options.nth(1).click()
    assert.ok((await page.locator('.product-price').textContent())?.includes('₽'))
  }
  if (route === '/admin' && width === 390) {
    for (const name of ['Промокоды', 'Delivery details', 'Клиенты']) {
      const button = page.getByRole('button', { name, exact: true })
      if (await button.count()) { await button.first().click(); await page.waitForTimeout(120); assert.ok(await page.locator('main h2').count() > 0) }
    }
  }
  await context.close()
}

for (const width of widths) {
  await check(width, '/shop', null)
  await check(width, `/product/${product.slug}`, null)
  await check(width, '/cart', customer)
  await check(width, '/checkout', customer)
  await check(width, '/admin', admin)
  await check(width, '/supplier', supplier)
}
await check(390, '/shop', null, 'ar')
await check(390, `/product/${product.slug}`, null, 'ar')
await browser.close()
assert.ok(results.every((result) => result.width <= result.viewport + 1 && result.errors.length === 0), 'Browser layout or runtime error')
