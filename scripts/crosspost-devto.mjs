#!/usr/bin/env node
/**
 * Cross-posts an article to dev.to with a canonical URL pointing back here.
 *
 * The canonical is the whole point. Without it dev.to and this site compete
 * for the same text and Google picks a winner on its own, which on a domain
 * this young is never going to be this one. With it, dev.to carries the reach
 * and the ranking signal comes home.
 *
 * Posting is idempotent: the dev.to article id is recorded in
 * automation/state/devto.json, and a second run updates that article via PUT
 * instead of creating a duplicate.
 *
 *   node scripts/crosspost-devto.mjs <slug>              # publish or update
 *   node scripts/crosspost-devto.mjs <slug> --draft      # unpublished, preview only
 *   node scripts/crosspost-devto.mjs <slug> --dry-run    # print payload, send nothing
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseFrontMatter } from '../seo/frontmatter.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STATE = join(ROOT, 'automation/state/devto.json')
const API = 'https://dev.to/api/articles'
const VAULT = '/opt/homebrew/bin/vault'
const SECRET = 'secret/internal/devto'

const args = process.argv.slice(2)
const slug = args.find((arg) => !arg.startsWith('--'))
const dryRun = args.includes('--dry-run')
const asDraft = args.includes('--draft')

if (!slug) {
  console.error('usage: crosspost-devto.mjs <slug> [--draft] [--dry-run]')
  process.exit(1)
}

const site = JSON.parse(await readFile(join(ROOT, 'seo/site.json'), 'utf8'))
const origin = site.origin.replace(/\/$/, '')

const apiKey = () =>
  execFileSync(VAULT, ['kv', 'get', '-field=value', SECRET], {
    env: { ...process.env, VAULT_ADDR: 'https://vault.techsource.pro' },
    encoding: 'utf8',
  }).trim()

/* ------------------------------------------------------------------ article */

const path = join(ROOT, 'content/en', `${slug}.md`)
if (!existsSync(path)) {
  console.error(`[devto] no such article: content/en/${slug}.md`)
  process.exit(1)
}

const { data, body: content } = parseFrontMatter(await readFile(path, 'utf8'))

/*
 * Relative links are correct on this site and broken on dev.to, where they
 * resolve against dev.to itself. Rewrite them rather than dropping them: each
 * one is a link back, which is the second reason for cross-posting at all.
 */
const body = content
  .replace(/\]\((\/[^)]*)\)/g, (_, href) => `](${origin}${href})`)
  .trim()

/*
 * dev.to tags are alphanumeric, lowercase, four at most. Anything with a dash
 * is silently dropped by their API rather than rejected, so strip here where
 * the loss is visible.
 *
 * The site's own tags are a taxonomy; dev.to tags are a distribution channel,
 * and they are not the same job. "ocr" has a few hundred followers there,
 * "javascript" has over a million, and the article is as much about a browser
 * runtime as it is about recognition. So one reach tag is appended when there
 * is a slot left, rather than bending the site's taxonomy to suit dev.to.
 */
const REACH_TAG = 'javascript'

const own = (data.tags ?? [])
  .map((tag) => String(tag).toLowerCase().replace(/[^a-z0-9]/g, ''))
  .filter(Boolean)

const tags = [...new Set([...own, REACH_TAG])].slice(0, 4)

const article = {
  title: data.title,
  body_markdown: body,
  published: !asDraft,
  canonical_url: `${origin}/blog/${slug}`,
  description: data.description,
  tags,
}

if (dryRun) {
  console.log(JSON.stringify({ ...article, body_markdown: `${body.slice(0, 400)}...` }, null, 2))
  console.log(`\n[devto] dry run - ${body.length} chars, tags: ${tags.join(', ')}`)
  process.exit(0)
}

/* -------------------------------------------------------------------- post */

const state = existsSync(STATE) ? JSON.parse(await readFile(STATE, 'utf8')) : {}
const known = state[slug]

const response = await fetch(known ? `${API}/${known.id}` : API, {
  method: known ? 'PUT' : 'POST',
  headers: { 'api-key': apiKey(), 'content-type': 'application/json' },
  body: JSON.stringify({ article }),
})

const payload = await response.json()

if (!response.ok) {
  console.error(`[devto] ${response.status} - ${payload.error ?? JSON.stringify(payload)}`)
  process.exit(1)
}

state[slug] = { id: payload.id, url: payload.url, canonical: article.canonical_url }
await mkdir(dirname(STATE), { recursive: true })
await writeFile(STATE, `${JSON.stringify(state, null, 2)}\n`)

console.log(`[devto] ${known ? 'updated' : 'published'} ${payload.url}`)
console.log(`[devto] canonical -> ${payload.canonical_url}`)
