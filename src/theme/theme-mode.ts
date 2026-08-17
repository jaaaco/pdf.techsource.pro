/**
 * Colour scheme: types, storage, and the hook.
 *
 * Split from the provider component so that the module holding the React
 * component exports nothing but components - otherwise Fast Refresh gives up
 * on the whole file and full-reloads the app on every edit.
 */

import { createContext, useContext } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'pdf-toolkit-theme'

/**
 * Kept in sync by hand with the inline snippet in index.html, which applies
 * the stored choice before first paint. Exported so a test can assert the two
 * agree rather than discovering the drift in production.
 */
export const THEME_BOOTSTRAP = `try{var m=localStorage.getItem('${THEME_STORAGE_KEY}');if(m==='light'||m==='dark'){document.documentElement.setAttribute('data-theme',m)}}catch(e){}`

export interface ThemeModeValue {
  mode: ThemeMode
  resolved: ResolvedTheme
  setMode: (mode: ThemeMode) => void
  /** Flips to the opposite of what is currently on screen. */
  toggle: () => void
}

export const ThemeModeContext = createContext<ThemeModeValue | null>(null)

const isMode = (value: unknown): value is ThemeMode =>
  value === 'system' || value === 'light' || value === 'dark'

export const readStoredMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system'
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isMode(stored) ? stored : 'system'
  } catch {
    // Storage throws in private mode and when cookies are blocked. A visitor
    // who cannot persist a preference should still get a working toggle for
    // the current session.
    return 'system'
  }
}

export const storeMode = (mode: ThemeMode): void => {
  try {
    if (mode === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY)
    else window.localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    /* see readStoredMode */
  }
}

export const systemPrefersDark = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches

/**
 * Falls back to a no-op light theme when there is no provider, so a component
 * can be rendered in isolation - in a test, say - without being wrapped.
 */
export const useThemeMode = (): ThemeModeValue => {
  const context = useContext(ThemeModeContext)
  if (context) return context
  return {
    mode: 'system',
    resolved: 'light',
    setMode: () => undefined,
    toggle: () => undefined,
  }
}
