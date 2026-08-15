/**
 * Article index.
 *
 * The content pipeline commits markdown into content/<locale>/ and this page
 * picks it up automatically - there is no list to maintain by hand.
 */

import React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Card, CardActionArea, CardContent, Chip, Container, Stack, Typography } from '@mui/material'
import Layout from '@/components/Layout'
import Footer from '@/components/Footer'
import { articlesForLocale, getRoute } from '@/seo/manifest'
import useDocumentMeta from '@/seo/useDocumentMeta'

const formatDate = (value: string) => {
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
}

const Blog: React.FC = () => {
  const route = getRoute('/blog')!
  const posts = articlesForLocale('en')

  useDocumentMeta({
    title: route.title,
    description: route.description,
    path: route.path,
    locale: route.locale,
  })

  return (
    <>
      <Layout title="Guides">
        <Container maxWidth="md" disableGutters>
          <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
            {route.h1}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '44rem', mb: 4 }}>
            {route.intro}
          </Typography>

          {posts.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nothing published yet.
            </Typography>
          ) : (
            <Stack spacing={2}>
              {posts.map((post) => (
                <Card key={post.slug} variant="outlined">
                  <CardActionArea component={RouterLink} to={post.path}>
                    <CardContent>
                      <Typography variant="h6" component="h2" fontWeight={600} gutterBottom>
                        {post.title}
                      </Typography>
                      {post.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                          {post.description}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        {post.date && (
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(post.date)}
                          </Typography>
                        )}
                        {post.tags.map((tag) => (
                          <Chip key={tag} label={tag} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              ))}
            </Stack>
          )}
        </Container>
      </Layout>
      <Footer />
    </>
  )
}

export default Blog
