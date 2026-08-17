/**
 * Attribution and licences.
 *
 * Ghostscript's AGPL obligation is the reason this page is not optional. It
 * gets the loudest treatment on the page because "compression is AGPL" is the
 * one fact a person reusing this code has to leave with.
 */

import React from 'react'
import AppShell from '@/components/AppShell'
import { getRoute, site } from '@/seo/manifest'
import useDocumentMeta from '@/seo/useDocumentMeta'
import { AlertIcon, GitHubIcon, ShieldIcon } from '@/components/icons'

const LIBRARIES = [
  {
    name: 'Ghostscript',
    licence: 'AGPL v3',
    use: 'PDF compression',
    detail:
      'If you distribute this software or run it as a service, you must make the source available under the same licence. Commercial use without that obligation needs a commercial Ghostscript licence.',
    warn: true,
  },
  {
    name: 'Tesseract OCR',
    licence: 'Apache 2.0',
    use: 'Optical character recognition',
    detail: 'Free for commercial and non-commercial use.',
    warn: false,
  },
  {
    name: 'pdf-lib',
    licence: 'MIT',
    use: 'Merge and split',
    detail: 'Free for all uses.',
    warn: false,
  },
  {
    name: 'pdf.js',
    licence: 'Apache 2.0',
    use: 'Page rendering during compression',
    detail: 'Free for commercial and non-commercial use.',
    warn: false,
  },
  {
    name: 'React, TypeScript, Vite, React Router',
    licence: 'MIT',
    use: 'The application itself',
    detail: 'All remaining dependencies are MIT, Apache 2.0 or BSD.',
    warn: false,
  },
]

const Attribution: React.FC = () => {
  const route = getRoute('/attribution')!

  useDocumentMeta({
    title: route.title,
    description: route.description,
    path: route.path,
    locale: route.locale,
  })

  return (
    <AppShell active="attribution" tool={{ title: 'Licenses' }}>
      <header className="section" style={{ paddingBottom: 'var(--space-4)' }}>
        <h1>{route.h1}</h1>
        <p className="text-muted reading" style={{ margin: 0 }}>
          {route.intro}
        </p>
      </header>

      <div className="section-tight">
        <p className="note">
          <ShieldIcon size={20} />
          <span className="text-muted">
            All processing happens in your browser. Your files never leave your device and no data
            is sent to any server.
          </span>
        </p>
      </div>

      <section className="section section-ruled">
        <h2>PDF Toolkit</h2>
        <p className="text-muted reading">
          This project is open source under the MIT Licence: use it, modify it, redistribute it,
          within the licence terms - and subject to the Ghostscript note below.
        </p>
      </section>

      <section className="section-tight section-ruled">
        <h2 className="label">
          Third-party libraries
        </h2>

        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>Library</th>
                <th>Licence</th>
                <th>Used for</th>
              </tr>
            </thead>
            <tbody>
              {LIBRARIES.map((library) => (
                <tr key={library.name}>
                  <td>{library.name}</td>
                  <td>{library.licence}</td>
                  <td className="text-muted">{library.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="stack" style={{ marginTop: 'var(--space-4)' }}>
          {LIBRARIES.filter((library) => library.warn).map((library) => (
            <p className="callout callout-error" key={library.name}>
              <AlertIcon size={18} />
              <span>
                <strong>{library.name} is {library.licence}.</strong> {library.detail}
              </span>
            </p>
          ))}
        </div>
      </section>

      <section className="section section-ruled">
        <h2>What that means for you</h2>
        <ul className="reading text-muted" style={{ paddingLeft: 'var(--space-6)' }}>
          <li style={{ marginBottom: 8 }}>
            <strong>Personal use:</strong> nothing to do. Use it freely.
          </li>
          <li style={{ marginBottom: 8 }}>
            <strong>Commercial use:</strong> either publish your source under AGPL v3, buy a
            commercial Ghostscript licence, or drop the compression feature.
          </li>
          <li>
            <strong>Redistribution:</strong> keep every licence notice and make source available
            where the respective licences require it.
          </li>
        </ul>

        <a className="btn btn-secondary" href={`${site.repository}/issues`} target="_blank" rel="noopener noreferrer">
          <GitHubIcon size={18} />
          Ask about licensing
        </a>
      </section>
    </AppShell>
  )
}

export default Attribution
