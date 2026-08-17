/**
 * Analytics consent.
 *
 * Shown once, on the first visit, and never again after a choice is stored.
 * Both buttons are equally prominent on purpose - a "Decline" styled as an
 * afterthought is a dark pattern, and on a site whose entire pitch is
 * privacy it would be an especially cheap one.
 */

import React, { useEffect, useState } from 'react'
import { getConsentPreference, setConsentPreference, type ConsentValue } from '@/lib/consent'

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
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Privacy preferences"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10000,
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        borderTop: 'var(--rule) solid var(--color-accent)',
        padding: 'var(--space-4)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div style={{ maxWidth: 'var(--shell-max)', margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 var(--space-2)', fontSize: 18 }}>Privacy preferences</h2>
        <p className="text-muted reading" style={{ fontSize: 14 }}>
          We use Google Analytics through Tag Manager to see which tools get used, so we can improve
          them. Your files are never part of that - they never leave your browser. May we enable
          analytics cookies?
        </p>
        <div className="cluster">
          <button type="button" className="btn btn-secondary" onClick={() => handleChoice('denied')}>
            Decline
          </button>
          <button type="button" className="btn btn-primary" onClick={() => handleChoice('granted')}>
            Allow analytics
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConsentBanner
