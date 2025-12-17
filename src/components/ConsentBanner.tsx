import React, { useEffect, useState } from 'react'
import { Box, Typography, Button, Paper, alpha, useTheme } from '@mui/material'
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
    <Paper
      elevation={20}
      role="dialog"
      aria-live="polite"
      aria-label="Privacy preferences"
      sx={{
        position: 'fixed',
        bottom: '2rem',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '500px',
        width: '90%',
        backgroundColor: alpha('#111827', 0.9),
        backdropFilter: 'blur(16px)',
        color: 'white',
        p: 3,
        borderRadius: 5,
        zIndex: 10000,
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <Typography variant="h6" fontWeight={800} sx={{ mb: 1, letterSpacing: '-0.01em' }}>
        Privacy Preference
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: alpha('#fff', 0.7),
          lineHeight: 1.6,
          mb: 3,
          fontWeight: 500
        }}
      >
        We use anonymous telemetry to refine PDF.KIT. No documents ever leave your browser—processing is 100% local. Enable analytics to help us build better tools?
      </Typography>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button
          fullWidth
          variant="text"
          onClick={() => handleChoice('denied')}
          sx={{
            color: 'white',
            fontWeight: 700,
            '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' }
          }}
        >
          Decline
        </Button>
        <Button
          fullWidth
          variant="contained"
          color="success"
          onClick={() => handleChoice('granted')}
          sx={{
            borderRadius: '12px',
            fontWeight: 800,
            textTransform: 'none',
            boxShadow: '0 8px 16px rgba(34, 197, 94, 0.2)'
          }}
        >
          Allow Analytics
        </Button>
      </Box>
    </Paper>
  )
}

export default ConsentBanner

