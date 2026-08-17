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
import { Link } from 'react-router-dom'
import { articlesForLocale, type Article } from '@/seo/manifest'
import { ArrowRightIcon, ChevronRightIcon } from './icons'

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
    <section className="section section-ruled">
      <div className="spread" style={{ marginBottom: 'var(--space-3)' }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <Link to="/blog" className="btn btn-ghost">
          All guides
          <ArrowRightIcon size={16} />
        </Link>
      </div>

      <div className="article-list">
        {guides.map((guide) => (
          <Link key={guide.slug} to={guide.path} className="article-item">
            <div className="spread">
              <div className="grow">
                <div className="article-title">{guide.title}</div>
                {guide.description && (
                  <p className="text-muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
                    {guide.description}
                  </p>
                )}
              </div>
              <ChevronRightIcon size={18} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default RelatedGuides
