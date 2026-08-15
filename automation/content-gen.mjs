#!/usr/bin/env node
/**
 * Writes one article, verifies it, and ships it.
 *
 * Picks an unused phrase from the harvest, hands it to a headless Claude
 * along with the measured benchmark figures, then checks what comes back
 * before letting it near the site.
 *
 * The checks are the whole point. Generating text is easy and worthless; what
 * keeps this on the right side of Google's scaled-content-abuse policy - and
 * of being honest - is that a page has to carry something true that no
 * competitor has. So a draft is rejected if it is thin, if its front matter
 * is wrong, if the slug collides, if the build breaks, and above all if it
 * quotes a statistic that is not in benchmarks/results.json. A model asked to
 * write about compression will happily invent "up to 90%", and that is
 * exactly the claim this site exists to contradict.
 *
 *   node automation/content-gen.mjs --dry-run   # print the draft, ship nothing
 *   node automation/content-gen.mjs             # write, verify, commit, push
 *   node automation/content-gen.mjs --lang=pl
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, argOf, hasFlag, log, notify } from './lib.mjs'
import { parseFrontMatter } from '../seo/frontmatter.mjs'

const run = promisify(execFile)

const CLAUDE = process.env.CLAUDE_BIN ?? '/Users/jaaaco/.local/bin/claude'
const NODE = '/opt/homebrew/bin/node'
const GIT = '/usr/bin/git'
const NPM = '/opt/homebrew/bin/npm'

const KEYWORDS = join(ROOT, 'content/keywords.jsonl')
const RESULTS = join(ROOT, 'benchmarks/results.json')
const JOB = 'content-gen'

const dryRun = hasFlag('dry-run')
const wantedLang = argOf('lang', null)
const TODAY = process.env.CONTENT_DATE ?? new Date().toISOString().slice(0, 10)

/* ------------------------------------------------------------ keyword pick */

const rows = (await readFile(KEYWORDS, 'utf8'))
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line))

/**
 * This site can only win on intent that plays to what it actually is: local
 * processing, no upload, measurable behaviour. Head terms like "compress pdf"
 * are owned by companies with a marketing budget.
 */
const INTENT_WEIGHT = { privacy: 40, 'how-to': 30, comparison: 20, tool: 10, informational: 0 }

const score = (row) => {
  let value = INTENT_WEIGHT[row.intent] ?? 0
  if (/without|offline|no upload|bez wysy|lokalnie|locally/.test(row.phrase)) value += 25
  // A specific target size is somebody with a concrete job, and a page can
  // answer it concretely.
  if (/\b\d+\s?(kb|mb)\b/.test(row.phrase)) value += 20
  if (/\b(ocr|scan|skan|searchable)\b/.test(row.phrase)) value += 10
  // Longer phrases are less contested.
  value += Math.min(15, row.phrase.split(' ').length * 2)
  return value
}

const slugify = (phrase) =>
  phrase
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 70)

const candidates = rows
  .filter((row) => row.status === 'new')
  .filter((row) => !wantedLang || row.lang === wantedLang)
  .filter((row) => !existsSync(join(ROOT, `content/${row.lang}/${slugify(row.phrase)}.md`)))
  .sort((a, b) => score(b) - score(a))

if (candidates.length === 0) {
  await log(JOB, 'no unused phrases left - run automation/keyword-harvest.mjs')
  process.exit(0)
}

const chosen = candidates[0]
const slug = slugify(chosen.phrase)
const outPath = join(ROOT, `content/${chosen.lang}/${slug}.md`)

await log(JOB, `chosen "${chosen.phrase}" (${chosen.lang}, ${chosen.intent}, score ${score(chosen)})`)

/* ----------------------------------------------------------- measured data */

const results = JSON.parse(await readFile(RESULTS, 'utf8'))

const measuredLines = []
const allowedNumbers = new Set()

for (const entry of results.results) {
  for (const item of entry.runs) {
    if (item.error) continue
    if (entry.tool === 'compress') {
      const percent = Math.abs(item.savedPercent)
      allowedNumbers.add(percent.toFixed(1))
      allowedNumbers.add(String(Math.round(percent)))
      // Sizes are given in both units on purpose. Handed only megabytes, a
      // model rounds 0.016 MB to "0.02 MB" and then confidently converts that
      // to "20 KB" in prose - which is how a 16 KB file got published as 20 KB.
      // The percentage guard below cannot catch that, so remove the need to
      // convert at all.
      measuredLines.push(
        `${entry.file}, ${item.preset} preset: ` +
          `${(item.inputBytes / 1048576).toFixed(2)} MB (${Math.round(item.inputBytes / 1024)} KB) -> ` +
          `${(item.outputBytes / 1048576).toFixed(2)} MB (${Math.round(item.outputBytes / 1024)} KB) ` +
          `(${item.savedPercent > 0 ? '-' : '+'}${percent}%), ` +
          `${(item.elapsedMs / 1000).toFixed(1)}s, pages ${item.inputPages} -> ${item.outputPages}`,
      )
    }
    if (entry.tool === 'ocr' && item.wordRecall !== null && item.wordRecall !== undefined) {
      const percent = item.wordRecall * 100
      allowedNumbers.add(percent.toFixed(1))
      allowedNumbers.add(String(Math.round(percent)))
      measuredLines.push(
        `${entry.file}, OCR: word recall ${percent.toFixed(1)}%, ${(item.elapsedMs / 1000).toFixed(1)}s`,
      )
    }
  }
}

/* --------------------------------------------------------------- the brief */

const LANGUAGE_NOTE =
  chosen.lang === 'pl'
    ? 'Write in Polish. Natural, direct Polish - the kind a Polish engineer writes, keeping English technical terms in English where that is how people actually say them.'
    : 'Write in English.'

const prompt = `Write one article for pdf.techsource.pro, a free browser-based PDF toolkit that compresses, merges, splits and OCRs files entirely client-side with no upload.

The article targets this search phrase: "${chosen.phrase}"
Intent classified as: ${chosen.intent}

${LANGUAGE_NOTE}

MEASURED DATA — the only statistics you may use. These come from a public benchmark in the repository:
${measuredLines.join('\n')}

HARD RULES
- Never invent a number. If you state a percentage, a file size or a timing, it must come from the measured data above. If you have no measurement for a claim, describe it qualitatively instead.
- Quote sizes in the units given above. Do not convert between MB and KB yourself: a rounded megabyte figure converted back to kilobytes stops being the measurement.
- Do not write "up to X%" marketing phrasing. That is the exact claim this site exists to contradict.
- The reader has a real job to do. Answer it concretely and early. If the honest answer is "this tool cannot do that", say so and explain what does.
- No filler, no "in today's digital world", no restating the title as a first sentence.
- Compression on this site works by re-rendering each page as an image. That is a large win on scans and useless on PDFs that were already vector text — those come back unchanged, on purpose.
- Two presets exist: screen (smallest) and ebook (middle ground). There is no print preset.

STYLE
- Direct and calm. Short sentences mixed with longer explanatory ones.
- Headings as questions or plain statements, never marketing slogans.
- Concrete over general: numbers, steps, trade-offs.
- 600-900 words.

FORMAT — return the complete markdown file and nothing else. No preamble, no code fence around the whole thing. Start with YAML front matter exactly in this shape:

---
title: <a specific title, 30-65 characters, not a restatement of the search phrase>
description: <one or two sentences, 60-165 characters>
date: ${TODAY}
updated: ${TODAY}
locale: ${chosen.lang}
slug: ${slug}
tags: [<two or three lowercase tags>]
---

Then the body in markdown: ## headings, short paragraphs, lists where they help, a table if there is data worth tabulating.`

/* ------------------------------------------------------------- generate */

await log(JOB, 'calling claude...')

let draft
try {
  const { stdout } = await run(CLAUDE, ['-p', prompt], {
    cwd: ROOT,
    maxBuffer: 10 * 1024 * 1024,
    timeout: 600000,
  })
  draft = stdout.trim()
} catch (error) {
  await log(JOB, `claude failed: ${error.message}`)
  await notify(`🔴 content-gen: claude failed for "${chosen.phrase}"`)
  process.exit(1)
}

// Models sometimes wrap the whole file in a fence despite being told not to.
draft = draft.replace(/^```(?:markdown|md)?\n/, '').replace(/\n```$/, '')

/* -------------------------------------------------------------- verify */

const reject = async (reason) => {
  await log(JOB, `REJECTED: ${reason}`)
  await notify(`🟡 content-gen rejected a draft for "${chosen.phrase}"\n\n${reason}`)
  process.exit(1)
}

const { data, body } = parseFrontMatter(draft)

if (!data.title || !data.description || !data.slug) {
  await reject('front matter is missing title, description or slug')
}
if (data.slug !== slug) await reject(`front matter slug "${data.slug}" does not match "${slug}"`)
if (String(data.title).length > 70) await reject(`title is ${String(data.title).length} characters`)
if (String(data.description).length < 50 || String(data.description).length > 170) {
  await reject(`description is ${String(data.description).length} characters, needs 50-170`)
}

const words = body.split(/\s+/).filter(Boolean).length
if (words < 400) await reject(`only ${words} words`)

/**
 * The guard that matters. Any percentage in the body has to be one we
 * actually measured - anything else is the model filling a gap with a
 * plausible-sounding statistic.
 */
const quoted = [...body.matchAll(/(\d+(?:[.,]\d+)?)\s?%/g)].map((match) => match[1].replace(',', '.'))
const invented = quoted.filter((value) => {
  const asNumber = Number(value)
  return !allowedNumbers.has(value) && !allowedNumbers.has(String(Math.round(asNumber)))
})
if (invented.length > 0) {
  await reject(`quotes percentages that were never measured: ${[...new Set(invented)].join(', ')}%`)
}

if (/up to \d/i.test(body) || /aż do \d/i.test(body)) {
  await reject('uses "up to N" marketing phrasing')
}

await log(JOB, `draft ok — ${words} words, ${quoted.length} measured figures cited`)

if (dryRun) {
  console.log(`\n${'-'.repeat(70)}\n${draft}\n${'-'.repeat(70)}`)
  await log(JOB, 'dry run — nothing written')
  process.exit(0)
}

/* ---------------------------------------------------------------- ship */

await writeFile(outPath, `${draft}\n`, 'utf8')

// Mark the phrase used, so the next run picks a different one.
const updated = rows.map((row) =>
  row.phrase === chosen.phrase ? { ...row, status: 'published', slug, publishedAt: TODAY } : row,
)
await writeFile(KEYWORDS, `${updated.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8')

// Build before committing. A draft that breaks the prerender must never
// reach main, because main deploys straight to production.
try {
  await run(NPM, ['run', 'build'], { cwd: ROOT, maxBuffer: 10 * 1024 * 1024, timeout: 600000 })
} catch (error) {
  await run(GIT, ['checkout', '--', 'content/keywords.jsonl'], { cwd: ROOT }).catch(() => {})
  await run(GIT, ['clean', '-f', outPath], { cwd: ROOT }).catch(() => {})
  await reject(`build failed, draft discarded: ${error.message.slice(0, 300)}`)
}

await run(GIT, ['add', outPath, 'content/keywords.jsonl'], { cwd: ROOT })
await run(
  GIT,
  [
    'commit',
    '-m',
    `content: ${data.title}\n\nGenerated for the search phrase "${chosen.phrase}".\nFigures checked against benchmarks/results.json before publishing.\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`,
  ],
  { cwd: ROOT },
)
await run(GIT, ['push', 'origin', 'main'], { cwd: ROOT })

await log(JOB, `published /blog/${slug}`)
await notify(
  `📝 pdf.techsource.pro — new article\n\n${data.title}\nhttps://pdf.techsource.pro/blog/${slug}\n\nphrase: "${chosen.phrase}"\n${words} words`,
)
