/**
 * Custom hook for managing debug console visibility
 * Toggles with Ctrl+Shift+D keyboard shortcut
 * Persists state in localStorage
 */

import { useState, useEffect, useCallback } from 'react'

const DEBUG_CONSOLE_KEY = 'pdf-toolkit-debug-console-visible'

export const useDebugConsole = (): [boolean, () => void] => {
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    // Initialize from localStorage
    try {
      const stored = localStorage.getItem(DEBUG_CONSOLE_KEY)
      return stored === 'true'
    } catch {
      return false
    }
  })

  const toggleDebugConsole = useCallback(() => {
    setIsVisible(prev => {
      const newValue = !prev
      try {
        localStorage.setItem(DEBUG_CONSOLE_KEY, String(newValue))
      } catch (error) {
        console.error('Failed to save debug console state:', error)
      }
      return newValue
    })
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Shift+D or Cmd+Shift+D
      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'd') {
        event.preventDefault()
        toggleDebugConsole()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleDebugConsole])

  return [isVisible, toggleDebugConsole]
}
