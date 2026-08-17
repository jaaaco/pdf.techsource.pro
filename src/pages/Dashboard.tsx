/**
 * Home - hybrid of a dropzone and a tool index.
 *
 * The old dashboard made you pick a tool before it would look at a file. Most
 * arrivals already have the file in hand, so the dropzone comes first and the
 * tool grid is the second option, not the only one. Dropping here does not
 * guess what you meant: it holds the files and asks which tool, then hands
 * them over through router state so the tool page starts with them loaded.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AppShell from '@/components/AppShell'
import FileDropzone from '@/components/FileDropzone'
import SeoSection from '@/components/SeoSection'
import RelatedGuides from '@/components/RelatedGuides'
import { FileUtils } from '@/lib/file-utils'
import { getRoute, site } from '@/seo/manifest'
import useDocumentMeta from '@/seo/useDocumentMeta'
import {
  ArrowRightIcon,
  CompressIcon,
  MergeIcon,
  OcrIcon,
  ShieldIcon,
  SplitIcon,
  UploadIcon,
} from '@/components/icons'

/**
 * Two notes per tool. A phone shows four tiles two-up, where the desktop
 * sentence wraps to five lines and buries the tile below it; the short form
 * is what the mock puts there.
 */
const TOOLS = [
  {
    to: '/compress',
    name: 'Compress',
    short: '3.95 MB to 0.17 MB on a scan',
    note: 'Shrink scans with two measured presets. A 10-page 300 dpi scan: 3.95 MB to 0.17 MB.',
    Icon: CompressIcon,
  },
  {
    to: '/merge',
    name: 'Merge',
    short: 'Drag to set the order',
    note: 'Combine files in the order you pick. Page sizes and orientation are preserved.',
    Icon: MergeIcon,
  },
  {
    to: '/split',
    name: 'Split',
    short: 'Ranges like 1-3, 7, 12-20',
    note: 'Pull out single pages or ranges - 1-3, 7, 12-20 - in one pass.',
    Icon: SplitIcon,
  },
  {
    to: '/ocr',
    name: 'OCR',
    short: 'Make a scan searchable',
    note: 'Turn a scan into a searchable document, with the recognition running locally.',
    Icon: OcrIcon,
  },
]

const HERO_TAGS = ['100% private', 'No upload', 'Works offline', 'Open source']

const Dashboard: React.FC = () => {
  const route = getRoute('/')!
  const navigate = useNavigate()
  const location = useLocation()
  const toolsRef = useRef<HTMLDivElement>(null)
  const [staged, setStaged] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)

  useDocumentMeta({
    title: route.title,
    description: route.description,
    path: route.path,
    locale: route.locale,
  })

  // The tab bar's "Tools" entry links to /#tools from any page; on arrival
  // there is no browser-native scroll for a hash that React only just
  // rendered, so do it here.
  useEffect(() => {
    if (location.hash === '#tools') {
      toolsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [location.hash])

  const handleFiles = useCallback((files: File[]) => {
    setError(null)
    setStaged(files)
  }, [])

  const openWith = useCallback(
    (path: string) => navigate(path, { state: { files: staged } }),
    [navigate, staged],
  )

  const stagedSize = staged.reduce((total, file) => total + file.size, 0)

  return (
    <AppShell active="home">
      <div className="hero">
        <div className="hero-copy">
          <h1>{route.h1}</h1>
          {/* route.intro verbatim: the prerendered HTML carries the same
              sentence, and showing a crawler one paragraph and a visitor
              another is cloaking. */}
          <p className="text-muted">{route.intro}</p>
          <div className="hero-tags">
            {HERO_TAGS.map((tag) => (
              <span className="tag tag-outline" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="hero-slot">
          <FileDropzone
            multiple
            maxFiles={20}
            onFilesSelected={handleFiles}
            onValidationError={(message) => {
              setStaged([])
              setError(message)
            }}
          >
            <UploadIcon size={28} style={{ color: 'var(--color-accent)' }} />
            <span className="dropzone-title">Drop a PDF, or pick one</span>
            <span className="text-muted" style={{ fontSize: 12 }}>
              Up to 500 MB · stays on this device
            </span>
            {/* A span, not a button: the whole dropzone is already the
                control, and a nested button would be a second tab stop for
                the same action. */}
            <span className="btn btn-primary btn-block" aria-hidden="true">
              Select files
              <ArrowRightIcon size={18} className="btn-arrow" />
            </span>
          </FileDropzone>
        </div>
      </div>

      {error && (
        <div className="section-tight">
          <p className="callout callout-error" style={{ whiteSpace: 'pre-line' }}>
            {error}
          </p>
        </div>
      )}

      {staged.length > 0 && (
        <section className="section-tight section-ruled">
          <div className="rule-heading">
            <h2 style={{ fontSize: 20 }}>
              {staged.length} file{staged.length === 1 ? '' : 's'} ready ·{' '}
              {FileUtils.formatFileSize(stagedSize)}
            </h2>
          </div>
          <p className="text-muted" style={{ fontSize: 13 }}>
            Nothing has been uploaded. Pick what to do with them.
          </p>
          <div className="chips">
            {TOOLS.map((tool) => (
              <button
                key={tool.to}
                type="button"
                className="chip"
                onClick={() => openWith(tool.to)}
                disabled={tool.to === '/merge' && staged.length < 2}
              >
                <tool.Icon size={16} style={{ marginRight: 8 }} />
                {tool.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <div ref={toolsRef} id="tools">
        <div className="section-tight">
          <div className="rule-heading">
            <h2 className="label">
              Or start from a tool
            </h2>
          </div>
        </div>

        <div className="tool-grid">
          {TOOLS.map((tool) => (
            <Link className="tool-tile" to={tool.to} key={tool.to}>
              <tool.Icon size={22} style={{ color: 'var(--color-accent)' }} />
              <span className="tool-tile-name">{tool.name}</span>
              <span className="tool-tile-note text-muted mobile-only">{tool.short}</span>
              <span className="tool-tile-note text-muted desktop-only">{tool.note}</span>
              <span className="btn btn-ghost desktop-only">
                Open
                <ArrowRightIcon size={16} />
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="section-tight">
        <p className="note">
          <ShieldIcon size={20} />
          <span>
            <strong>Verify it yourself:</strong> open DevTools, process a file, and watch the
            Network tab stay empty.
          </span>
        </p>
      </div>

      <SeoSection route={route} />
      <RelatedGuides limit={3} />

      <div className="cta-band">
        <h2>Nothing you open here is ever sent anywhere.</h2>
        <p>
          Open source, auditable, and verifiable in your own DevTools in under three minutes.{' '}
          <a href={site.repository} target="_blank" rel="noopener noreferrer">
            Read the source
          </a>
          .
        </p>
      </div>
    </AppShell>
  )
}

export default Dashboard
