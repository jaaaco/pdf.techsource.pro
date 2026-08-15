/**
 * Single article.
 *
 * The markdown is rendered with `marked` and injected as HTML. That is safe
 * here because the only source of these files is content/ in this repository:
 * they arrive through a pull request or a committed generator run, never from
 * a visitor. If content ever becomes user-submitted, this needs sanitising
 * before it renders.
 */

import React, { useMemo } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Box, Container, Divider, Typography } from '@mui/material'
import { marked } from 'marked'
import Layout from '@/components/Layout'
import Footer from '@/components/Footer'
import AdSlot from '@/components/AdSlot'
import { getArticle, site } from '@/seo/manifest'
import useDocumentMeta from '@/seo/useDocumentMeta'

const articleSx = {
  maxWidth: '44rem',
  '& h2': { fontSize: '1.5rem', fontWeight: 700, mt: 5, mb: 1.5 },
  '& h3': { fontSize: '1.15rem', fontWeight: 700, mt: 4, mb: 1 },
  '& p': { lineHeight: 1.7, mb: 2, color: 'text.secondary' },
  '& ul, & ol': { pl: 3, mb: 2, color: 'text.secondary' },
  '& li': { mb: 0.75, lineHeight: 1.7 },
  '& code': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '0.875em',
    backgroundColor: 'action.hover',
    px: 0.75,
    py: 0.25,
    borderRadius: 1,
  },
  '& pre': { p: 2, borderRadius: 2, backgroundColor: 'action.hover', overflowX: 'auto', mb: 2 },
  '& pre code': { backgroundColor: 'transparent', p: 0 },
  '& table': { width: '100%', borderCollapse: 'collapse', mb: 3, fontSize: '0.9rem' },
  '& th, & td': { border: 1, borderColor: 'divider', px: 1.5, py: 1, textAlign: 'left' },
  '& th': { backgroundColor: 'action.hover', fontWeight: 700 },
  '& a': { color: 'primary.main' },
  '& blockquote': {
    borderLeft: 4,
    borderColor: 'divider',
    pl: 2,
    ml: 0,
    fontStyle: 'italic',
    color: 'text.secondary',
  },
}

const Article: React.FC = () => {
  const { slug = '' } = useParams()
  const article = getArticle('en', slug)

  const html = useMemo(
    () => (article ? (marked.parse(article.body, { async: false }) as string) : ''),
    [article],
  )

  useDocumentMeta({
    title: article ? `${article.title} - ${site.name}` : site.name,
    description: article?.description,
    path: article?.path,
    locale: article?.locale,
  })

  if (!article) return <Navigate to="/blog" replace />

  return (
    <>
      {/* Short label on purpose: the full headline is the h1 below, and
          repeating it in the app bar chip and the breadcrumb reads as noise. */}
      <Layout title="Guide">
        <Container maxWidth="md" disableGutters>
          <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
            {article.title}
          </Typography>

          {article.date && (
            <Typography variant="caption" color="text.secondary">
              {article.date}
              {article.updated && article.updated !== article.date ? ` (updated ${article.updated})` : ''}
            </Typography>
          )}

          <Divider sx={{ my: 3 }} />

          <Box sx={articleSx} dangerouslySetInnerHTML={{ __html: html }} />

          <AdSlot />
        </Container>
      </Layout>
      <Footer />
    </>
  )
}

export default Article
