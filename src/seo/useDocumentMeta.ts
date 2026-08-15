/**
 * Keeps <title>, the meta description and the canonical link correct after
 * client-side navigation.
 *
 * The prerendered HTML already carries the right tags for the first paint.
 * This hook only matters once react-router takes over: without it, clicking
 * from the homepage to /compress leaves the homepage title in place, which
 * is what analytics and social scrapers would then read.
 */

import { useEffect } from 'react'
import { site } from './manifest'

const upsertMeta = (selector: string, create: () => HTMLMetaElement | HTMLLinkElement, value: string) => {
  let element = document.head.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null
  if (!element) {
    element = create()
    document.head.appendChild(element)
  }
  if (element instanceof HTMLLinkElement) {
    element.href = value
  } else {
    element.content = value
  }
}

export interface DocumentMeta {
  title: string
  description?: string
  path?: string
  locale?: string
}

export const useDocumentMeta = ({ title, description, path, locale }: DocumentMeta): void => {
  useEffect(() => {
    document.title = title

    if (description) {
      upsertMeta('meta[name="description"]', () => {
        const meta = document.createElement('meta')
        meta.name = 'description'
        return meta
      }, description)

      upsertMeta('meta[property="og:description"]', () => {
        const meta = document.createElement('meta')
        meta.setAttribute('property', 'og:description')
        return meta
      }, description)
    }

    upsertMeta('meta[property="og:title"]', () => {
      const meta = document.createElement('meta')
      meta.setAttribute('property', 'og:title')
      return meta
    }, title)

    if (path) {
      const url = `${site.origin.replace(/\/$/, '')}${path === '/' ? '/' : path}`

      upsertMeta('link[rel="canonical"]', () => {
        const link = document.createElement('link')
        link.rel = 'canonical'
        return link
      }, url)

      upsertMeta('meta[property="og:url"]', () => {
        const meta = document.createElement('meta')
        meta.setAttribute('property', 'og:url')
        return meta
      }, url)
    }

    if (locale) {
      document.documentElement.lang = locale
    }
  }, [title, description, path, locale])
}

export default useDocumentMeta
