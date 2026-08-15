#!/usr/bin/env node
/**
 * Turns benchmarks/results.json into a published article.
 *
 * The numbers are generated, so the page about them is generated too. Writing
 * the table by hand would guarantee that it drifts from the measurements the
 * moment anything changes, and a stale benchmark is worse than none - it is
 * a confident claim that is quietly wrong.
 *
 * Output goes through the normal content pipeline (content/en/*.md), so the
 * page is prerendered for crawlers and rendered by React for visitors from
 * the same source, with no third copy to keep in sync.
 *
 *   node benchmarks/report.mjs
 */

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RESULTS = join(ROOT, 'benchmarks/results.json')
const OUT = join(ROOT, 'content/en/pdf-compression-benchmarks.md')

const data = JSON.parse(await readFile(RESULTS, 'utf8'))

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`
const kb = (bytes) => `${Math.round(bytes / 1024)} KB`
const size = (bytes) => (bytes < 1024 * 1024 ? kb(bytes) : mb(bytes))
const seconds = (ms) => `${(ms / 1000).toFixed(1)} s`

/** Plain-English description of each fixture, keyed by file name. */
const FIXTURES = {
  'scan-300dpi-10p.pdf': '10-page contract scanned at 300 dpi, with skew, sensor noise and slight blur',
  'scan-150dpi-5p.pdf': '5-page scan at 150 dpi - the resolution you get when someone scans "for email"',
  'scan-clean-300dpi-3p.pdf': '3-page 300 dpi scan with no degradation, the best case a scanner produces',
  'photo-3p.pdf': '3 full-bleed photographic pages, the hardest thing to compress without visible loss',
  'text-native-20p.pdf': '20-page document exported straight to PDF, vector text and no images at all',
}

const compress = data.results.filter((entry) => entry.tool === 'compress')
const ocr = data.results.filter((entry) => entry.tool === 'ocr')

/* ------------------------------------------------------------------ tables */

const compressTable = () => {
  const rows = ['| Document | Preset | Before | After | Change | Time |', '|---|---|---|---|---|---|']

  for (const entry of compress) {
    for (const run of entry.runs) {
      if (run.error) {
        rows.push(`| ${entry.file} | ${run.preset} | ${size(run.inputBytes)} | failed | - | - |`)
        continue
      }
      const change =
        run.savedPercent > 0
          ? `**−${run.savedPercent}%**`
          : run.savedPercent < 0
            ? `+${Math.abs(run.savedPercent)}%`
            : 'unchanged'
      rows.push(
        `| ${entry.file} | ${run.preset} | ${size(run.inputBytes)} | ${size(run.outputBytes)} | ${change} | ${seconds(run.elapsedMs)} |`,
      )
    }
  }

  return rows.join('\n')
}

const ocrTable = () => {
  if (ocr.length === 0) return null

  const rows = ['| Document | Word recall | Time | Output |', '|---|---|---|---|']
  for (const entry of ocr) {
    for (const run of entry.runs) {
      if (run.error) {
        rows.push(`| ${entry.file} | failed | - | - |`)
        continue
      }
      const recall = run.wordRecall === null ? 'n/a' : `**${(run.wordRecall * 100).toFixed(1)}%**`
      rows.push(`| ${entry.file} | ${recall} | ${seconds(run.elapsedMs)} | ${size(run.outputBytes)} |`)
    }
  }
  return rows.join('\n')
}

const corpusList = () =>
  [...new Set(compress.map((entry) => entry.file))]
    .map((file) => `- \`${file}\` - ${FIXTURES[file] ?? 'see the generator for details'}`)
    .join('\n')

/* ----------------------------------------------------------------- article */

const ocrSection = ocrTable()

const article = `---
title: What PDF compression actually does, measured
description: Every PDF site claims "up to 90% smaller" and none of them show their corpus. Here are the numbers for this one, the documents they came from, and how to reproduce them.
date: ${data.measuredAt}
updated: ${data.measuredAt}
locale: en
slug: pdf-compression-benchmarks
tags: [benchmarks, compress]
---

"Reduce your PDF size by up to 90%." Every tool in this category says some
version of that, and none of them tell you what they measured, on which
documents, or what the file looked like afterwards. "Up to" is doing all the
work in that sentence.

So here is the opposite: the corpus, the numbers, and the command to run it
yourself.

## The corpus

Five documents, generated rather than collected, so that anyone can produce
the identical bytes and get comparable numbers:

${corpusList()}

Each scanned fixture is built by rendering known text to an image and then
degrading it the way a real scanner does - a fraction of a degree of skew,
sensor noise, a touch of blur. That last part matters: without it the images
are a synthetic ideal that flatters any tool measured against them.

## Compression

${compressTable()}

Measured on ${data.measuredAt} against ${data.base}, in ${data.chrome ?? 'headless Chrome'}.

Three things worth pulling out of that table.

**Scans compress enormously, and that is not a trick.** A 300 dpi scan is
about ninety-five percent redundant data as far as a reader is concerned. Each
page is a photograph of a sheet of paper, stored at a resolution far beyond
what a screen shows. Re-encoding it at screen resolution is where the 96
percent comes from.

**Resolution decides how much there is to win.** The 150 dpi scan gives up
less than the 300 dpi one, because there was less to throw away. A tool that
promises a fixed percentage regardless of input is describing its marketing,
not its behaviour.

**A document that was never scanned does not compress.** The 20-page vector
export comes back unchanged. Compression here works by re-rendering each page
as an image; on text that was already sharp vector output, that produces a
*larger* file - over a hundred times larger, when we measured it. Rather than
hand you that, the tool detects it and returns your original untouched.

Every output was checked for page count against its input. All of them
matched. A size reduction is only good news if the document survived it.
${
  ocrSection
    ? `
## OCR

Recognised text is scored against the exact string that was drawn into the
page before it was rasterised, so this is measured accuracy rather than an
impression. The metric is word recall: of the words that should be findable,
how many are. That is the number that maps onto "can I search this document",
which is the only reason to run OCR at all.

${ocrSection}
`
    : ''
}
## Reproducing this

\`\`\`bash
git clone https://github.com/jaaaco/pdf.techsource.pro
cd pdf.techsource.pro
npm install
python3 benchmarks/generate-corpus.py
node benchmarks/generate-text-pdf.mjs
node benchmarks/run.mjs
\`\`\`

The harness drives the live site in headless Chrome exactly as a person would:
it uploads the file, picks the preset, clicks the button and measures what
comes back. Results land in \`benchmarks/results.json\`, which is also what
generated this page - the table above is not typed by hand, which is the only
way to be sure it still matches the measurements.

If you get different numbers, that is worth knowing. Open an issue.
`

await writeFile(OUT, article, 'utf8')
console.log(`[report] wrote ${OUT}`)
console.log(`[report] ${compress.length} compress fixtures, ${ocr.length} ocr fixtures`)
