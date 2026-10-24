import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, authToken, login, register } from '../services/api'
import { useStore } from '../store/useStore'
import type { User } from '../types'

export default function AuthPage({ mode }: { mode: 'login' | 'register' | 'supplier' }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const setUser = useStore((s) => s.setUser)
  const setFavorites = useStore((s) => s.setFavorites)
  const syncRemoteCart = useStore((s) => s.syncRemoteCart)
  const [form, setForm] = useState({ name: '', email: '', password: '', shopName: '', description: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isLogin = mode === 'login'
  const isSupplier = mode === 'supplier'

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('')
    if (!isLogin && form.password.length < 8) { setError(t('auth.minPassword')); return }
    setLoading(true)
    try {
      const result = isLogin ? await login(form.email, form.password) : isSupplier
        ? await api<{ token: string; user: User }>('/auth/register-supplier', { method: 'POST', body: JSON.stringify(form) })
        : await register(form.name, form.email, form.password)
      authToken.set(result.token); setUser(result.user)
      void api<Array<{ id: string }>>('/favorites').then((products) => setFavorites(products.map((product) => product.id))).catch(() => {})
      void syncRemoteCart()
      const from = (location.state as { from?: string } | null)?.from
      navigate(from || (result.user.role === 'ADMIN' ? '/admin' : result.user.role === 'SUPPLIER' ? '/supplier' : '/account'), { replace: true })
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('auth.invalid')) }
    finally { setLoading(false) }
  }

  return <div className="auth-page page-shell"><div className="auth-art"><div className="auth-art-content"><span className="eyebrow">OSIRIS</span><p>{t('home.signature')}</p></div></div><div className="auth-panel"><span className="eyebrow">OSIRIS</span><h1>{t(isLogin ? 'auth.welcome' : isSupplier ? 'auth.supplierJoin' : 'auth.join')}</h1><p>{t(isLogin ? 'auth.loginSubtitle' : isSupplier ? 'auth.supplierSubtitle' : 'auth.registerSubtitle')}</p><form onSubmit={submit}>{!isLogin && <label className="form-field"><span>{t('auth.name')}</span><input required autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>}{isSupplier && <><label className="form-field"><span>{t('auth.shopName')}</span><input required value={form.shopName} onChange={(event) => setForm({ ...form, shopName: event.target.value })} /></label><label className="form-field"><span>{t('auth.shopDescription')}</span><textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label></>}
        <label className="form-field"><span>{t('auth.email')}</span><input type="email" required autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label className="form-field"><span>{t('auth.password')}</span><input type="password" required minLength={isLogin ? undefined : 8} autoComplete={isLogin ? 'current-password' : 'new-password'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}<button className="gold-button" disabled={loading} type="submit">{loading ? t('common.loading') : t(isLogin ? 'auth.login' : isSupplier ? 'auth.supplierRegister' : 'auth.register')}</button></form><div className="auth-links"><p>{t(isLogin ? 'auth.noAccount' : 'auth.haveAccount')} <Link to={isLogin ? '/register' : '/login'}>{t(isLogin ? 'auth.register' : 'auth.login')}</Link></p></div></div></div>
}
