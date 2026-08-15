/**
 * Minimal front-matter parser.
 *
 * Deliberately tiny: the only producer of these files is the content pipeline
 * in this repo, so the supported subset is `key: value` and `key: [a, b, c]`
 * between two `---` fences. Anything fancier belongs in the generator, not here.
 *
 * Shared by the Node prerender script and the browser article loader, so it
 * stays plain ESM with no dependencies.
 */

const stripQuotes = (value) => {
  const trimmed = value.trim()
  if (trimmed.length >= 2) {
    const first = trimmed[0]
    const last = trimmed[trimmed.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1)
    }
  }
  return trimmed
}

const parseValue = (raw) => {
  const trimmed = raw.trim()
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim()
    if (!inner) return []
    return inner.split(',').map(stripQuotes).filter(Boolean)
  }
  return stripQuotes(trimmed)
}

/**
 * Split a markdown source into its front matter and body.
 */
export const parseFrontMatter = (source) => {
  const normalized = source.replace(/^﻿/, '').replace(/\r\n/g, '\n')

  if (!normalized.startsWith('---\n')) {
    return { data: {}, body: normalized.trim() }
  }

  const end = normalized.indexOf('\n---', 4)
  if (end === -1) {
    return { data: {}, body: normalized.trim() }
  }

  const block = normalized.slice(4, end)
  const body = normalized.slice(end + 4).replace(/^\n/, '')

  const data = {}
  for (const line of block.split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    const separator = line.indexOf(':')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    if (!key) continue
    data[key] = parseValue(line.slice(separator + 1))
  }

  return { data, body: body.trim() }
}

export default parseFrontMatter
