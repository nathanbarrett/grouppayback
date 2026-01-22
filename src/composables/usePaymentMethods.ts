import { siVenmo, siZelle, siPaypal, siCashapp } from 'simple-icons'
import type { PaymentProvider, PaymentMethods } from '../types'

export interface ProviderConfig {
  key: PaymentProvider
  name: string
  placeholder: string
  color: string
  hoverColor: string
  hexColor: string
  svgPath: string
  hasUrl: boolean
}

export const PAYMENT_PROVIDERS: ProviderConfig[] = [
  {
    key: 'venmo',
    name: 'Venmo',
    placeholder: '@username',
    color: 'bg-[#008CFF]',
    hoverColor: 'hover:bg-[#0070CC]',
    hexColor: '#008CFF',
    svgPath: siVenmo.path,
    hasUrl: true
  },
  {
    key: 'zelle',
    name: 'Zelle',
    placeholder: 'email or phone',
    color: 'bg-[#6D1ED4]',
    hoverColor: 'hover:bg-[#5718A8]',
    hexColor: '#6D1ED4',
    svgPath: siZelle.path,
    hasUrl: false
  },
  {
    key: 'paypal',
    name: 'PayPal',
    placeholder: 'username or email',
    color: 'bg-[#002991]',
    hoverColor: 'hover:bg-[#001F6B]',
    hexColor: '#002991',
    svgPath: siPaypal.path,
    hasUrl: true
  },
  {
    key: 'cashapp',
    name: 'Cash App',
    placeholder: '$cashtag',
    color: 'bg-[#00C244]',
    hoverColor: 'hover:bg-[#009B36]',
    hexColor: '#00C244',
    svgPath: siCashapp.path,
    hasUrl: true
  },
  {
    key: 'other',
    name: 'Other',
    placeholder: 'Payment info or URL',
    color: 'bg-gray-500',
    hoverColor: 'hover:bg-gray-600',
    hexColor: '#6B7280',
    // Three dots (ellipsis) icon
    svgPath: 'M6 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
    hasUrl: false
  }
]

const VALIDATION_PATTERNS: Record<PaymentProvider, RegExp | null> = {
  venmo: /^@[\w.-]{1,30}$/,
  zelle: /^([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|\d{10})$/,
  paypal: /^[\w.@+-]+$/,
  cashapp: /^\$[a-zA-Z_][\w]{0,19}$/,
  other: null
}

export function validatePaymentMethod(provider: PaymentProvider, value: string): { valid: boolean; error?: string } {
  if (!value.trim()) {
    return { valid: true }
  }

  const pattern = VALIDATION_PATTERNS[provider]
  if (!pattern) {
    return { valid: true }
  }

  if (!pattern.test(value)) {
    switch (provider) {
      case 'venmo':
        return { valid: false, error: 'Must start with @ (e.g., @username)' }
      case 'zelle':
        return { valid: false, error: 'Must be email or 10-digit phone' }
      case 'paypal':
        return { valid: false, error: 'Invalid PayPal username or email' }
      case 'cashapp':
        return { valid: false, error: 'Must start with $ (e.g., $cashtag)' }
      default:
        return { valid: false, error: 'Invalid format' }
    }
  }

  return { valid: true }
}

export function isUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function getPaymentUrl(provider: PaymentProvider, value: string): string | null {
  if (!value.trim()) return null

  switch (provider) {
    case 'venmo': {
      const username = value.startsWith('@') ? value.slice(1) : value
      return `https://venmo.com/u/${encodeURIComponent(username)}`
    }
    case 'paypal': {
      const username = value.includes('@') ? (value.split('@')[0] ?? value) : value
      return `https://paypal.me/${encodeURIComponent(username)}`
    }
    case 'cashapp': {
      const tag = value.startsWith('$') ? value.slice(1) : value
      return `https://cash.app/$${encodeURIComponent(tag)}`
    }
    case 'zelle':
      return null
    case 'other':
      // If the value is a URL, return it directly
      return isUrl(value) ? value : null
    default:
      return null
  }
}

export function hasAnyPaymentMethod(payments?: PaymentMethods): boolean {
  if (!payments) return false
  return Object.values(payments).some(value => value && value.trim() !== '')
}

export function getProviderConfig(provider: PaymentProvider): ProviderConfig {
  const config = PAYMENT_PROVIDERS.find(p => p.key === provider)
  // Always returns a valid config - fallback to 'other' provider
  return config ?? PAYMENT_PROVIDERS[4]!
}
