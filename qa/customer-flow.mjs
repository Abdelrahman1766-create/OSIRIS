import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const env = Object.fromEntries(readFileSync(new URL('../server/.env', import.meta.url), 'utf8').split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => {
  const [key, ...parts] = line.split('=')
  return [key, parts.join('=').trim().replace(/^"|"$/g, '')]
}))
const api = 'http://127.0.0.1:4000/api/v1'
const site = 'http://127.0.0.1:5173'

async function request(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${api}${path}`, { method, headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(body && { 'Content-Type': 'application/json' }) }, ...(body && { body: JSON.stringify(body) }) })
  const data = await response.json()
  assert.ok(response.ok, `${method} ${path}: ${JSON.stringify(data)}`)
  return data
}

const admin = await request('/auth/login', { method: 'POST', body: { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD } })
const supplier = await request('/auth/login', { method: 'POST', body: { email: env.DEMO_SUPPLIER_EMAIL, password: env.DEMO_SUPPLIER_PASSWORD } })
const previousDelivery = await request('/admin/delivery', { token: admin.token })
await request('/admin/delivery', { method: 'PUT', token: admin.token, body: { courierFee: 0, freeThreshold: null, isEnabled: true } })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' })
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
const checked = []
async function check(stage) {
  const result = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, title: document.title, lang: document.documentElement.lang }))
  assert.ok(result.width <= result.viewport + 1, `${stage}: horizontal overflow ${result.width}/${result.viewport}`)
  assert.ok(result.title.includes('OSIRIS'), `${stage}: title lacks OSIRIS`)
  assert.equal(result.lang, 'ru')
  assert.deepEqual(errors, [])
  checked.push(stage)
}

let orderNumber = ''
try {
  await page.goto(`${site}/register`, { waitUntil: 'domcontentloaded' })
  await page.locator('.auth-panel input').nth(0).fill('OSIRIS QA')
  await page.locator('.auth-panel input').nth(1).fill(`osiris-flow-${randomUUID().slice(0, 8)}@example.test`)
  await page.locator('.auth-panel input').nth(2).fill(`Qa!${randomUUID()}`)
  await page.locator('.auth-panel form button[type="submit"]').click()
  try { await page.waitForURL('**/account', { timeout: 10000 }) }
  catch (error) { console.log('REGISTER DIAGNOSTIC', page.url(), (await page.locator('.auth-panel').innerText()).slice(0, 800)); throw error }
  await check('registered')

  await page.goto(site, { waitUntil: 'domcontentloaded' })
  await page.locator('#bestsellers .product-card-name').first().waitFor()
  await page.locator('.home-preview-badge').first().waitFor({ state: 'hidden' })
  await check('homepage')
  await page.locator('#bestsellers .product-card-name').first().click()
  await page.locator('.variant-options button').nth(1).waitFor()
  assert.equal(await page.locator('.variant-options button').count(), 4)
  await page.locator('.variant-options button').nth(1).click()
  assert.match(await page.locator('.variant-options button.selected').innerText(), /30/)
  await check('product and 30 ml size')
  await page.locator('.product-buy .gold-button').click()
  await page.locator('.header-cart').click()
  await page.waitForURL('**/cart')
  assert.match(await page.locator('.cart-item').innerText(), /30/)
  await check('cart')

  await page.locator('.order-summary .gold-button').click()
  await page.waitForURL('**/checkout')
  await page.locator('.checkout-form .gold-button').first().waitFor()
  await page.locator('.checkout-form input[type="tel"]').fill('+79990001122')
  await page.locator('.checkout-form input[autocomplete="address-line1"]').fill('Баумана')
  await page.locator('.checkout-form .field-grid input').nth(4).fill('1')
  await check('checkout delivery')
  await page.locator('.checkout-form .gold-button').first().click()
  await page.getByText('Наличными при получении').first().waitFor()
  await check('checkout payment')
  await page.locator('.checkout-form button[type="submit"]').click()
  await page.waitForURL(/\/order-confirmation\/OS-\d{4}-\d+/)
  try { orderNumber = (await page.locator('.confirmation-number strong').innerText({ timeout: 10000 })).trim() }
  catch (error) { console.log('CONFIRMATION DIAGNOSTIC', page.url(), errors, (await page.locator('body').innerText()).slice(0, 1200)); throw error }
  assert.match(orderNumber, /^OS-\d{4}-\d{5,}$/)
  assert.match(await page.locator('.confirmation-item').innerText(), /30/)
  assert.ok(!(await page.locator('main').innerText()).toLowerCase().includes('поставщик'))
  await check('order confirmation')

  await page.locator('.confirmation-track').click()
  await page.waitForURL('**/account')
  await page.locator('.order-detail-link').first().click()
  await page.waitForURL(`**/order-confirmation/${orderNumber}`)
  await check('order tracking')

  const adminOrders = await request('/admin/orders?limit=100', { token: admin.token })
  const order = adminOrders.items.find((item) => item.orderNumber === orderNumber)
  assert.ok(order)
  await request(`/admin/orders/${order.id}/status`, { method: 'PATCH', token: admin.token, body: { status: 'CONFIRMED' } })
  const assigned = await request('/supplier/orders', { token: supplier.token })
  const item = assigned.find((entry) => entry.order.orderNumber === orderNumber)
  assert.ok(item)
  for (const status of ['PREPARING', 'SHIPPING', 'DELIVERED']) await request(`/supplier/order-items/${item.id}/status`, { method: 'PATCH', token: supplier.token, body: { status } })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('.order-timeline .done').last().waitFor()
  assert.equal(await page.locator('.order-timeline .done').count(), 5)
  await check('delivered tracking')
  console.log(JSON.stringify({ result: 'pass', orderNumber, width: 375, stages: checked }))
} finally {
  await context.close()
  await browser.close()
  await request('/admin/delivery', { method: 'PUT', token: admin.token, body: { courierFee: previousDelivery.courierFee, freeThreshold: previousDelivery.freeThreshold, isEnabled: previousDelivery.isEnabled } })
}
