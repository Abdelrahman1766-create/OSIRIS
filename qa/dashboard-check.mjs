import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const env = Object.fromEntries(readFileSync(new URL('../server/.env', import.meta.url), 'utf8').split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => {
  const [name, ...parts] = line.split('=')
  return [name, parts.join('=').trim().replace(/^"|"$/g, '')]
}))
const origin = 'http://127.0.0.1:5173'
const api = 'http://127.0.0.1:4000/api/v1'
const browser = await chromium.launch({ headless: true })

async function login(email, password) {
  const response = await fetch(`${api}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
  assert.equal(response.status, 200)
  return response.json()
}

async function pageFor(identity, path) {
  const context = await browser.newContext({ viewport: { width: 390, height: 850 }, reducedMotion: 'reduce' })
  await context.addInitScript(({ identity }) => {
    localStorage.setItem('royal-essence-language', 'ru')
    localStorage.setItem('royal-essence-token', identity.token)
    localStorage.setItem('royal-essence-store', JSON.stringify({ state: { user: identity.user, cart: [], favorites: [] }, version: 0 }))
  }, { identity })
  const page = await context.newPage()
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(identity.user) }))
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded' })
  await page.locator('.dashboard-tabs').waitFor()
  return { context, page, errors }
}

const admin = await login(env.ADMIN_EMAIL, env.ADMIN_PASSWORD)
const adminPage = await pageFor(admin, '/admin')
const tabNames = ['overview', 'customers', 'users', 'suppliers', 'products', 'orders', 'reviews', 'promos', 'delivery', 'commission', 'marketing']
for (const [index, name] of tabNames.entries()) {
  await adminPage.page.locator('.dashboard-tabs button').nth(index).click()
  await adminPage.page.waitForTimeout(180)
  const state = await adminPage.page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, content: document.querySelector('main')?.textContent?.length || 0 }))
  assert.ok(state.content > 100, `${name}: empty dashboard`)
  assert.ok(state.width <= state.viewport + 1, `${name}: horizontal overflow ${state.width}/${state.viewport}`)
  if (['products', 'orders', 'promos', 'delivery'].includes(name)) await adminPage.page.screenshot({ path: `qa/admin-${name}-390.png`, fullPage: true, animations: 'disabled' })
  console.log(JSON.stringify({ role: 'ADMIN', tab: name, ...state }))
}
assert.deepEqual(adminPage.errors, [])
await adminPage.context.close()

const supplier = await login(env.DEMO_SUPPLIER_EMAIL, env.DEMO_SUPPLIER_PASSWORD)
const supplierPage = await pageFor(supplier, '/supplier')
await supplierPage.page.locator('.dashboard-tabs button').nth(1).click()
const addButton = supplierPage.page.getByRole('button', { name: /Добавить аромат/ }).first()
if (await addButton.count()) {
  await addButton.click()
  assert.ok(await supplierPage.page.locator('.variant-editor-row').count() === 4)
  await supplierPage.page.screenshot({ path: 'qa/supplier-variant-editor-390.png', fullPage: true, animations: 'disabled' })
}
const state = await supplierPage.page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }))
assert.ok(state.width <= state.viewport + 1)
assert.deepEqual(supplierPage.errors, [])
console.log(JSON.stringify({ role: 'SUPPLIER', tab: 'products', ...state }))
await supplierPage.context.close()
await browser.close()
