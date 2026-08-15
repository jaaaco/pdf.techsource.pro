/**
 * Renders the intro copy, feature list and FAQ for a route.
 *
 * This is the visible twin of the static block written by
 * scripts/prerender.mjs. Both read seo/routes.json, so a crawler that gets
 * the prerendered HTML and a visitor whose browser has hydrated React see
 * the same words. If this component stops rendering a field that the
 * prerenderer still emits, the page starts cloaking - keep them together.
 */

import React from 'react'
import { Box, Divider, List, ListItem, ListItemIcon, ListItemText, Paper, Typography } from '@mui/material'
import { CheckCircleOutline as CheckIcon } from '@mui/icons-material'
import type { RouteMeta } from '@/seo/manifest'

interface SeoSectionProps {
  route: RouteMeta
  /**
   * Whether to repeat the intro paragraph. Tool pages render it in ToolHero
   * at the top of the page and pass false here.
   */
  includeIntro?: boolean
}

const SeoSection: React.FC<SeoSectionProps> = ({ route, includeIntro = false }) => {
  const intro = includeIntro ? route.intro : ''
  const hasBody = Boolean(intro) || route.bullets.length > 0
  const hasFaq = route.faq.length > 0

  if (!hasBody && !hasFaq) return null

  return (
    <Box component="section" sx={{ mt: 6 }}>
      {hasBody && (
        <Paper sx={{ p: { xs: 2.5, md: 4 } }} elevation={0} variant="outlined">
          {intro && (
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '44rem' }}>
              {intro}
            </Typography>
          )}

          {route.bullets.length > 0 && (
            <List dense sx={{ mt: 1 }}>
              {route.bullets.map((bullet) => (
                <ListItem key={bullet} disableGutters>
                  <ListItemIcon sx={{ minWidth: 34 }}>
                    <CheckIcon fontSize="small" color="success" />
                  </ListItemIcon>
                  <ListItemText primary={bullet} />
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      )}

      {hasFaq && (
        <Paper sx={{ p: { xs: 2.5, md: 4 }, mt: 3 }} elevation={0} variant="outlined">
          <Typography variant="h5" component="h2" gutterBottom fontWeight={700}>
            Frequently asked questions
          </Typography>

          {route.faq.map((entry, index) => (
            <Box key={entry.q} sx={{ mt: index === 0 ? 2 : 3 }}>
              {index > 0 && <Divider sx={{ mb: 3 }} />}
              <Typography variant="subtitle1" component="h3" fontWeight={600} gutterBottom>
                {entry.q}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '44rem' }}>
                {entry.a}
              </Typography>
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  )
}

export default SeoSection
