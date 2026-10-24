export const CONTACT = {
  whatsapp: import.meta.env.VITE_WHATSAPP_NUMBER || '',
  telegram: import.meta.env.VITE_TELEGRAM_USERNAME || '',
  max: import.meta.env.VITE_MAX_CONTACT_URL || '',
  instagram: import.meta.env.VITE_INSTAGRAM_URL || '',
}

export function whatsappUrl(message: string) {
  const number = CONTACT.whatsapp.replace(/[^0-9]/g, '')
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : ''
}

export function telegramUrl(message = '') {
  const username = CONTACT.telegram.replace(/^@/, '').trim()
  if (!username) return ''
  return `https://t.me/${username}${message ? `?text=${encodeURIComponent(message)}` : ''}`
}

export function maxContactUrl() {
  try {
    const url = new URL(CONTACT.max)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : ''
  } catch {
    return ''
  }
}

export async function copyContactMessage(message: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message)
      return true
    }
  } catch { /* Fall through to the compatibility copy method. */ }

  const field = document.createElement('textarea')
  field.value = message
  field.style.position = 'fixed'
  field.style.opacity = '0'
  field.setAttribute('readonly', '')
  document.body.appendChild(field)
  field.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    field.remove()
  }
}
