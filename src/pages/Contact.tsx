/**
 * Contact page.
 *
 * No form on purpose: a form needs a backend, and this site does not have one.
 * Public issue tracking is also a better fit for an open-source tool - the
 * answer stays visible to the next person with the same problem.
 */

import React from 'react'
import { Box, Button, Container, Divider, Stack, Typography } from '@mui/material'
import { BugReport as BugIcon, GitHub as GitHubIcon, Email as EmailIcon } from '@mui/icons-material'
import Layout from '@/components/Layout'
import Footer from '@/components/Footer'
import { getRoute, site } from '@/seo/manifest'
import useDocumentMeta from '@/seo/useDocumentMeta'

const Contact: React.FC = () => {
  const route = getRoute('/contact')!

  useDocumentMeta({
    title: route.title,
    description: route.description,
    path: route.path,
    locale: route.locale,
  })

  return (
    <>
      <Layout title="Contact">
        <Container maxWidth="md" disableGutters>
          <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
            {route.h1}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '44rem' }}>
            {route.intro}
          </Typography>

          <Divider sx={{ my: 4 }} />

          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" component="h2" fontWeight={700} gutterBottom>
                Something is broken
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '44rem', mb: 2 }}>
                Open an issue. Include the browser and version, which tool you were using, and roughly what
                the file looked like - number of pages, whether it was a scan, how large. Do not attach the
                file itself; it is almost never needed and it is your document.
              </Typography>
              <Button
                variant="contained"
                startIcon={<BugIcon />}
                href={`${site.repository}/issues/new`}
                target="_blank"
                rel="noopener"
              >
                Report an issue
              </Button>
            </Box>

            <Box>
              <Typography variant="h6" component="h2" fontWeight={700} gutterBottom>
                Something is missing
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '44rem', mb: 2 }}>
                Feature requests go in the same place. The bar is whether it can run entirely client-side -
                anything that would require uploading a file is out of scope by design.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<GitHubIcon />}
                href={site.repository}
                target="_blank"
                rel="noopener"
              >
                Browse the repository
              </Button>
            </Box>

            {site.contactEmail && (
              <Box>
                <Typography variant="h6" component="h2" fontWeight={700} gutterBottom>
                  Everything else
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<EmailIcon />}
                  href={`mailto:${site.contactEmail}`}
                >
                  {site.contactEmail}
                </Button>
              </Box>
            )}
          </Stack>
        </Container>
      </Layout>
      <Footer />
    </>
  )
}

export default Contact
