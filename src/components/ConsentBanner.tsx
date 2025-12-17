import React, { useEffect, useState } from 'react'
import { getConsentPreference, setConsentPreference, type ConsentValue } from '@/lib/consent'

const bannerStyles: React.CSSProperties = {
  position: 'fixed',
  bottom: '1.5rem',
  left: '50%',
  transform: 'translateX(-50%)',
  maxWidth: '500px',
  width: '90%',
  backgroundColor: '#111827',
  color: 'white',
  padding: '1.5rem',
  borderRadius: '1rem',
  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
  zIndex: 10000
}

const buttonBase: React.CSSProperties = {
  flex: 1,
  padding: '0.75rem 1rem',
  borderRadius: '9999px',
  border: 'none',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: '0.95rem'
}

const descriptionStyles: React.CSSProperties = {
  color: '#f3f4f6',
  fontSize: '0.9rem',
  lineHeight: 1.6,
  margin: '0.5rem 0 1.5rem'
}

const ConsentBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (getConsentPreference() === null) {
      setIsVisible(true)
    }
  }, [])

  const handleChoice = (value: ConsentValue) => {
    setConsentPreference(value)
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div style={bannerStyles} role="dialog" aria-live="polite" aria-label="Privacy preferences">
      <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Privacy preferences</h2>
      <p style={descriptionStyles}>
        We use Google Analytics through Tag Manager to understand how the toolkit is used so we can improve it.
        No personal files ever leave your browser. May we enable analytics cookies?
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          style={{ ...buttonBase, backgroundColor: '#374151', color: 'white' }}
          onClick={() => handleChoice('denied')}
        >
          Decline
        </button>
        <button
          type="button"
          style={{ ...buttonBase, backgroundColor: '#22c55e', color: '#0f172a' }}
          onClick={() => handleChoice('granted')}
        >
          Allow analytics
        </button>
      </div>
    </div>
  )
}

export default ConsentBanner
