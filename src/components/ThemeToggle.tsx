/**
 * Light/dark switch.
 *
 * Shows the scheme it will switch *to*, not the one currently applied - a
 * moon on a light page, a sun on a dark one - which is the convention every
 * other site uses and the one the design mocks draw.
 */

import React from 'react'
import { useThemeMode } from '@/theme/theme-mode'
import { MoonIcon, SunIcon } from './icons'

const ThemeToggle: React.FC = () => {
  const { resolved, toggle } = useThemeMode()
  const next = resolved === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className="btn btn-icon"
      onClick={toggle}
      title={`Switch to ${next} theme`}
      aria-label={`Switch to ${next} theme`}
    >
      {resolved === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

export default ThemeToggle
