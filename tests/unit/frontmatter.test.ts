/**
 * The front-matter parser is deliberately minimal, which makes it worth
 * pinning down: the content pipeline writes these files unattended, and a
 * silently mis-parsed date or slug turns into a wrong URL in the sitemap.
 */

import { describe, it, expect } from 'vitest'
import { parseFrontMatter } from '../../seo/frontmatter.mjs'
import { toArticle, articlePath } from '../../seo/articles.mjs'

describe('parseFrontMatter', () => {
  it('splits front matter from the body', () => {
    const { data, body } = parseFrontMatter('---\ntitle: Hello\n---\nBody text.')
    expect(data.title).toBe('Hello')
    expect(body).toBe('Body text.')
  })

  it('parses inline arrays', () => {
    const { data } = parseFrontMatter('---\ntags: [a, b, c]\n---\nx')
    expect(data.tags).toEqual(['a', 'b', 'c'])
  })

  it('parses an empty array', () => {
    const { data } = parseFrontMatter('---\ntags: []\n---\nx')
    expect(data.tags).toEqual([])
  })

  it('strips surrounding quotes', () => {
    const { data } = parseFrontMatter('---\ntitle: "Quoted: with colon"\n---\nx')
    expect(data.title).toBe('Quoted: with colon')
  })

  it('returns the whole source as body when there is no front matter', () => {
    const { data, body } = parseFrontMatter('Just markdown.')
    expect(data).toEqual({})
    expect(body).toBe('Just markdown.')
  })

  it('tolerates CRLF line endings', () => {
    const { data } = parseFrontMatter('---\r\ntitle: Hello\r\n---\r\nBody.')
    expect(data.title).toBe('Hello')
  })
})

describe('toArticle', () => {
  const source = [
    '---',
    'title: Test article',
    'description: A description.',
    'date: 2026-08-15',
    'locale: en',
    'slug: test-article',
    'tags: [privacy]',
    '---',
    'Body.',
  ].join('\n')

  it('builds an article from a content path', () => {
    const article = toArticle('content/en/test-article.md', source)
    expect(article).not.toBeNull()
    expect(article?.slug).toBe('test-article')
    expect(article?.path).toBe('/blog/test-article')
    expect(article?.tags).toEqual(['privacy'])
  })

  it('falls back to the locale and slug in the path when front matter omits them', () => {
    const article = toArticle('content/pl/kompresja.md', '---\ntitle: T\n---\nBody.')
    expect(article?.locale).toBe('pl')
    expect(article?.slug).toBe('kompresja')
    expect(article?.path).toBe('/pl/blog/kompresja')
  })

  it('rejects files outside the content layout', () => {
    expect(toArticle('README.md', source)).toBeNull()
  })

  it('rejects an article with no body', () => {
    expect(toArticle('content/en/empty.md', '---\ntitle: T\n---\n')).toBeNull()
  })
})

describe('articlePath', () => {
  it('keeps English at the root and prefixes other locales', () => {
    expect(articlePath('en', 'x')).toBe('/blog/x')
    expect(articlePath('pl', 'x')).toBe('/pl/blog/x')
  })
})
