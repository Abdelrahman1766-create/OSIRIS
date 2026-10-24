import type { LocalizedText, Product, User, Order, Variant } from '../types'

export const API_BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '')
const tokenKey = 'osiris-token'
const legacyTokenKey = 'royal-essence-token'

export const authToken = {
  get: () => {
    const token = localStorage.getItem(tokenKey) || localStorage.getItem(legacyTokenKey)
    if (token && !localStorage.getItem(tokenKey)) localStorage.setItem(tokenKey, token)
    return token
  },
  set: (token: string) => { localStorage.setItem(tokenKey, token); localStorage.removeItem(legacyTokenKey) },
  clear: () => { localStorage.removeItem(tokenKey); localStorage.removeItem(legacyTokenKey) },
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = authToken.get()
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  } catch {
    throw new ApiError('The service is currently unavailable. Please try again later.', 0)
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(data?.message || data?.error || 'Something went wrong.', response.status)
  return data as T
}

const number = (value: unknown, fallback = 0) => Number(value ?? fallback) || fallback
const text = (value: unknown, fallback = '') => String(value ?? fallback)

const notes = (value: unknown) => Array.isArray(value) ? value.map(String) : []
export function normalizeVariant(raw: Record<string, unknown>): Variant {
  return { id: text(raw.id), sizeMl: number(raw.sizeMl), sellingPrice: number(raw.sellingPrice), stock: number(raw.stock), isActive: raw.isActive !== false }
}

export function normalizeProduct(raw: Record<string, unknown>): Product {
  const variants = Array.isArray(raw.variants) ? raw.variants.map((item) => normalizeVariant(item as Record<string, unknown>)) : []
  const priced = variants.filter((variant) => variant.isActive !== false && variant.sellingPrice > 0)
  const sellingPrice = priced.length ? Math.min(...priced.map((variant) => variant.sellingPrice)) : number(raw.sellingPrice)
  return {
    id: text(raw.id), slug: text(raw.slug),
    name: raw.name && typeof raw.name === 'object' ? raw.name as LocalizedText : {
      en: text(raw.nameEn), ar: text(raw.nameAr || raw.nameEn), ru: text(raw.nameRu || raw.nameEn),
    },
    description: raw.description && typeof raw.description === 'object' ? raw.description as LocalizedText : {
      en: text(raw.descriptionEn), ar: text(raw.descriptionAr || raw.descriptionEn), ru: text(raw.descriptionRu || raw.descriptionEn),
    },
    brand: 'OSIRIS', inspirationName: raw.inspirationName ? text(raw.inspirationName) : null,
    category: typeof raw.category === 'object' && raw.category !== null ? text((raw.category as Record<string, unknown>).name) : text(raw.category),
    family: raw.family && typeof raw.family === 'object' ? raw.family as LocalizedText : undefined,
    gender: (raw.gender || 'UNISEX') as Product['gender'],
    mainImage: text(raw.mainImage), gallery: Array.isArray(raw.gallery) ? raw.gallery.map(String) : Array.isArray(raw.images) ? raw.images.map(String) : [],
    sellingPrice,
    stockQuantity: number(raw.stockQuantity ?? raw.stock), rating: number(raw.rating), reviewCount: number(raw.reviewCount),
    variants: Array.isArray(raw.variants) ? variants : [{ id: text(raw.id), sizeMl: 100, sellingPrice, stock: number(raw.stockQuantity ?? raw.stock) }],
    topNotes: notes(raw.topNotes), middleNotes: notes(raw.middleNotes), baseNotes: notes(raw.baseNotes),
    localizedNotes: raw.localizedNotes && typeof raw.localizedNotes === 'object' ? raw.localizedNotes as Product['localizedNotes'] : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
  }
}

export interface ProductQuery { q?: string; gender?: string; category?: string; sort?: string; page?: number; limit?: number }
export async function getProducts(query: ProductQuery = {}) {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)) })
  const data = await api<{ items: Record<string, unknown>[]; total: number; pages: number }>(`/products?${params}`)
  return { items: data.items.map(normalizeProduct), total: data.total, pages: data.pages }
}
export async function getProduct(slug: string) { return normalizeProduct(await api<Record<string, unknown>>(`/products/${slug}`)) }
export async function login(email: string, password: string) { return api<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }) }
export async function register(name: string, email: string, password: string) { return api<{ token: string; user: User }>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }) }
export async function getOrders() { return api<Order[]>('/orders') }
