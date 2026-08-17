/**
 * Colour scheme: system by default, overridable, remembered.
 *
 * Three states rather than two. "system" is the default and follows the OS,
 * which is what a visitor who has never touched the toggle expects. Pressing
 * the toggle writes an explicit "light" or "dark" and that wins from then on,
 * including when the OS flips at sunset.
 *
 * The stored choice is applied to <html data-theme> by an inline script in
 * index.html *before* React mounts - see THEME_BOOTSTRAP in ./theme-mode.
 * Doing it here only would repaint one frame after first paint, which is the
 * white flash every dark-mode site gets wrong.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ThemeModeContext,
  readStoredMode,
  storeMode,
  systemPrefersDark,
  type ResolvedTheme,
  type ThemeMode,
} from './theme-mode'

export const ThemeModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode)
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark)

  // Track the OS setting so "system" stays live rather than being sampled once.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const resolved: ResolvedTheme = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode

  useEffect(() => {
    const root = document.documentElement
    if (mode === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', mode)

    storeMode(mode)
  }, [mode])

  const setMode = useCallback((next: ThemeMode) => setModeState(next), [])
  const toggle = useCallback(
    () => setModeState(resolved === 'dark' ? 'light' : 'dark'),
    [resolved],
  )

  const value = useMemo(
    () => ({ mode, resolved, setMode, toggle }),
    [mode, resolved, setMode, toggle],
  )

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>
}
