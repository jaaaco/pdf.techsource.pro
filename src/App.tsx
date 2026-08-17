/**
 * Main App Component - Application shell with routing
 * Validates: Requirements 7.2, 1.5
 */

import React, { Suspense, lazy, useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom'
import AppShell from '@/components/AppShell'
import ErrorBoundary from '@/components/ErrorBoundary'
import ConsentBanner from '@/components/ConsentBanner'
import { ThemeModeProvider } from '@/theme/mode'

// Lazy load components for code splitting
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Compress = lazy(() => import('@/pages/Compress'))
const Merge = lazy(() => import('@/pages/Merge'))
const Split = lazy(() => import('@/pages/Split'))
const OCR = lazy(() => import('@/pages/OCR'))
const Attribution = lazy(() => import('@/pages/Attribution'))
const Privacy = lazy(() => import('@/pages/Privacy'))
const Contact = lazy(() => import('@/pages/Contact'))
const Blog = lazy(() => import('@/pages/Blog'))
const Article = lazy(() => import('@/pages/Article'))

// Loading component
const LoadingSpinner: React.FC = () => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '60vh',
      flexDirection: 'column',
      gap: 'var(--space-4)',
    }}
  >
    <span className="spinner" aria-hidden="true" />
    <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
      Loading…
    </p>
  </div>
)

/**
 * 404.
 *
 * Rare in production - public/_redirects returns a real 404 for unknown URLs
 * rather than falling back to the SPA - so this is what a visitor sees after
 * following a stale in-app link. It gets the full shell for the same reason:
 * the useful thing on a dead page is the way out of it.
 */
const NotFound: React.FC = () => (
  <AppShell>
    <div className="section" style={{ minHeight: '50vh' }}>
      <p className="tag tag-accent">404</p>
      <h1>That page does not exist</h1>
      <p className="text-muted reading">
        You might have mistyped the URL, or the page may have moved. The four tools are all one
        click away.
      </p>
      <Link className="btn btn-primary" to="/">
        Back to the tools
      </Link>
    </div>
  </AppShell>
)

// Offline status banner
const OfflineBanner: React.FC<{ isOnline: boolean }> = ({ isOnline }) => {
  if (isOnline) return null

  return (
    <div className="banner-offline" role="status">
      You are offline - compress, merge and split keep working
    </div>
  )
}

// Route wrapper with error boundary
const RouteWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>
  </ErrorBoundary>
)

// Custom hook for online status
const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

// Global error handler
const useGlobalErrorHandler = () => {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason)

      // Log error for debugging
      if (import.meta.env.MODE === 'development') {
        console.group('🚨 Unhandled Promise Rejection')
        console.error('Reason:', event.reason)
        console.error('Promise:', event.promise)
        console.groupEnd()
      }

      // Prevent default browser error handling
      event.preventDefault()
    }

    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error)

      // Log error for debugging
      if (import.meta.env.MODE === 'development') {
        console.group('🚨 Global Error')
        console.error('Message:', event.message)
        console.error('Filename:', event.filename)
        console.error('Line:', event.lineno)
        console.error('Column:', event.colno)
        console.error('Error:', event.error)
        console.groupEnd()
      }
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    window.addEventListener('error', handleError)

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.removeEventListener('error', handleError)
    }
  }, [])
}

function App() {
  const isOnline = useOnlineStatus()
  useGlobalErrorHandler()

  return (
    <ThemeModeProvider>
      <ErrorBoundary>
        <ConsentBanner />
        <OfflineBanner isOnline={isOnline} />
        <Router>
          <Routes>
            {/* Dashboard route */}
            <Route
              path="/"
              element={
                <RouteWrapper>
                  <Dashboard />
                </RouteWrapper>
              }
            />

            {/* Tool routes */}
            <Route
              path="/compress"
              element={
                <RouteWrapper>
                  <Compress />
                </RouteWrapper>
              }
            />
            <Route
              path="/merge"
              element={
                <RouteWrapper>
                  <Merge />
                </RouteWrapper>
              }
            />
            <Route
              path="/split"
              element={
                <RouteWrapper>
                  <Split />
                </RouteWrapper>
              }
            />
            <Route
              path="/ocr"
              element={
                <RouteWrapper>
                  <OCR />
                </RouteWrapper>
              }
            />

            {/* Attribution route */}
            <Route
              path="/attribution"
              element={
                <RouteWrapper>
                  <Attribution />
                </RouteWrapper>
              }
            />

            {/* Content and policy pages */}
            <Route
              path="/blog"
              element={
                <RouteWrapper>
                  <Blog />
                </RouteWrapper>
              }
            />
            <Route
              path="/blog/:slug"
              element={
                <RouteWrapper>
                  <Article />
                </RouteWrapper>
              }
            />
            <Route
              path="/privacy"
              element={
                <RouteWrapper>
                  <Privacy />
                </RouteWrapper>
              }
            />
            <Route
              path="/contact"
              element={
                <RouteWrapper>
                  <Contact />
                </RouteWrapper>
              }
            />

            {/* Redirect old paths */}
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />

            {/* 404 catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </ErrorBoundary>
    </ThemeModeProvider>
  )
}

export default App
