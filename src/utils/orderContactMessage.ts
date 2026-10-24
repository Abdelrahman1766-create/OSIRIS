import type { Language, Order, OrderItem } from '../types'
import { localized, money } from '../types'

export interface OrderContactCopy {
  greeting: string
  orderCreated: string
  items: string
  subtotal: string
  discount: string
  delivery: string
  total: string
  customer: string
  phone: string
  deliveryMethod: string
  deliveryMethodValue: string
  address: string
  apartment: string
  entrance: string
  floor: string
  closing: string
  milliliters: string
  fallbackProduct: string
}

function languageCode(language: string): Language {
  return language.startsWith('ar') ? 'ar' : language.startsWith('en') ? 'en' : 'ru'
}

export function orderItemName(item: OrderItem, language: string, fallback: string) {
  if (item.product?.name) return localized(item.product.name, language)
  const current = languageCode(language)
  if (current === 'ar') return item.productNameAr || item.productName || item.productNameRu || fallback
  if (current === 'ru') return item.productNameRu || item.productName || item.productNameAr || fallback
  return item.productName || item.productNameRu || item.productNameAr || fallback
}

export function orderItemSize(item: OrderItem) {
  return item.sizeMl ?? item.variantSizeMl ?? item.variant?.sizeMl ?? 0
}

export function orderAddressLine(order: Order, copy: Pick<OrderContactCopy, 'apartment' | 'entrance' | 'floor'>) {
  const address = order.shippingAddress
  if (!address) return ''
  return [
    address.city,
    [address.street, address.houseNumber].filter(Boolean).join(' '),
    address.apartment && `${copy.apartment} ${address.apartment}`,
    address.entrance && `${copy.entrance} ${address.entrance}`,
    address.floor && `${copy.floor} ${address.floor}`,
  ].filter(Boolean).join(', ')
}

export function buildOrderContactMessage(order: Order, language: string, copy: OrderContactCopy) {
  const subtotal = order.subtotal ?? order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const discount = order.discountTotal ?? 0
  const delivery = order.deliveryFee ?? 0
  const address = orderAddressLine(order, copy)
  const customerName = order.shippingAddress?.fullName || order.customer?.name || ''
  const lines = [
    copy.greeting,
    copy.orderCreated,
    '',
    `${copy.items}:`,
    ...order.items.map((item) => `• ${orderItemName(item, language, copy.fallbackProduct)} — ${orderItemSize(item)} ${copy.milliliters} × ${item.quantity} — ${money(item.unitPrice * item.quantity, language)}`),
    '',
    `${copy.subtotal}: ${money(subtotal, language)}`,
    ...(discount > 0 ? [`${copy.discount}: −${money(discount, language)}`] : []),
    `${copy.delivery}: ${money(delivery, language)}`,
    `${copy.total}: ${money(order.total, language)}`,
    '',
    ...(customerName ? [`${copy.customer}: ${customerName}`] : []),
    ...(order.phone ? [`${copy.phone}: ${order.phone}`] : []),
    `${copy.deliveryMethod}: ${copy.deliveryMethodValue}`,
    ...(address ? [`${copy.address}: ${address}`] : []),
    '',
    copy.closing,
  ]
  return lines.join('\n')
}
