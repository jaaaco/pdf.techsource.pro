type SentryModule = typeof import('@sentry/react')
type CaptureContext = Parameters<SentryModule['captureException']>[1]

let sentryPromise: Promise<SentryModule> | null = null
let monitoringInitialized = false
const loadSentryModule = (): Promise<SentryModule> => import('@sentry/react')

const ensureSentry = (): Promise<SentryModule> | null => {
  if (!import.meta.env.VITE_SENTRY_DSN) {
    return null
  }

  if (!sentryPromise) {
    sentryPromise = loadSentryModule()
  }

  return sentryPromise
}

/**
 * Lazily initialize Sentry when DSN is available
 */
export const initMonitoring = (): void => {
  if (monitoringInitialized) return

  const sentry = ensureSentry()
  if (!sentry) return

  monitoringInitialized = true

  sentry
    .then((Sentry) => {
      // Privacy settings are not tunable knobs here, they are the product.
      // This site tells people their documents never leave the browser, so
      // error reporting must not quietly ship file names, page text or IP
      // addresses to a third party. Hence: replays fully masked, no default
      // PII, and replay sampling only on error rather than on every session.
      Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN,
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration({
            maskAllText: true,
            maskAllInputs: true,
            blockAllMedia: true,
          }),
        ],
        tracesSampleRate: 0.2,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 1.0,
        sendDefaultPii: false,
      })
    })
    .catch((error) => {
      monitoringInitialized = false
      console.warn('[Monitoring] Failed to initialize Sentry', error)
    })
}

/**
 * Capture exceptions without forcing Sentry to load eagerly
 */
export const reportException = (error: unknown, context?: CaptureContext): void => {
  const sentry = ensureSentry()
  if (!sentry) return

  sentry
    .then((Sentry) => {
      Sentry.captureException(error, context)
    })
    .catch((err) => {
      console.warn('[Monitoring] Failed to report error', err)
    })
}
