/**
 * Renders the intro copy, feature list and FAQ for a route.
 *
 * This is the visible twin of the static block written by
 * scripts/prerender.mjs. Both read seo/routes.json, so a crawler that gets
 * the prerendered HTML and a visitor whose browser has hydrated React see
 * the same words. If this component stops rendering a field that the
 * prerenderer still emits, the page starts cloaking - keep them together.
 *
 * The answers use <details> rather than a JS accordion, which means they are
 * in the DOM whether or not they are open and whether or not React ran. They
 * start open on wide screens, matching the desktop mock; on a phone the
 * collapsed list is the only way this much copy fits under the tool.
 */

import React, { useEffect, useState } from 'react'
import type { RouteMeta } from '@/seo/manifest'
import { CheckIcon, ChevronDownIcon } from './icons'

interface SeoSectionProps {
  route: RouteMeta
  /**
   * Whether to repeat the intro paragraph. Tool pages render it in ToolHero
   * at the top of the page and pass false here.
   */
  includeIntro?: boolean
}

const useWideScreen = (): boolean => {
  const [wide, setWide] = useState(false)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(min-width: 900px)')
    setWide(query.matches)
    const onChange = (event: MediaQueryListEvent) => setWide(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return wide
}

const SeoSection: React.FC<SeoSectionProps> = ({ route, includeIntro = false }) => {
  const wide = useWideScreen()
  const intro = includeIntro ? route.intro : ''
  const hasBody = Boolean(intro) || route.bullets.length > 0
  const hasFaq = route.faq.length > 0

  if (!hasBody && !hasFaq) return null

  return (
    <section className="section section-ruled">
      {hasBody && (
        <div className="reading" style={{ marginBottom: hasFaq ? 'var(--space-6)' : 0 }}>
          {intro && <p className="text-muted">{intro}</p>}

          {route.bullets.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {route.bullets.map((bullet) => (
                <li
                  key={bullet}
                  style={{
                    display: 'flex',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-2) 0',
                    borderBottom: 'var(--hairline) solid var(--color-divider)',
                    fontSize: 14,
                  }}
                >
                  <CheckIcon size={18} style={{ color: 'var(--color-accent)', flex: 'none' }} />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {hasFaq && (
        <div className="faq-grid">
          <div>
            <h2 style={{ marginBottom: 'var(--space-2)' }}>Frequently asked questions</h2>
            <p className="text-muted" style={{ fontSize: 13 }}>
              The same copy the crawler sees, set properly rather than hidden.
            </p>
          </div>

          <div className="faq">
            {route.faq.map((entry) => (
              <details key={entry.q} className="faq-item" open={wide}>
                <summary className="faq-question" style={{ listStyle: 'none' }}>
                  <h3 style={{ margin: 0, font: 'inherit' }}>{entry.q}</h3>
                  <ChevronDownIcon size={18} />
                </summary>
                <p className="faq-answer text-muted">{entry.a}</p>
              </details>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export default SeoSection
