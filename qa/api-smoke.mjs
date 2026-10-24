import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const env = Object.fromEntries(readFileSync(new URL('../server/.env', import.meta.url), 'utf8').split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => {
  const [name, ...parts] = line.split('=')
  return [name, parts.join('=').trim().replace(/^"|"$/g, '')]
}))
const base = 'http://127.0.0.1:4000/api/v1'
const suffix = randomUUID().slice(0, 8)

async function request(path, { token, method = 'GET', body, expected = 200 } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(body && { 'Content-Type': 'application/json' }) },
    ...(body && { body: JSON.stringify(body) }),
  })
  const data = await response.json().catch(() => null)
  assert.equal(response.status, expected, `${method} ${path}: ${response.status} ${JSON.stringify(data)}`)
  return data
}

const health = await request('/health')
assert.equal(health.status, 'ok')
const catalog = await request('/products?limit=48')
assert.ok(catalog.items.length > 0)
const product = catalog.items.find((item) => item.variants?.some((variant) => variant.stock >= 3))
assert.ok(product)
const productJson = JSON.stringify(product).toLowerCase()
for (const privateKey of ['supplierid', 'supplierprice', 'suppliercost', 'shopname', 'contactphone', 'contactemail', 'sku']) assert.ok(!productJson.includes(privateKey), `Public product leaked ${privateKey}`)
assert.equal(product.brand, 'OSIRIS')
assert.equal((await request('/products?brand=OSIRIS')).total, catalog.total)
assert.equal((await request('/products?brand=OTHER')).total, 0)
assert.equal((await request(`/products/${product.slug}`)).slug, product.slug)
await request('/suppliers/example', { expected: 404 })

const customerEmail = `qa-${suffix}@example.test`
const customer = await request('/auth/register', { method: 'POST', expected: 201, body: { name: 'QA Customer', email: customerEmail, password: `Qa!${randomUUID()}` } })
assert.equal(customer.user.role, 'CUSTOMER')
await request('/admin/stats', { token: customer.token, expected: 403 })
const admin = await request('/auth/login', { method: 'POST', body: { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD } })
const supplier = await request('/auth/login', { method: 'POST', body: { email: env.DEMO_SUPPLIER_EMAIL, password: env.DEMO_SUPPLIER_PASSWORD } })
assert.equal(admin.user.role, 'ADMIN')
assert.equal(supplier.user.role, 'SUPPLIER')
const adminProducts = await request('/admin/products?limit=100', { token: admin.token })
const editable = adminProducts.items.find((item) => item.id === product.id)?.variants.find((item) => item.sizeMl === product.variants[0].sizeMl)
assert.ok(editable)
await request(`/admin/variants/${editable.id}`, { token: customer.token, method: 'PATCH', expected: 403, body: { stock: editable.stock + 1 } })
await request(`/admin/variants/${editable.id}`, { token: admin.token, method: 'PATCH', body: { stock: editable.stock + 1 } })
assert.equal((await request(`/products/${product.slug}`)).variants.find((item) => item.id === editable.id).stock, editable.stock + 1)
await request(`/admin/variants/${editable.id}`, { token: admin.token, method: 'PATCH', body: { stock: editable.stock } })

await request('/admin/delivery', { token: admin.token, method: 'PUT', body: { courierFee: 0, freeThreshold: null, isEnabled: false } })
const deliveryBefore = await request('/delivery/options')
assert.equal(deliveryBefore.options[0].enabled, false)
await request('/admin/delivery', { token: admin.token, method: 'PUT', body: { courierFee: 250, freeThreshold: 10000, isEnabled: true } })
const delivery = await request('/delivery/options')
assert.equal(delivery.options[0].fee, 250)
const promo = await request('/admin/promos', { token: admin.token, method: 'POST', expected: 201, body: { code: `QA${suffix}`, type: 'FIXED', value: 500, minimumOrder: 1000, usageLimit: 1, isEnabled: true } })

const variant = product.variants.find((item) => item.stock >= 3)
await request('/favorites', { token: customer.token, method: 'POST', expected: 201, body: { productId: product.id } })
const favorites = await request('/favorites', { token: customer.token })
assert.ok(favorites.some((item) => item.id === product.id))
await request('/cart', { token: customer.token, method: 'POST', expected: 201, body: { variantId: variant.id, quantity: 1 } })
const cart = await request('/cart', { token: customer.token })
assert.equal(cart.items[0].variant.sizeMl, variant.sizeMl)
const quote = await request('/promos/validate', { token: customer.token, method: 'POST', body: { code: promo.code, items: [{ variantId: variant.id, quantity: 1 }] } })
assert.equal(quote.discountTotal, 500)
const orderPayload = {
  items: [{ variantId: variant.id, quantity: 1 }],
  shippingAddress: { fullName: 'QA Customer', city: 'Казань', street: 'Баумана', houseNumber: '1', apartment: '2', entrance: '1', floor: '2' },
  phone: '+79990000000', deliveryMethod: 'KAZAN_COURIER', paymentMethod: 'CASH_ON_DELIVERY', promoCode: promo.code,
  clientRequestId: randomUUID(),
}
const order = await request('/orders', { token: customer.token, method: 'POST', expected: 201, body: orderPayload })
assert.match(order.orderNumber, /^OS-\d{4}-\d{5,}$/)
assert.equal(order.items[0].sizeMl, variant.sizeMl)
assert.equal(order.total, quote.total)
for (const privateKey of ['supplierid', 'supplierprice', 'suppliercost', 'shopname', 'platformprofit', '"id"']) assert.ok(!JSON.stringify(order).toLowerCase().includes(privateKey), `Customer order leaked ${privateKey}`)
assert.equal((await request('/orders', { token: customer.token }))[0].orderNumber, order.orderNumber)
assert.equal((await request(`/orders/${order.orderNumber}`, { token: customer.token })).orderNumber, order.orderNumber)
const duplicate = await request('/orders', { token: customer.token, method: 'POST', body: orderPayload })
assert.equal(duplicate.orderNumber, order.orderNumber)

const other = await request('/auth/register', { method: 'POST', expected: 201, body: { name: 'Other Customer', email: `qa-other-${suffix}@example.test`, password: `Qa!${randomUUID()}` } })
await request(`/orders/${order.orderNumber}`, { token: other.token, expected: 404 })
const promos = await request('/admin/promos', { token: admin.token })
assert.equal(promos.items.find((item) => item.id === promo.id).usedCount, 1)
await request('/promos/validate', { token: customer.token, method: 'POST', expected: 422, body: { code: promo.code, items: [{ variantId: variant.id, quantity: 1 }] } })

const beforeConfirmation = await request('/supplier/orders', { token: supplier.token })
assert.ok(!beforeConfirmation.some((item) => item.order.orderNumber === order.orderNumber))
const adminOrders = await request('/admin/orders?limit=100', { token: admin.token })
const adminOrder = adminOrders.items.find((item) => item.orderNumber === order.orderNumber)
assert.ok(adminOrder)
await request(`/admin/orders/${adminOrder.id}/status`, { token: admin.token, method: 'PATCH', body: { status: 'CONFIRMED' } })
const assigned = await request('/supplier/orders', { token: supplier.token })
const supplierItem = assigned.find((item) => item.order.orderNumber === order.orderNumber)
assert.ok(supplierItem)
for (const status of ['PREPARING', 'SHIPPING', 'DELIVERED']) await request(`/supplier/order-items/${supplierItem.id}/status`, { token: supplier.token, method: 'PATCH', body: { status } })
const delivered = await request(`/orders/${order.orderNumber}`, { token: customer.token })
assert.equal(delivered.status, 'DELIVERED')
const stats = await request('/admin/stats', { token: admin.token })
assert.ok(stats.today && stats.thisMonth)
const business = await request('/admin/business-stats', { token: admin.token })
assert.ok(business.deliveredOrders >= 1)
assert.ok(Array.isArray(business.topSizes) && Array.isArray(business.lowStock) && Array.isArray(business.recentOrders))
const customers = await request('/admin/customers?limit=100', { token: admin.token })
const customerProfile = customers.items.find((item) => item.email === customerEmail)
assert.ok(customerProfile)
const customerDetail = await request(`/admin/customers/${customerProfile.id}`, { token: admin.token })
assert.ok(customerDetail.favorites.some((item) => item.product.id === product.id))
assert.ok(customerDetail.orders.some((item) => item.orderNumber === order.orderNumber))
await request(`/admin/promos/${promo.id}`, { token: admin.token, method: 'PATCH', body: { isEnabled: false } })
await request('/admin/delivery', { token: admin.token, method: 'PUT', body: { courierFee: 0, freeThreshold: null, isEnabled: false } })

console.log(JSON.stringify({ health: health.status, catalog: catalog.total, orderNumber: order.orderNumber, sizeMl: variant.sizeMl, promoUsedCount: 1, finalStatus: delivered.status, privacy: 'pass', roleChecks: 'pass', adminDashboard: 'pass' }))
