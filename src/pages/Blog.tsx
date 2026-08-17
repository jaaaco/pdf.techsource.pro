/**
 * Article index.
 *
 * The content pipeline commits markdown into content/<locale>/ and this page
 * picks it up automatically - there is no list to maintain by hand.
 */

import React from 'react'
import { Link } from 'react-router-dom'
import AppShell from '@/components/AppShell'
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
    <AppShell active="blog" tool={{ title: 'Guides' }}>
      <header className="section" style={{ paddingBottom: 'var(--space-4)' }}>
        <h1>{route.h1}</h1>
        <p className="text-muted reading" style={{ margin: 0 }}>
          {route.intro}
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="section-tight text-muted">Nothing published yet.</p>
      ) : (
        <div className="article-list">
          {posts.map((post) => (
            <Link key={post.slug} to={post.path} className="article-item">
              {post.tags.length > 0 && (
                <div className="cluster" style={{ marginBottom: 6 }}>
                  {post.tags.map((tag) => (
                    <span className="tag tag-neutral" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <h2 className="article-title">{post.title}</h2>
              {post.description && (
                <p className="text-muted" style={{ margin: '6px 0 0', fontSize: 14 }}>
                  {post.description}
                </p>
              )}
              {post.date && <div className="article-meta text-muted">{formatDate(post.date)}</div>}
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  )
}

export default Blog
