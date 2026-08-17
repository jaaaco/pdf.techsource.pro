import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

/*
 * Archivo, self-hosted. Three weights, which is the whole system: 400 body,
 * 600 for the few semibold labels, 800 for every heading. Each file carries
 * its own unicode-range, so a page with no Polish text never fetches the
 * latin-ext file.
 *
 * Self-hosted rather than Google Fonts because a font request per page load
 * is a network call this site otherwise does not make, and because the
 * fallback face is what an offline visitor would get instead.
 */
import '@fontsource/archivo/400.css'
import '@fontsource/archivo/600.css'
import '@fontsource/archivo/800.css'
import './styles/modernist.css'
import './index.css'

import { initGTM } from './lib/gtm'
import { initMonitoring } from './lib/monitoring'
import { initConsentMode } from './lib/consent'

// Initialize Google Consent Mode before GTM loads
initConsentMode()

// Lazily initialize monitoring stack when enabled
initMonitoring()

// Initialize Google Tag Manager if GTM ID is provided
const gtmId = import.meta.env.VITE_GTM_ID
if (gtmId) {
  initGTM({ id: gtmId })
}

const container = document.getElementById('root')!
const root = ReactDOM.createRoot(container)
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
