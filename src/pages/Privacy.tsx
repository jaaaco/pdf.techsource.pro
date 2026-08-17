/**
 * Privacy policy.
 *
 * Kept specific on purpose. A generic template would be worthless here: the
 * whole claim of this site is that documents are not uploaded, and a policy
 * that does not say exactly what *is* collected undermines it. Ad networks
 * also require a reachable, honest policy page before approving a publisher.
 *
 * The sections are <details open>: the design draws them as a collapsible
 * list, but a policy that starts collapsed is a policy nobody reads, so they
 * open by default and collapse only if the visitor asks.
 */

import React from 'react'
import { Link } from 'react-router-dom'
import AppShell from '@/components/AppShell'
import { getRoute, site } from '@/seo/manifest'
import useDocumentMeta from '@/seo/useDocumentMeta'
import { ChevronDownIcon } from '@/components/icons'

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <details className="faq-item" open>
    <summary className="faq-question">
      <h2 style={{ margin: 0, font: 'inherit' }}>{title}</h2>
      <ChevronDownIcon size={18} />
    </summary>
    <div className="reading" style={{ paddingBottom: 'var(--space-3)' }}>
      {children}
    </div>
  </details>
)

const Privacy: React.FC = () => {
  const route = getRoute('/privacy')!

  useDocumentMeta({
    title: route.title,
    description: route.description,
    path: route.path,
    locale: route.locale,
  })

  return (
    <AppShell active="privacy" tool={{ title: 'Privacy' }}>
      {/* h1 and intro come from the manifest because the prerendered copy of
          this page carries the same two strings - they have to match. */}
      <header className="section" style={{ paddingBottom: 'var(--space-4)' }}>
        <h1>{route.h1}</h1>
        <p className="reading" style={{ fontSize: 18, marginBottom: 'var(--space-3)' }}>
          Your files are processed in this tab and are never uploaded.
        </p>
        <p className="text-muted reading" style={{ margin: 0 }}>
          {route.intro}
        </p>
      </header>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-value">0</div>
          <div className="stat-label text-muted">bytes of your document sent</div>
        </div>
        <div className="stat">
          <div className="stat-value">Opt-in</div>
          <div className="stat-label text-muted">analytics, off by default</div>
        </div>
      </div>

      <div className="section">
        <div className="faq">
          <Section title="Your documents">
            <p className="text-muted">
              Every PDF operation on this site - compression, merging, splitting and OCR - runs
              inside your browser using WebAssembly and Web Workers. The file you select is read
              into your tab&apos;s memory, processed there, and handed back to you as a download. It
              is never transmitted to this site or to anyone else, and no copy of it is retained
              anywhere once you close the tab.
            </p>
            <p className="text-muted">
              You do not have to take this on faith. Open your browser&apos;s developer tools,
              switch to the Network tab and process a file: no request carries your document. You
              can also load the page, disconnect from the internet, and keep working.
            </p>
          </Section>

          <Section title="Analytics">
            <p className="text-muted">
              If you agree to it in the banner shown on your first visit, this site loads Google Tag
              Manager and Google Analytics to count page views and see which tools get used. That is
              aggregate usage data - pages visited, browser, approximate region - and it never
              includes anything about the files you process, because the site itself has no access
              to them.
            </p>
            <p className="text-muted">
              If you decline, no analytics cookies are set and no data is sent. You can change your
              mind at any time by clearing this site&apos;s data in your browser, which brings the
              banner back.
            </p>
          </Section>

          <Section title="Error reporting">
            <p className="text-muted">
              Crashes are reported to Sentry so that a broken tool does not stay broken silently.
              These reports are configured to exclude personal data: IP address collection is off,
              all text and inputs in any captured session view are masked, and media is blocked. A
              report tells us which code path failed, not who you are or what you were working on.
            </p>
          </Section>

          <Section title="Advertising">
            <p className="text-muted">
              Where this site shows ads, they are contextual: the ad is chosen from the subject of
              the page you are reading, not from a profile of you. The ad provider used here sets no
              cookies, does no cross-site tracking and receives no personal data. If that ever
              changes, this section changes with it before the change ships.
            </p>
          </Section>

          <Section title="Data we store about you">
            <p className="text-muted">
              None on our side. This is a static site with no accounts, no database and no
              server-side processing. The only things written to your device are the consent choice
              you made in the banner, your light-or-dark theme preference, and, if you consented,
              the analytics cookies described above.
            </p>
          </Section>

          <Section title="Your rights">
            <p className="text-muted">
              Because no personal data is collected or stored, there is nothing to export or delete
              on request. If you consented to analytics and want that reversed, clearing this
              site&apos;s data in your browser is sufficient and takes effect immediately.
            </p>
          </Section>

          <Section title="Questions">
            <p className="text-muted">
              The source code is public, so the fastest way to check any claim on this page is to
              read it. For anything else, see the <Link to="/contact">contact page</Link>, or open
              an issue in the{' '}
              <a href={site.repository} target="_blank" rel="noopener noreferrer">
                GitHub repository
              </a>
              .
            </p>
          </Section>
        </div>
      </div>
    </AppShell>
  )
}

export default Privacy
