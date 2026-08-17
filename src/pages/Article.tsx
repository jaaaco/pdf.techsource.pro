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
import { marked } from 'marked'
import AppShell from '@/components/AppShell'
import AdSlot from '@/components/AdSlot'
import { getArticle, site } from '@/seo/manifest'
import useDocumentMeta from '@/seo/useDocumentMeta'

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
    // Short label on purpose: the full headline is the h1 below, and
    // repeating it in the toolbar reads as noise.
    <AppShell active="blog" tool={{ title: 'Guide', backTo: '/blog' }}>
      <article className="section">
        <h1 className="reading">{article.title}</h1>

        {article.date && (
          <p className="text-muted" style={{ fontSize: 12 }}>
            {article.date}
            {article.updated && article.updated !== article.date
              ? ` (updated ${article.updated})`
              : ''}
            {' · '}
            {site.publisher.name}
          </p>
        )}

        <div className="hr" />

        <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />

        <AdSlot />
      </article>
    </AppShell>
  )
}

export default Article
