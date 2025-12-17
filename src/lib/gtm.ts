/**
 * Google Tag Manager initialization
 * Loads GTM script and initializes the dataLayer
 */

export interface GTMConfig {
  id: string
}

declare global {
  interface Window {
    dataLayer: any[]
  }
}

/**
 * Initialize Google Tag Manager
 * Should be called as early as possible in the application lifecycle
 */
export const initGTM = (config: GTMConfig): void => {
  if (!config.id || typeof window === 'undefined') {
    return
  }

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({
    'gtm.start': new Date().getTime(),
    event: 'gtm.js'
  })

  // Load GTM script
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${config.id}`

  const firstScript = document.getElementsByTagName('script')[0]
  firstScript.parentNode?.insertBefore(script, firstScript)

  console.log(`[GTM] Initialized with ID: ${config.id}`)
}

/**
 * Push custom event to GTM dataLayer
 */
export const gtmEvent = (event: string, data?: Record<string, any>): void => {
  if (typeof window === 'undefined' || !window.dataLayer) {
    return
  }

  window.dataLayer.push({
    event,
    ...data
  })
}
