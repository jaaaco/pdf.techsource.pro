import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App.tsx'
import './index.css'
import { initGTM } from './lib/gtm'

// Initialize Sentry if DSN is provided
const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // Performance Monitoring
    tracesSampleRate: 1.0,
    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    // Setting this option to true will send default PII data to Sentry
    sendDefaultPii: true,
  })
}

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