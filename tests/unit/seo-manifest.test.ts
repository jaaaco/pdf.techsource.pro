/**
 * Guards the SEO manifest.
 *
 * These are the invariants that silently break rankings rather than the build:
 * a duplicated title across two routes, a description that gets truncated in
 * the SERP, a route in the manifest that the router does not serve. None of
 * them throw at runtime, so they need a test.
 */

import { describe, it, expect } from 'vitest'
import routes from '../../seo/routes.json'
import site from '../../seo/site.json'

interface Route {
  id: string
  path: string
  locale: string
  title: string
  description: string
  h1: string
  intro: string
  bullets: string[]
  faq: { q: string; a: string }[]
  priority: number
  changefreq: string
}

const manifest = routes as Route[]

describe('seo/routes.json', () => {
  it('has at least the four tools, the home page and the policy pages', () => {
    const ids = manifest.map((route) => route.id)
    for (const required of ['home', 'compress', 'merge', 'split', 'ocr', 'blog', 'privacy', 'contact']) {
      expect(ids).toContain(required)
    }
  })

  it('gives every route a unique path', () => {
    const paths = manifest.map((route) => route.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('gives every route a unique title and description', () => {
    const titles = manifest.map((route) => route.title)
    const descriptions = manifest.map((route) => route.description)
    expect(new Set(titles).size).toBe(titles.length)
    expect(new Set(descriptions).size).toBe(descriptions.length)
  })

  it('keeps titles and descriptions inside what search engines display', () => {
    for (const route of manifest) {
      expect(route.title.length, `title too long: ${route.path}`).toBeLessThanOrEqual(70)
      expect(route.title.length, `title too short: ${route.path}`).toBeGreaterThan(10)
      expect(route.description.length, `description too long: ${route.path}`).toBeLessThanOrEqual(170)
      expect(route.description.length, `description too short: ${route.path}`).toBeGreaterThan(50)
    }
  })

  it('gives every route an h1 and an intro paragraph', () => {
    for (const route of manifest) {
      expect(route.h1.trim(), `missing h1: ${route.path}`).not.toBe('')
      expect(route.intro.trim().length, `intro too thin: ${route.path}`).toBeGreaterThan(40)
    }
  })

  it('starts every path with a slash and never ends with one', () => {
    for (const route of manifest) {
      expect(route.path.startsWith('/'), `bad path: ${route.path}`).toBe(true)
      expect(route.path === '/' || !route.path.endsWith('/'), `trailing slash: ${route.path}`).toBe(true)
    }
  })

  it('uses a locale that the site declares', () => {
    for (const route of manifest) {
      expect(site.locales).toContain(route.locale)
    }
  })

  it('has a valid sitemap priority on every route', () => {
    for (const route of manifest) {
      expect(route.priority).toBeGreaterThan(0)
      expect(route.priority).toBeLessThanOrEqual(1)
    }
  })
})

describe('seo/site.json', () => {
  it('has an absolute origin with no trailing slash', () => {
    expect(site.origin).toMatch(/^https:\/\//)
    expect(site.origin.endsWith('/')).toBe(false)
  })
})
