/**
 * Contact page.
 *
 * No form on purpose: a form needs a backend, and this site does not have one.
 * Public issue tracking is also a better fit for an open-source tool - the
 * answer stays visible to the next person with the same problem.
 */

import React from 'react'
import AppShell from '@/components/AppShell'
import { getRoute, site } from '@/seo/manifest'
import useDocumentMeta from '@/seo/useDocumentMeta'
import { BugIcon, GitHubIcon, MailIcon } from '@/components/icons'

const Contact: React.FC = () => {
  const route = getRoute('/contact')!

  useDocumentMeta({
    title: route.title,
    description: route.description,
    path: route.path,
    locale: route.locale,
  })

  return (
    <AppShell active="contact" tool={{ title: 'Contact' }}>
      <header className="section" style={{ paddingBottom: 'var(--space-4)' }}>
        <h1>{route.h1}</h1>
        <p className="text-muted reading" style={{ margin: 0 }}>
          {route.intro}
        </p>
      </header>

      <section className="section section-ruled">
        <h2>Something is broken</h2>
        <p className="text-muted reading">
          Open an issue. Include the browser and version, which tool you were using, and roughly
          what the file looked like - number of pages, whether it was a scan, how large. Do not
          attach the file itself; it is almost never needed and it is your document.
        </p>
        <a
          className="btn btn-primary"
          href={`${site.repository}/issues/new`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <BugIcon size={18} />
          Report an issue
        </a>
      </section>

      <section className="section section-ruled">
        <h2>Something is missing</h2>
        <p className="text-muted reading">
          Feature requests go in the same place. The bar is whether it can run entirely client-side
          - anything that would require uploading a file is out of scope by design.
        </p>
        <a className="btn btn-secondary" href={site.repository} target="_blank" rel="noopener noreferrer">
          <GitHubIcon size={18} />
          Browse the repository
        </a>
      </section>

      {site.contactEmail && (
        <section className="section section-ruled">
          <h2>Everything else</h2>
          <a className="btn btn-secondary" href={`mailto:${site.contactEmail}`}>
            <MailIcon size={18} />
            {site.contactEmail}
          </a>
        </section>
      )}
    </AppShell>
  )
}

export default Contact
