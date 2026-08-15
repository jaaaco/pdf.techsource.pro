#!/usr/bin/env node
/**
 * Harvests search phrases from free, keyless sources.
 *
 * Paid keyword tools are the obvious route and the wrong one here: the budget
 * for this project is zero. What is free is the autocomplete behind the search
 * boxes themselves, which is built from what people actually type, and the
 * public question sites where they describe the problem in their own words.
 * Between them that is enough to find long-tail intent, which is the only
 * segment this domain can realistically win.
 *
 * Appends to content/keywords.jsonl. Phrases already recorded are left alone,
 * so the file is an accumulating record with first-seen dates rather than a
 * snapshot - that history is what tells you whether a phrase is new or has
 * been sitting unused for months.
 *
 *   node automation/keyword-harvest.mjs
 *   node automation/keyword-harvest.mjs --lang=pl
 *   node automation/keyword-harvest.mjs --dry-run
 */

import { appendFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'content/keywords.jsonl')

const argOf = (name, fallback) => {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const dryRun = process.argv.includes('--dry-run')
const langFilter = argOf('lang', null)

const TODAY = process.env.HARVEST_DATE ?? new Date().toISOString().slice(0, 10)

/**
 * Seeds are intents, not product names. "pdf toolkit" would return nothing
 * useful; "compress pdf without uploading" is what somebody types when they
 * have the problem this site solves.
 */
const SEEDS = {
  en: [
    'compress pdf',
    'compress pdf without uploading',
    'reduce pdf file size',
    'merge pdf',
    'combine pdf files',
    'split pdf',
    'extract pages from pdf',
    'ocr pdf',
    'make scanned pdf searchable',
    // Bare "pdf privacy" and "pdf tool offline" were seeds in the first
    // version. They pulled in hundreds of results about privacy policies and
    // legislation - people looking for a document, not a tool. Every seed
    // now names an operation.
    'compress pdf offline',
    'edit pdf without uploading',
  ],
  pl: [
    'kompresja pdf',
    'zmniejsz rozmiar pdf',
    'jak zmniejszyc pdf',
    'polacz pliki pdf',
    'podziel pdf',
    'wyodrebnij strony z pdf',
    'ocr pdf',
    'skan pdf na tekst',
    'kompresja pdf offline',
    'pdf bez wysylania na serwer',
  ],
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('')

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

const fetchJson = async (url, init = {}) => {
  const response = await fetch(url, {
    ...init,
    headers: {
      // Autocomplete endpoints reject the default fetch agent string.
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) pdf.techsource.pro-research',
      ...init.headers,
    },
  })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  return response.json()
}

/* ----------------------------------------------------------------- sources */

/** Google's own autocomplete. Returns [query, [suggestions]]. */
const googleSuggest = async (seed, lang) => {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=${lang}&q=${encodeURIComponent(seed)}`
  const [, suggestions] = await fetchJson(url)
  return suggestions ?? []
}

const duckSuggest = async (seed) => {
  const url = `https://duckduckgo.com/ac/?q=${encodeURIComponent(seed)}&type=list`
  const [, suggestions] = await fetchJson(url)
  return suggestions ?? []
}

/**
 * Question titles from Super User. People phrase problems there in full
 * sentences, which is where "how do I compress a pdf without uploading it"
 * comes from rather than a two-word head term.
 */
const stackExchange = async (seed) => {
  const url =
    'https://api.stackexchange.com/2.3/search/advanced' +
    `?order=desc&sort=votes&pagesize=25&site=superuser&q=${encodeURIComponent(seed)}`
  const data = await fetchJson(url)
  return (data.items ?? []).map((item) => item.title)
}

/**
 * Reddit's public search JSON now answers 403 to unauthenticated clients, so
 * this contributes nothing and is left disabled rather than deleted: the
 * endpoint is one OAuth app registration away from working again, and the
 * shape of the call is the part worth keeping.
 */
const REDDIT_ENABLED = false

const reddit = async (seed) => {
  if (!REDDIT_ENABLED) return []
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(seed)}&limit=25&sort=relevance`
  const data = await fetchJson(url)
  return (data?.data?.children ?? []).map((child) => child.data.title)
}

/* ------------------------------------------------------------------ shaping */

const clean = (phrase) =>
  String(phrase)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[?!.]+$/, '')
    .trim()

/**
 * An operation the site can actually perform. A phrase without one of these
 * is not a job anybody is trying to do with this tool.
 */
const ACTIONS =
  /\b(compress|compression|reduce|shrink|resize|optimi[sz]e|merge|combine|join|split|separate|extract|delete|remove|rotate|ocr|scan|scanned|searchable|convert|edit|zmniejsz|kompres|scal|polacz|łącz|podziel|wyodrebnij|wyodrębnij|obroc|obróć|skan|edytuj|konwert)\b/

/**
 * Phrases that contain "pdf" but are about something else entirely.
 *
 * The first harvest returned 2099 English phrases and most of the noise fell
 * into two families: people looking for a *document* that happens to be a PDF
 * ("privacy act 1988 pdf", "the right to privacy pdf"), and support queries
 * about other vendors' desktop software ("pdf xchange security bulletin").
 * Neither is a search this site can answer.
 */
const BLOCKED =
  /\b(privacy policy|policy pdf|act \d{4}|\d{4} pdf|book|ebook download|free download|lyrics|resume|cv|template|xchange|foxit|nitro|sejda|smallpdf|ilovepdf|reader dc|crack|serial|license key)\b/

/**
 * Reject "<topic> pdf" - a phrase that ends in "pdf" and names no operation
 * is somebody hunting for a file, not for a tool. This is the single rule
 * that removes most of the noise.
 */
const isDocumentHunt = (phrase) => /\bpdf$/.test(phrase) && !ACTIONS.test(phrase)

/**
 * Length bounds drop single words - too competitive to be worth a page - and
 * whole paragraphs pasted into a question title.
 */
const isUsable = (phrase) =>
  phrase.includes('pdf') &&
  phrase.length >= 12 &&
  phrase.length <= 90 &&
  phrase.split(' ').length >= 3 &&
  ACTIONS.test(phrase) &&
  !BLOCKED.test(phrase) &&
  !isDocumentHunt(phrase)

/** Rough intent bucket, used later to decide what kind of page to write. */
const classify = (phrase) => {
  if (/\bhow\b|\bjak\b|tutorial|guide|poradnik/.test(phrase)) return 'how-to'
  if (/\bvs\b|versus|better than|alternative|zamiast|alternatywa/.test(phrase)) return 'comparison'
  if (/without|no upload|offline|locally|in browser|bez wysy|offline|lokalnie|w przegl/.test(phrase)) {
    return 'privacy'
  }
  if (/free|darmow|online|bez/.test(phrase)) return 'tool'
  return 'informational'
}

/* --------------------------------------------------------------------- run */

const readExisting = async () => {
  if (!existsSync(OUT)) return new Set()
  const text = await readFile(OUT, 'utf8')
  const seen = new Set()
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      seen.add(JSON.parse(line).phrase)
    } catch {
      /* a corrupted line should not stop the harvest */
    }
  }
  return seen
}

const seen = await readExisting()
const collected = new Map()

const record = (phrase, lang, source) => {
  const cleaned = clean(phrase)
  if (!isUsable(cleaned) || seen.has(cleaned) || collected.has(cleaned)) return
  collected.set(cleaned, {
    phrase: cleaned,
    lang,
    source,
    intent: classify(cleaned),
    firstSeen: TODAY,
    status: 'new',
  })
}

const languages = Object.keys(SEEDS).filter((lang) => !langFilter || lang === langFilter)

for (const lang of languages) {
  for (const seed of SEEDS[lang]) {
    // Bare seed plus the alphabet trick: appending each letter makes the
    // autocomplete reveal a different slice of its index each time.
    const variants = [seed, ...ALPHABET.map((letter) => `${seed} ${letter}`)]

    for (const variant of variants) {
      try {
        for (const suggestion of await googleSuggest(variant, lang)) {
          record(suggestion, lang, 'google-suggest')
        }
      } catch (error) {
        console.warn(`[harvest] google "${variant}": ${error.message}`)
      }
      await sleep(120)
    }

    try {
      for (const suggestion of await duckSuggest(seed)) record(suggestion, lang, 'duckduckgo')
    } catch (error) {
      console.warn(`[harvest] ddg "${seed}": ${error.message}`)
    }

    // English-only: both sites are overwhelmingly English and Polish seeds
    // return noise.
    if (lang === 'en') {
      try {
        for (const title of await stackExchange(seed)) record(title, lang, 'superuser')
      } catch (error) {
        console.warn(`[harvest] stackexchange "${seed}": ${error.message}`)
      }
      try {
        for (const title of await reddit(seed)) record(title, lang, 'reddit')
      } catch (error) {
        console.warn(`[harvest] reddit "${seed}": ${error.message}`)
      }
    }

    console.log(`  ${lang}  ${seed.padEnd(34)} running total ${collected.size}`)
    await sleep(400)
  }
}

const rows = [...collected.values()]

if (rows.length === 0) {
  console.log('[harvest] nothing new')
  process.exit(0)
}

if (dryRun) {
  for (const row of rows) console.log(`${row.lang}  ${row.intent.padEnd(14)} ${row.phrase}`)
  console.log(`\n[harvest] ${rows.length} new phrases (dry run, nothing written)`)
  process.exit(0)
}

await appendFile(OUT, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8')
console.log(`\n[harvest] +${rows.length} new phrases -> ${OUT} (${seen.size + rows.length} total)`)
