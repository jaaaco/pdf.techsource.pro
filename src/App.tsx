/**
 * Main App Component - Application shell with routing
 * Validates: Requirements 7.2, 1.5
 */

import React, { Suspense, lazy, useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, CssBaseline } from '@mui/material'
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
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    flexDirection: 'column',
    gap: '1rem'
  }}>
    <div style={{
      width: '40px',
      height: '40px',
      border: '4px solid #e5e7eb',
      borderTop: '4px solid #3b82f6',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading...</p>
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
)

// 404 Not Found component
const NotFound: React.FC = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    flexDirection: 'column',
    gap: '1rem',
    textAlign: 'center',
    padding: '2rem'
  }}>
    <h1 style={{ fontSize: '4rem', margin: 0, color: '#374151' }}>404</h1>
    <h2 style={{ fontSize: '1.5rem', margin: 0, color: '#6b7280' }}>Page Not Found</h2>
    <p style={{ color: '#9ca3af', maxWidth: '400px' }}>
      The page you're looking for doesn't exist. You might have mistyped the URL or the page may have been moved.
    </p>
    <a 
      href="/" 
      style={{
        display: 'inline-block',
        padding: '0.75rem 1.5rem',
        backgroundColor: '#3b82f6',
        color: 'white',
        textDecoration: 'none',
        borderRadius: '8px',
        fontSize: '0.875rem',
        fontWeight: 'bold',
        marginTop: '1rem'
      }}
    >
      Go to Dashboard
    </a>
  </div>
)

// Offline status banner
const OfflineBanner: React.FC<{ isOnline: boolean }> = ({ isOnline }) => {
  if (isOnline) return null;
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: '#f59e0b',
      color: 'white',
      padding: '0.5rem',
      textAlign: 'center',
      fontSize: '0.875rem',
      fontWeight: 'bold',
      zIndex: 9999,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      📡 You're offline - PDF Toolkit continues to work normally
    </div>
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
