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
import { Box, Container, Divider, Link, Stack, Typography } from '@mui/material'
import { routes, site } from '@/seo/manifest'

const TOOL_IDS = ['compress', 'merge', 'split', 'ocr']
const ABOUT_IDS = ['blog', 'privacy', 'contact', 'attribution']

const linkSx = { color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }

const FooterGroup: React.FC<{ title: string; ids: string[] }> = ({ title, ids }) => (
  <Box>
    <Typography variant="subtitle2" fontWeight={700} gutterBottom>
      {title}
    </Typography>
    <Stack spacing={0.75}>
      {ids
        .map((id) => routes.find((route) => route.id === id))
        .filter((route): route is NonNullable<typeof route> => Boolean(route))
        .map((route) => (
          <Link key={route.id} component={RouterLink} to={route.path} variant="body2" sx={linkSx}>
            {route.h1}
          </Link>
        ))}
    </Stack>
  </Box>
)

const Footer: React.FC = () => (
  <Box component="footer" sx={{ mt: 8, borderTop: 1, borderColor: 'divider', backgroundColor: 'background.paper' }}>
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 8 }}>
        <FooterGroup title="Tools" ids={TOOL_IDS} />
        <FooterGroup title="Project" ids={ABOUT_IDS} />
        <Box>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            Source
          </Typography>
          <Stack spacing={0.75}>
            <Link href={site.repository} target="_blank" rel="noopener" variant="body2" sx={linkSx}>
              GitHub repository
            </Link>
            <Link href={site.publisher.url} target="_blank" rel="noopener" variant="body2" sx={linkSx}>
              {site.publisher.name}
            </Link>
          </Stack>
        </Box>
      </Stack>

      <Divider sx={{ my: 3 }} />

      <Typography variant="caption" color="text.secondary">
        Your files are processed in your browser and are never uploaded.
      </Typography>
    </Container>
  </Box>
)

export default Footer
