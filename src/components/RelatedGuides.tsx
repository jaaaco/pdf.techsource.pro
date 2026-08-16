/**
 * Links to articles from the tool pages and the homepage.
 *
 * Until this existed, /blog was reachable only from the footer, so every
 * article sat two clicks deep behind a single link nobody scrolls to. That
 * wastes the content pipeline twice over: readers never see the guides, and
 * a crawler finds them through one weak path instead of from the pages that
 * actually carry the site's relevance.
 *
 * Article links also give the homepage something that changes twice a week,
 * which a static tool page otherwise never does.
 */

import React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Card, CardActionArea, CardContent, Link, Stack, Typography } from '@mui/material'
import { ArrowForward as ArrowIcon } from '@mui/icons-material'
import { articlesForLocale, type Article } from '@/seo/manifest'

interface RelatedGuidesProps {
  /** Restrict to articles carrying this tag. Omit for the newest of anything. */
  tag?: string
  limit?: number
  title?: string
  locale?: string
}

const pickGuides = (locale: string, tag: string | undefined, limit: number): Article[] => {
  const all = articlesForLocale(locale)
  const tagged = tag ? all.filter((article) => article.tags.includes(tag)) : all
  // Fall back to the newest articles rather than rendering nothing: an empty
  // section on a tool page is worse than a slightly less relevant link.
  return (tagged.length > 0 ? tagged : all).slice(0, limit)
}

const RelatedGuides: React.FC<RelatedGuidesProps> = ({
  tag,
  limit = 3,
  title = 'Guides and benchmarks',
  locale = 'en',
}) => {
  const guides = pickGuides(locale, tag, limit)
  if (guides.length === 0) return null

  return (
    <Box component="section" sx={{ mt: 6 }}>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" component="h2" fontWeight={700}>
          {title}
        </Typography>
        <Link
          component={RouterLink}
          to="/blog"
          variant="body2"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap' }}
        >
          All guides <ArrowIcon fontSize="inherit" />
        </Link>
      </Stack>

      <Stack spacing={2}>
        {guides.map((guide) => (
          <Card key={guide.slug} variant="outlined">
            <CardActionArea component={RouterLink} to={guide.path}>
              <CardContent>
                <Typography variant="subtitle1" component="h3" fontWeight={600} gutterBottom>
                  {guide.title}
                </Typography>
                {guide.description && (
                  <Typography variant="body2" color="text.secondary">
                    {guide.description}
                  </Typography>
                )}
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Stack>
    </Box>
  )
}

export default RelatedGuides
