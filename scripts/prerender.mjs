#!/usr/bin/env node
/**
 * Post-build prerenderer.
 *
 * Vite emits a single index.html whose <head> is identical for every URL and
 * whose <body> is an empty #root. That is unindexable: every route looks like
 * the same page to a crawler. This script takes the built index.html as a
 * template and writes one real HTML file per route and per article, each with
 * its own title, description, canonical, hreflang, structured data and a
 * server-rendered copy of the page's text.
 *
 * React replaces the contents of #root on hydration, so the static copy is
 * what crawlers and no-JS clients see. It has to stay in sync with what the
 * React pages render - see src/components/SeoSection.tsx, which renders the
 * same fields from the same manifest.
 *
 * Also emits sitemap.xml and robots.txt, which cannot be static files in
 * public/ because they need the generated URL list.
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'

import { toArticle, byDateDesc } from '../seo/articles.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const CONTENT = join(ROOT, 'content')

const site = JSON.parse(await readFile(join(ROOT, 'seo/site.json'), 'utf8'))
const routes = JSON.parse(await readFile(join(ROOT, 'seo/routes.json'), 'utf8'))

const ORIGIN = site.origin.replace(/\/$/, '')
const BUILD_DATE = (process.env.SOURCE_DATE || new Date().toISOString()).slice(0, 10)

/* ------------------------------------------------------------------ utils */

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** Absolute URL for a site-relative path. */
const absolute = (path) => (path === '/' ? `${ORIGIN}/` : `${ORIGIN}${path}`)

/** JSON-LD has to survive being embedded in HTML, so close out any </script>. */
const jsonLdScript = (payload) =>
  `<script type="application/ld+json">${JSON.stringify(payload).replace(/</g, '\\u003c')}</script>`

/* --------------------------------------------------------------- template */

const templatePath = join(DIST, 'index.html')
if (!existsSync(templatePath)) {
  console.error('[prerender] dist/index.html not found - run vite build first')
  process.exit(1)
}

const rawTemplate = await readFile(templatePath, 'utf8')

// Strip the placeholder head tags; every page supplies its own.
const template = rawTemplate
  .replace(/\s*<title>[\s\S]*?<\/title>/i, '')
  .replace(/\s*<meta\s+name="description"[^>]*>/i, '')
  .replace(/\s*<meta\s+name="keywords"[^>]*>/i, '')

if (!template.includes('<div id="root"></div>')) {
  console.error('[prerender] could not find an empty <div id="root"></div> in the template')
  process.exit(1)
}

/* ---------------------------------------------------------------- content */

const readArticles = async () => {
  if (!existsSync(CONTENT)) return []

  const entries = await readdir(CONTENT, { withFileTypes: true, recursive: true })
  const articles = []

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const filePath = join(entry.parentPath ?? entry.path, entry.name)
    const article = toArticle(filePath.slice(ROOT.length + 1), await readFile(filePath, 'utf8'))
    if (article) articles.push(article)
  }

  return articles.sort(byDateDesc)
}

const articles = await readArticles()

/* ------------------------------------------------------------ page models */

/** Routes that exist in more than one locale get hreflang alternates. */
const alternatesFor = (id) => {
  const siblings = routes.filter((route) => route.id === id)
  return siblings.length > 1 ? siblings : []
}

const routePages = routes.map((route) => ({
  ...route,
  type: 'route',
  lastmod: BUILD_DATE,
  alternates: alternatesFor(route.id),
}))

const articlePages = articles.map((article) => ({
  id: `article:${article.slug}`,
  type: 'article',
  path: article.path,
  locale: article.locale,
  title: `${article.title} - ${site.name}`,
  description: article.description,
  h1: article.title,
  intro: '',
  bullets: [],
  faq: [],
  bodyHtml: marked.parse(article.body, { async: false }),
  date: article.date,
  lastmod: article.updated || article.date || BUILD_DATE,
  priority: 0.7,
  changefreq: 'monthly',
  alternates: [],
}))

const pages = [...routePages, ...articlePages]

/* -------------------------------------------------------------------- head */

const buildHead = (page) => {
  const url = absolute(page.path)
  const parts = [
    `<title>${escapeHtml(page.title)}</title>`,
    `<meta name="description" content="${escapeHtml(page.description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="${page.type === 'article' ? 'article' : 'website'}" />`,
    `<meta property="og:site_name" content="${escapeHtml(site.name)}" />`,
    `<meta property="og:title" content="${escapeHtml(page.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:locale" content="${page.locale === 'pl' ? 'pl_PL' : 'en_US'}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`,
    `<meta name="robots" content="index, follow, max-image-preview:large" />`,
  ]

  for (const alternate of page.alternates) {
    parts.push(`<link rel="alternate" hreflang="${alternate.locale}" href="${absolute(alternate.path)}" />`)
  }
  if (page.alternates.length > 0) {
    const fallback = page.alternates.find((alternate) => alternate.locale === site.defaultLocale)
    if (fallback) {
      parts.push(`<link rel="alternate" hreflang="x-default" href="${absolute(fallback.path)}" />`)
    }
  }

  parts.push(...buildStructuredData(page).map(jsonLdScript))

  return parts.join('\n    ')
}

const buildStructuredData = (page) => {
  const blocks = []

  if (page.type === 'article') {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: page.h1,
      description: page.description,
      datePublished: page.date || undefined,
      dateModified: page.lastmod || undefined,
      inLanguage: page.locale,
      mainEntityOfPage: absolute(page.path),
      publisher: { '@type': 'Organization', name: site.publisher.name, url: site.publisher.url },
    })
  } else {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: page.path === '/' ? site.name : `${page.h1} - ${site.name}`,
      description: page.description,
      url: absolute(page.path),
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any browser',
      inLanguage: page.locale,
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    })
  }

  if (page.path !== '/') {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: site.name, item: absolute('/') },
        { '@type': 'ListItem', position: 2, name: page.h1, item: absolute(page.path) },
      ],
    })
  }

  if (page.faq?.length) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faq.map((entry) => ({
        '@type': 'Question',
        name: entry.q,
        acceptedAnswer: { '@type': 'Answer', text: entry.a },
      })),
    })
  }

  return blocks
}

/* -------------------------------------------------------------------- body */

const NAV = routes.filter((route) => route.locale === site.defaultLocale)

/**
 * Article links for a route page, mirroring RelatedGuides on the React side.
 *
 * Without these the only path to an article in the static HTML was the footer
 * link to /blog - and the prerendered /blog page listed nothing at all, so a
 * crawler following it found a dead end. Tool pages link to articles tagged
 * for that tool, everything else gets the newest.
 */
const guidesFor = (page) => {
  if (page.type === 'article') return []

  const localeArticles = articles.filter((article) => article.locale === page.locale)
  if (localeArticles.length === 0) return []

  if (page.id === 'blog') return localeArticles

  const tagged = localeArticles.filter((article) => article.tags.includes(page.id))
  return (tagged.length > 0 ? tagged : localeArticles).slice(0, 3)
}

const buildBody = (page) => {
  const sections = [`<h1>${escapeHtml(page.h1)}</h1>`]

  if (page.intro) sections.push(`<p>${escapeHtml(page.intro)}</p>`)

  if (page.bullets?.length) {
    sections.push(`<ul>${page.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`)
  }

  if (page.bodyHtml) sections.push(page.bodyHtml)

  if (page.faq?.length) {
    sections.push('<h2>Frequently asked questions</h2>')
    for (const entry of page.faq) {
      sections.push(`<h3>${escapeHtml(entry.q)}</h3><p>${escapeHtml(entry.a)}</p>`)
    }
  }

  const guides = guidesFor(page)
  if (guides.length > 0) {
    sections.push('<h2>Guides and benchmarks</h2>')
    sections.push(
      `<ul>${guides
        .map(
          (guide) =>
            `<li><a href="${guide.path}">${escapeHtml(guide.title)}</a>` +
            (guide.description ? ` - ${escapeHtml(guide.description)}` : '') +
            '</li>',
        )
        .join('')}</ul>`,
    )
  }

  const nav = NAV.filter((route) => route.path !== page.path)
    .map((route) => `<li><a href="${route.path}">${escapeHtml(route.h1)}</a></li>`)
    .join('')

  return [
    '<div data-prerendered="true" style="max-width:44rem;margin:0 auto;padding:2rem 1.5rem;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6;color:#1f2937">',
    `<p><a href="/">${escapeHtml(site.name)}</a></p>`,
    '<main>',
    sections.join('\n'),
    '</main>',
    `<nav aria-label="All pages"><ul>${nav}</ul></nav>`,
    '</div>',
  ].join('\n')
}

/* ------------------------------------------------------------------- write */

/**
 * `/compress` is written as `dist/compress.html`, not `dist/compress/index.html`.
 *
 * Both are served by Netlify, but the directory form makes it 301 `/compress`
 * to `/compress/` - and the canonical tag on that page points back at
 * `/compress`. Search engines see a URL that redirects to a page claiming the
 * redirecting URL as canonical, which is a self-inflicted crawl problem. The
 * flat form serves `/compress` directly, so the served URL and the canonical
 * are the same string.
 */
const outputPathFor = (path) => (path === '/' ? join(DIST, 'index.html') : join(DIST, `${path}.html`))

const writePage = async (page) => {
  const html = template
    .replace(/<html\s+lang="[^"]*"/i, `<html lang="${page.locale}"`)
    .replace('</head>', `  ${buildHead(page)}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${buildBody(page)}</div>`)

  const outFile = outputPathFor(page.path)
  await mkdir(dirname(outFile), { recursive: true })
  await writeFile(outFile, html, 'utf8')
}

await Promise.all(pages.map(writePage))

/* ---------------------------------------------------------------- sitemap */

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ...pages.map((page) =>
    [
      '  <url>',
      `    <loc>${absolute(page.path)}</loc>`,
      `    <lastmod>${page.lastmod}</lastmod>`,
      `    <changefreq>${page.changefreq}</changefreq>`,
      `    <priority>${page.priority.toFixed(1)}</priority>`,
      ...page.alternates.map(
        (alternate) =>
          `    <xhtml:link rel="alternate" hreflang="${alternate.locale}" href="${absolute(alternate.path)}" />`,
      ),
      '  </url>',
    ].join('\n'),
  ),
  '</urlset>',
  '',
].join('\n')

await writeFile(join(DIST, 'sitemap.xml'), sitemap, 'utf8')

/* ----------------------------------------------------------------- robots */

const robots = [
  'User-agent: *',
  'Allow: /',
  '',
  `Sitemap: ${ORIGIN}/sitemap.xml`,
  '',
].join('\n')

await writeFile(join(DIST, 'robots.txt'), robots, 'utf8')

console.log(
  `[prerender] ${routePages.length} routes + ${articlePages.length} articles -> ${pages.length} HTML files, sitemap.xml, robots.txt`,
)
