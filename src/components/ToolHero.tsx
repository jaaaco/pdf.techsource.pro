/**
 * Heading block for a tool page.
 *
 * Exists so that the h1 and the intro paragraph come from seo/routes.json
 * rather than being hardcoded per page. The prerenderer emits the same two
 * strings into the static HTML, so what a crawler reads and what a visitor
 * reads are the same sentence.
 *
 * Before this, tool pages had no h1 at all - the headline was a `variant="h4"`
 * Typography, which renders as <h4>.
 */

import React from 'react'
import type { RouteMeta } from '@/seo/manifest'

interface ToolHeroProps {
  route: RouteMeta
  /** Right-hand summary on wide screens, e.g. "3 files · 41 pages". */
  meta?: React.ReactNode
}

const ToolHero: React.FC<ToolHeroProps> = ({ route, meta }) => (
  <header className="section" style={{ paddingBottom: 'var(--space-4)' }}>
    <div className="spread" style={{ alignItems: 'flex-start' }}>
      <div className="grow">
        <h1 style={{ marginBottom: 'var(--space-2)' }}>{route.h1}</h1>
        <p className="text-muted reading" style={{ margin: 0 }}>
          {route.intro}
        </p>
      </div>
      {meta && <div style={{ flex: 'none' }}>{meta}</div>}
    </div>
  </header>
)

export default ToolHero
