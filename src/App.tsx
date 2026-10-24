import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ContactButtons from './components/ContactButtons'
import SeoManager from './components/SeoManager'
import LoadingScreen from './components/LoadingScreen'
import Home from './pages/Home'
import CatalogPage from './pages/CatalogPage'
import ProductPage from './pages/ProductPage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import AuthPage from './pages/AuthPage'
import AccountPage from './pages/AccountPage'
import AssistantPage from './pages/AssistantPage'
import OrderConfirmationPage from './pages/OrderConfirmationPage'
import { api, authToken } from './services/api'
import { useStore } from './store/useStore'
import type { User } from './types'
import './pages/pages.css'

const SupplierPage = lazy(() => import('./pages/SupplierPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))

function Shell() {
  const { i18n } = useTranslation()
  const location = useLocation()
  const setUser = useStore((state) => state.setUser)
  const setFavorites = useStore((state) => state.setFavorites)
  const syncRemoteCart = useStore((state) => state.syncRemoteCart)

  useEffect(() => {
    document.documentElement.lang = i18n.language.slice(0, 2)
    document.documentElement.dir = i18n.language.startsWith('ar') ? 'rtl' : 'ltr'
  }, [i18n.language])

  useEffect(() => {
    if (!authToken.get()) return
    api<User>('/auth/me').then((user) => {
      setUser(user)
      void api<Array<{ id: string }>>('/favorites').then((products) => setFavorites(products.map((product) => product.id))).catch(() => {})
      void syncRemoteCart()
    }).catch(() => { authToken.clear(); setUser(null) })
  }, [setUser, setFavorites, syncRemoteCart])

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.slice(1)
      window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 80)
    } else window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname, location.hash])

  return <><SeoManager /><Navbar /><main id="main-content"><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/shop" element={<CatalogPage />} />
    <Route path="/products" element={<CatalogPage />} />
    <Route path="/product/:slug" element={<ProductPage />} />
    <Route path="/products/:slug" element={<ProductPage />} />
    <Route path="/cart" element={<CartPage />} />
    <Route path="/checkout" element={<CheckoutPage />} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/supplier/register" element={<AuthPage mode="supplier" />} />
    <Route path="/account" element={<AccountPage />} />
    <Route path="/fragrance-finder" element={<AssistantPage />} />
    <Route path="/order-confirmation/:orderNumber" element={<OrderConfirmationPage />} />
    <Route path="/supplier/*" element={<Suspense fallback={<LoadingScreen />}><SupplierPage /></Suspense>} />
    <Route path="/admin/*" element={<Suspense fallback={<LoadingScreen />}><AdminPage /></Suspense>} />
    <Route path="*" element={<div className="page-shell empty-state"><h1>404</h1><a className="gold-button" href="/">Return home</a></div>} />
  </Routes></main><Footer /><ContactButtons /></>
}

export default function App() { return <BrowserRouter><Shell /></BrowserRouter> }
