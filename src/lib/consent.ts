/**
 * Consent mode helpers - stores user choice and syncs it with Google Tag Manager
 */

type ConsentValue = 'granted' | 'denied'

const CONSENT_STORAGE_KEY = 'pdf-toolkit.analytics-consent'
const CONSENT_EVENT = 'analytics-consent-change'

const DENIED_PAYLOAD = {
  ad_storage: 'denied' as ConsentValue,
  ad_user_data: 'denied' as ConsentValue,
  ad_personalization: 'denied' as ConsentValue,
  analytics_storage: 'denied' as ConsentValue,
  functionality_storage: 'denied' as ConsentValue,
  personalization_storage: 'denied' as ConsentValue,
  security_storage: 'granted' as ConsentValue
}

const GRANTED_PAYLOAD = {
  ad_storage: 'granted' as ConsentValue,
  ad_user_data: 'granted' as ConsentValue,
  ad_personalization: 'granted' as ConsentValue,
  analytics_storage: 'granted' as ConsentValue,
  functionality_storage: 'granted' as ConsentValue,
  personalization_storage: 'granted' as ConsentValue,
  security_storage: 'granted' as ConsentValue
}

let initialized = false

const ensureDataLayer = () => {
  if (typeof window === 'undefined') return

  window.dataLayer = window.dataLayer || []
  if (!window.gtag) {
    window.gtag = (...args: any[]) => {
      window.dataLayer.push(args)
    }
  }
}

const pushInitEvent = () => {
  if (typeof window === 'undefined' || !Array.isArray(window.dataLayer)) {
    return
  }

  const alreadyDispatched = window.dataLayer.some((event) => {
    return event?.event === 'gtm.init_consent'
  })

  if (!alreadyDispatched) {
    window.dataLayer.push({
      event: 'gtm.init_consent',
      'gtm.uniqueEventId': 1
    })
  }
}

const readStoredConsent = (): ConsentValue | null => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const value = localStorage.getItem(CONSENT_STORAGE_KEY)
    if (value === 'granted' || value === 'denied') {
      return value
    }
  } catch (error) {
    console.warn('[Consent] Unable to read stored consent preference', error)
  }
  return null
}

const persistConsent = (value: ConsentValue) => {
  if (typeof window === 'undefined') {
    return
  }
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, value)
  } catch (error) {
    console.warn('[Consent] Unable to persist consent preference', error)
  }
}

const pushConsentUpdate = (value: ConsentValue) => {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return
  }

  const payload = value === 'granted' ? GRANTED_PAYLOAD : DENIED_PAYLOAD
  window.gtag('consent', 'update', payload)
}

/**
 * Initializes Google Consent Mode before GTM loads
 */
export const initConsentMode = () => {
  if (initialized || typeof window === 'undefined') {
    return
  }
  initialized = true

  ensureDataLayer()
  pushInitEvent()

  window.gtag('consent', 'default', {
    ...DENIED_PAYLOAD,
    wait_for_update: 500
  })

  const storedConsent = readStoredConsent()
  if (storedConsent) {
    pushConsentUpdate(storedConsent)
  }
}

/**
 * Returns current consent preference from storage
 */
export const getConsentPreference = (): ConsentValue | null => readStoredConsent()

/**
 * Persists the consent choice and updates Consent Mode/observers
 */
export const setConsentPreference = (value: ConsentValue) => {
  ensureDataLayer()
  persistConsent(value)
  pushConsentUpdate(value)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }))
  }
}

/**
 * Adds an event listener for consent changes
 */
export const subscribeToConsentChanges = (listener: (value: ConsentValue) => void) => {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<ConsentValue>
    listener(customEvent.detail)
  }

  window.addEventListener(CONSENT_EVENT, handler as EventListener)
  return () => window.removeEventListener(CONSENT_EVENT, handler as EventListener)
}

export type { ConsentValue }

declare global {
  interface Window {
    dataLayer: any[]
    gtag: (...args: any[]) => void
  }
}

export {}
