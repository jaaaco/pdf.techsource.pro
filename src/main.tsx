import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
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
