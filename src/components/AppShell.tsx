/**
 * The chrome every page sits in.
 *
 * Two navigations, one per breakpoint, both always in the DOM and switched by
 * CSS so there is no layout shift while JS decides which to draw:
 *
 *   desktop  full nav rail - brand, the four tools, guides, privacy, theme
 *   mobile   a four-item tab bar pinned to the bottom (thumb reach), plus a
 *            back-and-title bar on tool pages instead of the nav
 *
 * `More` is a disclosure rather than a route: the pages behind it (privacy,
 * contact, attribution, source) do not deserve a tab each, but they do have
 * to be reachable without scrolling to the footer.
 */

import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import ErrorBoundary from './ErrorBoundary'
import Footer from './Footer'
import ThemeToggle from './ThemeToggle'
import { site } from '@/seo/manifest'
import {
  BookIcon,
  ChevronLeftIcon,
  GitHubIcon,
  GridIcon,
  HomeIcon,
  MoreIcon,
} from './icons'

const NAV_LINKS = [
  { to: '/compress', label: 'Compress', id: 'compress' },
  { to: '/merge', label: 'Merge', id: 'merge' },
  { to: '/split', label: 'Split', id: 'split' },
  { to: '/ocr', label: 'OCR', id: 'ocr' },
  { to: '/blog', label: 'Guides', id: 'blog' },
  { to: '/privacy', label: 'Privacy', id: 'privacy' },
]

const MORE_LINKS = [
  { to: '/privacy', label: 'Privacy' },
  { to: '/contact', label: 'Contact' },
  { to: '/attribution', label: 'Licenses & attribution' },
]

const Brand: React.FC = () => (
  <Link to="/" className="nav-brand">
    PDF<span className="slash">/</span>TOOLKIT
  </Link>
)

const MoreMenu: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={wrapper} style={{ display: 'contents' }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-current={isActive ? 'page' : undefined}
        style={{
          background: 'transparent',
          border: 0,
          font: 'inherit',
          color: 'inherit',
          cursor: 'pointer',
          minHeight: 'var(--tabbar-height)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <MoreIcon />
        <span
          style={{
            fontSize: 10,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          More
        </span>
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            right: 0,
            bottom: 'var(--tabbar-height)',
            zIndex: 21,
            minWidth: 220,
            background: 'var(--color-bg)',
            borderTop: 'var(--rule) solid var(--color-divider)',
            borderLeft: 'var(--rule) solid var(--color-divider)',
          }}
        >
          {MORE_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                minHeight: 52,
                padding: '0 var(--space-4)',
                color: 'inherit',
                textDecoration: 'none',
                borderBottom: 'var(--hairline) solid var(--color-divider)',
                fontSize: 15,
              }}
            >
              {link.label}
            </Link>
          ))}
          <a
            href={site.repository}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minHeight: 52,
              padding: '0 var(--space-4)',
              color: 'inherit',
              textDecoration: 'none',
              fontSize: 15,
            }}
          >
            <GitHubIcon size={18} />
            GitHub repository
          </a>
        </div>
      )}
    </div>
  )
}

export interface AppShellProps {
  children: React.ReactNode
  /** Route id, used to mark the active nav item. */
  active?: string
  /**
   * Tool pages replace the mobile nav with a back-and-title bar, the way the
   * design does on every tool screen.
   */
  tool?: {
    title: string
    /** Right-hand summary, e.g. "1 file · 3.95 MB". */
    meta?: React.ReactNode
    backTo?: string
  }
}

const AppShell: React.FC<AppShellProps> = ({ children, active, tool }) => {
  const location = useLocation()
  const isMoreSection = ['/privacy', '/contact', '/attribution'].includes(location.pathname)

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className={tool ? 'nav nav-tool' : 'nav'}>
        <Brand />
        <nav className="nav-links" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link key={link.to} to={link.to} aria-current={active === link.id ? 'page' : undefined}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="nav-actions">
          <ThemeToggle />
          {/* Hidden on phones: the same link is one tap away under More, and
              the design keeps the mobile header down to brand plus icons. */}
          <a
            className="btn btn-secondary desktop-only"
            href={site.repository}
            target="_blank"
            rel="noopener noreferrer"
            style={{ minHeight: 36 }}
          >
            GitHub
          </a>
        </div>
      </header>

      {tool && (
        <div className="toolbar">
          <Link to={tool.backTo ?? '/'} className="btn btn-icon" aria-label="Back">
            <ChevronLeftIcon size={22} />
          </Link>
          <span className="toolbar-title">{tool.title}</span>
          {tool.meta && <span className="toolbar-meta">{tool.meta}</span>}
        </div>
      )}

      <main id="main" className="shell-main">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>

      <Footer />

      <nav className="tabbar" aria-label="Sections">
        <Link to="/" aria-current={location.pathname === '/' ? 'page' : undefined}>
          <HomeIcon />
          <span>Home</span>
        </Link>
        <Link
          to="/#tools"
          aria-current={
            ['compress', 'merge', 'split', 'ocr'].includes(active ?? '') ? 'page' : undefined
          }
        >
          <GridIcon />
          <span>Tools</span>
        </Link>
        <Link to="/blog" aria-current={location.pathname.startsWith('/blog') ? 'page' : undefined}>
          <BookIcon />
          <span>Guides</span>
        </Link>
        <MoreMenu isActive={isMoreSection} />
      </nav>
    </div>
  )
}

export default AppShell
