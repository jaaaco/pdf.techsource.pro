/**
 * Single source of truth for page copy and metadata.
 *
 * The same JSON drives three things: the static HTML written by
 * scripts/prerender.mjs, the <title>/<meta> tags set on client-side
 * navigation, and the copy rendered by SeoSection. They have to agree -
 * showing a crawler one thing and a visitor another is cloaking.
 */

import routesJson from '@seo/routes.json'
import siteJson from '@seo/site.json'
import { toArticle, byDateDesc, type Article } from '@seo/articles.mjs'

export interface FaqEntry {
  q: string
  a: string
}

export interface RouteMeta {
  id: string
  path: string
  locale: string
  priority: number
  changefreq: string
  title: string
  description: string
  h1: string
  intro: string
  bullets: string[]
  faq: FaqEntry[]
}

export interface SiteConfig {
  origin: string
  name: string
  defaultLocale: string
  locales: string[]
  repository: string
  publisher: { name: string; url: string }
  /** Null until there is a mailbox worth publishing; the contact page hides it. */
  contactEmail: string | null
}

export type { Article }

export const site: SiteConfig = siteJson as SiteConfig
export const routes: RouteMeta[] = routesJson as RouteMeta[]

const byPath = new Map(routes.map((route) => [route.path, route]))

export const getRoute = (path: string): RouteMeta | undefined => byPath.get(path)

/**
 * Markdown articles, loaded eagerly so that the blog index and the article
 * pages resolve synchronously. The corpus is small and the bodies are text,
 * so the bundle cost is a few kilobytes per article.
 */
const sources = import.meta.glob('/content/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export const articles: Article[] = Object.entries(sources)
  .map(([filePath, source]) => toArticle(filePath.replace(/^\//, ''), source))
  .filter((article): article is Article => article !== null)
  .sort(byDateDesc)

export const articlesForLocale = (locale: string): Article[] =>
  articles.filter((article) => article.locale === locale)

export const getArticle = (locale: string, slug: string): Article | undefined =>
  articles.find((article) => article.locale === locale && article.slug === slug)
