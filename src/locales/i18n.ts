import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en/translation.json'
import ar from './ar/translation.json'
import ru from './ru/translation.json'

const saved = localStorage.getItem('osiris-language') || localStorage.getItem('royal-essence-language')
const initial = ['en', 'ar', 'ru'].includes(saved || '') ? saved! : 'ru'
document.documentElement.lang = initial
document.documentElement.dir = initial === 'ar' ? 'rtl' : 'ltr'

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ar: { translation: ar }, ru: { translation: ru } },
  lng: initial, fallbackLng: 'ru', interpolation: { escapeValue: false },
})

export function setLanguage(language: 'en' | 'ar' | 'ru') {
  localStorage.setItem('osiris-language', language)
  localStorage.removeItem('royal-essence-language')
  document.documentElement.lang = language
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
  void i18n.changeLanguage(language)
}

export default i18n
