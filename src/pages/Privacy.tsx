/**
 * Privacy policy.
 *
 * Kept specific on purpose. A generic template would be worthless here: the
 * whole claim of this site is that documents are not uploaded, and a policy
 * that does not say exactly what *is* collected undermines it. Ad networks
 * also require a reachable, honest policy page before approving a publisher.
 */

import React from 'react'
import { Box, Container, Divider, Link, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import Layout from '@/components/Layout'
import Footer from '@/components/Footer'
import { getRoute, site } from '@/seo/manifest'
import useDocumentMeta from '@/seo/useDocumentMeta'

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Box sx={{ mt: 4 }}>
    <Typography variant="h6" component="h2" fontWeight={700} gutterBottom>
      {title}
    </Typography>
    {children}
  </Box>
)

const Body: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '44rem', mb: 1.5 }}>
    {children}
  </Typography>
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
    <>
      <Layout title="Privacy">
        <Container maxWidth="md" disableGutters>
          <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
            {route.h1}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '44rem' }}>
            {route.intro}
          </Typography>

          <Divider sx={{ mt: 4 }} />

          <Section title="Your documents">
            <Body>
              Every PDF operation on this site - compression, merging, splitting and OCR - runs inside your
              browser using WebAssembly and Web Workers. The file you select is read into your tab's memory,
              processed there, and handed back to you as a download. It is never transmitted to this site or
              to anyone else, and no copy of it is retained anywhere once you close the tab.
            </Body>
            <Body>
              You do not have to take this on faith. Open your browser's developer tools, switch to the
              Network tab and process a file: no request carries your document. You can also load the page,
              disconnect from the internet, and keep working.
            </Body>
          </Section>

          <Section title="Analytics">
            <Body>
              If you agree to it in the banner shown on your first visit, this site loads Google Tag Manager
              and Google Analytics to count page views and see which tools get used. That is aggregate usage
              data - pages visited, browser, approximate region - and it never includes anything about the
              files you process, because the site itself has no access to them.
            </Body>
            <Body>
              If you decline, no analytics cookies are set and no data is sent. You can change your mind at
              any time by clearing this site's data in your browser, which brings the banner back.
            </Body>
          </Section>

          <Section title="Error reporting">
            <Body>
              Crashes are reported to Sentry so that a broken tool does not stay broken silently. These
              reports are configured to exclude personal data: IP address collection is off, all text and
              inputs in any captured session view are masked, and media is blocked. A report tells us which
              code path failed, not who you are or what you were working on.
            </Body>
          </Section>

          <Section title="Advertising">
            <Body>
              Where this site shows ads, they are contextual: the ad is chosen from the subject of the page
              you are reading, not from a profile of you. The ad provider used here sets no cookies, does no
              cross-site tracking and receives no personal data. If that ever changes, this section changes
              with it before the change ships.
            </Body>
          </Section>

          <Section title="Data we store about you">
            <Body>
              None on our side. This is a static site with no accounts, no database and no server-side
              processing. The only things written to your device are the consent choice you made in the
              banner and, if you consented, the analytics cookies described above.
            </Body>
          </Section>

          <Section title="Your rights">
            <Body>
              Because no personal data is collected or stored, there is nothing to export or delete on
              request. If you consented to analytics and want that reversed, clearing this site's data in
              your browser is sufficient and takes effect immediately.
            </Body>
          </Section>

          <Section title="Questions">
            <Body>
              The source code is public, so the fastest way to check any claim on this page is to read it.
              For anything else, see the{' '}
              <Link component={RouterLink} to="/contact">
                contact page
              </Link>
              , or open an issue in the{' '}
              <Link href={site.repository} target="_blank" rel="noopener">
                GitHub repository
              </Link>
              .
            </Body>
          </Section>
        </Container>
      </Layout>
      <Footer />
    </>
  )
}

export default Privacy
