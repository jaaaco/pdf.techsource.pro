/**
 * Heading block for a tool page.
 *
 * Exists so that the h1 and the intro paragraph come from seo/routes.json
 * rather than being hardcoded per page. The prerenderer emits the same two
 * strings into the static HTML, so what a crawler reads and what a visitor
 * reads are the same sentence.
 *
 * Before this, tool pages had no h1 at all - the headline was a `variant="h4"`
 * Typography, which renders as <h4>.
 */

import React from 'react'
import { Paper, Typography } from '@mui/material'
import type { RouteMeta } from '@/seo/manifest'

interface ToolHeroProps {
  route: RouteMeta
  icon: React.ReactNode
}

const ToolHero: React.FC<ToolHeroProps> = ({ route, icon }) => (
  <Paper sx={{ p: 3, mb: 3, textAlign: 'center' }}>
    {icon}
    <Typography variant="h4" component="h1" gutterBottom fontWeight={700}>
      {route.h1}
    </Typography>
    <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '40rem', mx: 'auto' }}>
      {route.intro}
    </Typography>
  </Paper>
)

export default ToolHero
