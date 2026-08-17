/**
 * Site footer.
 *
 * Beyond the obvious, this is the internal linking surface: every page links
 * to every other page, which is how a crawler that lands on one article finds
 * the tools. It also carries the privacy and contact links that ad networks
 * require a publisher to have.
 */

import React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { routes, site } from '@/seo/manifest'

const TOOL_IDS = ['compress', 'merge', 'split', 'ocr']
const ABOUT_IDS = ['blog', 'privacy', 'contact', 'attribution']

const FooterGroup: React.FC<{ title: string; ids: string[] }> = ({ title, ids }) => (
  <nav className="footer-col" aria-label={title}>
    <h2>{title}</h2>
    {ids
      .map((id) => routes.find((route) => route.id === id))
      .filter((route): route is NonNullable<typeof route> => Boolean(route))
      .map((route) => (
        <RouterLink key={route.id} to={route.path}>
          {route.h1}
        </RouterLink>
      ))}
  </nav>
)

const Footer: React.FC = () => (
  <footer className="site-footer">
    <div className="footer-grid">
      <FooterGroup title="Tools" ids={TOOL_IDS} />
      <FooterGroup title="Project" ids={ABOUT_IDS} />

      <nav className="footer-col" aria-label="Source">
        <h2>Source</h2>
        <a href={site.repository} target="_blank" rel="noopener noreferrer">
          GitHub repository
        </a>
        <a href={site.publisher.url} target="_blank" rel="noopener noreferrer">
          {site.publisher.name}
        </a>
      </nav>

      {/* The old line here claimed "no tracking, no data collection", which
          stopped being true the moment opt-in analytics shipped. The claim
          that matters and is still exactly true is the one about the files. */}
      <p className="footer-col footer-note text-muted">
        Your files are processed in your browser and are never uploaded.
      </p>
    </div>
  </footer>
)

export default Footer
