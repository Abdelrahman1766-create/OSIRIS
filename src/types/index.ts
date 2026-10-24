export type Language = 'en' | 'ar' | 'ru'
export type LocalizedText = Record<Language, string>
export type Gender = 'MEN' | 'WOMEN' | 'UNISEX'
export type Role = 'CUSTOMER' | 'SUPPLIER' | 'ADMIN'
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED'
export type DeliveryMethod = 'KAZAN_COURIER' | 'PICKUP' | 'RUSSIA_SHIPPING'
export type PaymentMethod = 'CASH_ON_DELIVERY' | 'BANK_TRANSFER'

export interface Variant { id: string; sizeMl: number; sellingPrice: number; stock: number; isActive?: boolean }

export interface Product {
  id: string
  slug: string
  name: LocalizedText
  description: LocalizedText
  brand: string
  inspirationName?: string | null
  category: string
  family?: LocalizedText
  gender: Gender
  mainImage: string
  gallery: string[]
  sellingPrice: number
  stockQuantity: number
  variants: Variant[]
  rating: number
  reviewCount: number
  topNotes: string[]
  middleNotes: string[]
  baseNotes: string[]
  localizedNotes?: { top: Record<Language, string[]>; middle: Record<Language, string[]>; base: Record<Language, string[]> }
  createdAt?: string
}

export interface CartItem { product: Product; variant: Variant; quantity: number }
export interface User { id: string; name: string; email: string; role: Role }
export interface Address {
  fullName: string
  street: string
  houseNumber: string
  apartment?: string
  entrance?: string
  floor?: string
  deliveryComment?: string
  city: string
}
export interface OrderItem {
  id?: string
  quantity: number
  unitPrice: number
  product?: Product
  productName?: string
  productNameAr?: string
  productNameRu?: string
  productImage?: string
  sizeMl?: number
  variantSizeMl?: number
  variant?: Pick<Variant, 'sizeMl'>
  variantId?: string
}
export interface Order {
  id?: string
  orderNumber?: string
  status: OrderStatus
  subtotal?: number
  deliveryFee?: number
  discountTotal?: number
  total: number
  currency?: string
  deliveryMethod?: DeliveryMethod
  paymentMethod?: PaymentMethod
  createdAt: string
  items: OrderItem[]
  shippingAddress?: Address
  phone?: string
  paymentStatus?: 'PENDING' | 'PAID' | 'REFUNDED'
  customer?: Pick<User, 'id' | 'name' | 'email'>
}

export const localized = (value: LocalizedText | undefined, language: string) =>
  value?.[language as Language] || value?.en || ''

export const money = (value: number, language = 'ru') =>
  new Intl.NumberFormat(language === 'ar' ? 'ar' : language === 'ru' ? 'ru' : 'en', {
    style: 'currency', currency: 'RUB', maximumFractionDigits: 0,
  }).format(value)
