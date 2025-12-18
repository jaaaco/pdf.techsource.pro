/**
 * Main App Component - Application shell with routing
 * Validates: Requirements 7.2, 1.5
 */

import React, { Suspense, lazy, useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, CssBaseline, Box, Typography, CircularProgress, Button } from '@mui/material'
import { theme } from '@/theme'
import ErrorBoundary from '@/components/ErrorBoundary'
import ConsentBanner from '@/components/ConsentBanner'

// Lazy load components for code splitting
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Compress = lazy(() => import('@/pages/Compress'))
const Merge = lazy(() => import('@/pages/Merge'))
const Split = lazy(() => import('@/pages/Split'))
const OCR = lazy(() => import('@/pages/OCR'))
const Attribution = lazy(() => import('@/pages/Attribution'))

// Loading component
const LoadingSpinner: React.FC = () => (
  <Box sx={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    flexDirection: 'column',
    gap: 3,
    background: 'background.default'
  }}>
    <CircularProgress size={60} thickness={4} />
    <Typography variant="h6" fontWeight={700} color="text.secondary">
      Initializing Platform...
    </Typography>
  </Box>
)

// 404 Not Found component
const NotFound: React.FC = () => (
  <Box sx={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    flexDirection: 'column',
    gap: 3,
    textAlign: 'center',
    padding: 4,
    background: 'background.default'
  }}>
    <Typography variant="h1" className="gradient-text" sx={{ fontSize: '8rem', fontWeight: 900 }}>
      404
    </Typography>
    <Typography variant="h4" fontWeight={800} color="text.primary">
      Lost in the Grid.
    </Typography>
    <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 450, mb: 2 }}>
      The page you're seeking has drifted out of reach. Check the URL or return to the main dashboard.
    </Typography>
    <Button
      component="a"
      href="/"
      variant="contained"
      size="large"
      sx={{ px: 4, py: 1.5, borderRadius: 3 }}
    >
      Return to Dashboard
    </Button>
  </Box>
)

// Offline status banner
const OfflineBanner: React.FC<{ isOnline: boolean }> = ({ isOnline }) => {
  if (isOnline) return null;

  return (
    <Box sx={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: 'warning.main',
      color: 'white',
      py: 1,
      textAlign: 'center',
      fontSize: '0.875rem',
      fontWeight: 800,
      zIndex: 9999,
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      letterSpacing: '0.05em',
      textTransform: 'uppercase'
    }}>
      📡 Engine Offline • Local Processing Active
    </Box>
  )
}


// Route wrapper with error boundary
const RouteWrapper: React.FC<{ children: React.ReactNode; isOnline: boolean }> = ({ children, isOnline }) => (
  <ErrorBoundary>
    <div style={{ paddingTop: isOnline ? 0 : '40px' }}>
      <Suspense fallback={<LoadingSpinner />}>
        {children}
      </Suspense>
    </div>
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
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <ConsentBanner />
        <OfflineBanner isOnline={isOnline} />
        <Router>
          <Routes>
            {/* Dashboard route */}
            <Route
              path="/"
              element={
                <RouteWrapper isOnline={isOnline}>
                  <Dashboard />
                </RouteWrapper>
              }
            />

            {/* Tool routes */}
            <Route
              path="/compress"
              element={
                <RouteWrapper isOnline={isOnline}>
                  <Compress />
                </RouteWrapper>
              }
            />
            <Route
              path="/merge"
              element={
                <RouteWrapper isOnline={isOnline}>
                  <Merge />
                </RouteWrapper>
              }
            />
            <Route
              path="/split"
              element={
                <RouteWrapper isOnline={isOnline}>
                  <Split />
                </RouteWrapper>
              }
            />
            <Route
              path="/ocr"
              element={
                <RouteWrapper isOnline={isOnline}>
                  <OCR />
                </RouteWrapper>
              }
            />

            {/* Attribution route */}
            <Route
              path="/attribution"
              element={
                <RouteWrapper isOnline={isOnline}>
                  <Attribution />
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
    </ThemeProvider>
  )
}

export default App
