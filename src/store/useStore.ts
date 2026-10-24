import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, Product, User, Variant } from '../types'
import { api, authToken, normalizeProduct, normalizeVariant } from '../services/api'

interface CommerceState {
  cart: CartItem[]
  favorites: string[]
  user: User | null
  addToCart: (product: Product, variant: Variant, quantity?: number) => void
  updateQuantity: (variantId: string, quantity: number) => void
  removeFromCart: (variantId: string) => void
  clearCart: () => void
  syncRemoteCart: () => Promise<void>
  toggleFavorite: (id: string) => void
  setFavorites: (ids: string[]) => void
  setUser: (user: User | null) => void
  signOut: () => void
}

type RemoteCartItem = { variantId: string; quantity: number; product: Record<string, unknown>; variant: Record<string, unknown> }
const validQuantity = (quantity: number, variant: Variant) => Math.min(Math.max(1, quantity), Math.max(1, Math.min(variant.stock, 20)))
const isPreview = (id: string) => id.startsWith('preview-')
const isRetiredCatalogItem = (item: CartItem) => item.product.slug?.startsWith('ru-') || isPreview(item.product.id)

const previousStore = localStorage.getItem('royal-essence-store')
if (previousStore && !localStorage.getItem('osiris-store')) localStorage.setItem('osiris-store', previousStore)

export const useStore = create<CommerceState>()(persist((set, get) => ({
  cart: [], favorites: [], user: null,
  addToCart: (product, variant, quantity = 1) => {
    if (variant.stock < 1) return
    const amount = validQuantity(quantity, variant)
    set((state) => {
      const existing = state.cart.find((item) => item.variant.id === variant.id)
      return { cart: existing
        ? state.cart.map((item) => item.variant.id === variant.id ? { ...item, quantity: validQuantity(item.quantity + amount, variant), product, variant } : item)
        : [...state.cart, { product, variant, quantity: amount }] }
    })
    if (authToken.get() && !isPreview(variant.id)) void api('/cart', { method: 'POST', body: JSON.stringify({ productId: product.id, variantId: variant.id, quantity: amount }) }).catch(() => {})
  },
  updateQuantity: (variantId, quantity) => {
    set((state) => ({ cart: state.cart.map((item) => item.variant.id === variantId ? { ...item, quantity: validQuantity(quantity, item.variant) } : item) }))
    if (authToken.get() && !isPreview(variantId)) void api(`/cart/${variantId}`, { method: 'PATCH', body: JSON.stringify({ quantity: get().cart.find((item) => item.variant.id === variantId)?.quantity || quantity }) }).catch(() => {})
  },
  removeFromCart: (variantId) => {
    set((state) => ({ cart: state.cart.filter((item) => item.variant.id !== variantId) }))
    if (authToken.get() && !isPreview(variantId)) void api(`/cart/${variantId}`, { method: 'DELETE' }).catch(() => {})
  },
  clearCart: () => set({ cart: [] }),
  syncRemoteCart: async () => {
    if (!authToken.get()) return
    const local = get().cart.filter((item) => !isRetiredCatalogItem(item))
    try {
      const remote = await api<{ items: RemoteCartItem[] }>('/cart')
      for (const item of local.filter((entry) => !isPreview(entry.variant.id))) {
        const existing = remote.items.find((entry) => entry.variantId === item.variant.id)
        if (existing && item.quantity > existing.quantity) await api(`/cart/${item.variant.id}`, { method: 'PATCH', body: JSON.stringify({ quantity: item.quantity }) })
        else if (!existing) await api('/cart', { method: 'POST', body: JSON.stringify({ productId: item.product.id, variantId: item.variant.id, quantity: item.quantity }) })
      }
      const fresh = await api<{ items: RemoteCartItem[] }>('/cart')
      const previews = local.filter((item) => isPreview(item.variant.id))
      set({ cart: [...fresh.items.map((item) => ({ product: normalizeProduct(item.product), variant: normalizeVariant(item.variant), quantity: item.quantity })), ...previews] })
    } catch { /* Keep the local bag while the API is unavailable. */ }
  },
  toggleFavorite: (id) => {
    const wasSaved = get().favorites.includes(id)
    set((state) => ({ favorites: wasSaved ? state.favorites.filter((x) => x !== id) : [...state.favorites, id] }))
    if (authToken.get() && !isPreview(id)) {
      void api(wasSaved ? `/favorites/${id}` : '/favorites', {
        method: wasSaved ? 'DELETE' : 'POST',
        ...(!wasSaved && { body: JSON.stringify({ productId: id }) }),
      }).catch(() => set((state) => ({ favorites: wasSaved ? [...state.favorites, id] : state.favorites.filter((x) => x !== id) })))
    }
  },
  setFavorites: (ids) => set({ favorites: ids }),
  setUser: (user) => set((state) => ({ user, ...(state.user?.id && state.user.id !== user?.id ? { cart: [], favorites: [] } : {}) })),
  signOut: () => { authToken.clear(); set({ user: null, cart: [], favorites: [] }) },
}), {
  name: 'osiris-store',
  partialize: (state) => ({ cart: state.cart, favorites: state.favorites, user: state.user }),
  merge: (persisted, current) => {
    const saved = persisted as Partial<CommerceState> | undefined
    return {
      ...current, ...saved,
      cart: (saved?.cart || []).filter((item) => !isRetiredCatalogItem(item)).map((item) => {
        const variant = item.variant || item.product.variants?.[0] || { id: item.product.id, sizeMl: 100, sellingPrice: item.product.sellingPrice, stock: item.product.stockQuantity }
        return { ...item, variant }
      }),
    }
  },
}))
