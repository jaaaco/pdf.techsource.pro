/**
 * Normalises a markdown source file into an article descriptor.
 *
 * Shared by the Node prerender script (reads from disk) and the browser
 * article loader (reads via import.meta.glob), so that a page rendered for
 * a crawler and the same page rendered for a human come from one definition.
 */

import { parseFrontMatter } from './frontmatter.mjs'

const FILE_PATH_PATTERN = /content\/(?<locale>[a-z]{2})\/(?<slug>[^/]+)\.md$/

const asString = (value, fallback = '') =>
  typeof value === 'string' ? value : Array.isArray(value) ? value.join(', ') : fallback

const asArray = (value) => (Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : [])

/**
 * Article URL path for a locale/slug pair. English lives at the root,
 * every other locale is prefixed, which is what the hreflang tags assume.
 */
export const articlePath = (locale, slug) => (locale === 'en' ? `/blog/${slug}` : `/${locale}/blog/${slug}`)

export const toArticle = (filePath, source) => {
  const match = FILE_PATH_PATTERN.exec(filePath.replace(/\\/g, '/'))
  if (!match?.groups) return null

  const { data, body } = parseFrontMatter(source)
  const locale = asString(data.locale, match.groups.locale)
  const slug = asString(data.slug, match.groups.slug)

  if (!slug || !body) return null

  return {
    slug,
    locale,
    path: articlePath(locale, slug),
    title: asString(data.title, slug),
    description: asString(data.description),
    date: asString(data.date),
    updated: asString(data.updated, asString(data.date)),
    tags: asArray(data.tags),
    body,
  }
}

/** Newest first, with undated drafts last. */
export const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '')
