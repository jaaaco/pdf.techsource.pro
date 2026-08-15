#!/usr/bin/env node
/**
 * Benchmark harness.
 *
 * Drives the real site in a real browser against the generated corpus and
 * records what actually happens: output size, wall-clock time, and for OCR
 * the recognised text compared against the known ground truth.
 *
 * The point is to publish measured numbers instead of plausible ones. Every
 * competitor's page says "reduce file size by up to 90%"; nobody shows their
 * corpus. This produces a table that can be reproduced by anyone who clones
 * the repo, which is also what keeps the generated pages on the right side of
 * the line between programmatic SEO and filler.
 *
 *   node benchmarks/run.mjs                      # everything, against prod
 *   node benchmarks/run.mjs --base=http://localhost:4180
 *   node benchmarks/run.mjs --only=compress      # one tool
 *   node benchmarks/run.mjs --file=scan-150dpi-5p
 *   node benchmarks/run.mjs --headful            # watch it work
 *
 * Writes benchmarks/results.json.
 */

import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CORPUS = join(ROOT, 'benchmarks/corpus')
const TRUTH = join(CORPUS, 'ground-truth')
const RESULTS = join(ROOT, 'benchmarks/results.json')

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const argOf = (name, fallback) => {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const hasFlag = (name) => process.argv.includes(`--${name}`)

const BASE = (argOf('base', 'https://pdf.techsource.pro')).replace(/\/$/, '')
const ONLY = argOf('only', null)
const ONLY_FILE = argOf('file', null)

/** Per-job ceiling. A 10-page 300 dpi scan is minutes of work, not seconds. */
const JOB_TIMEOUT_MS = Number(argOf('timeout', '900000'))

// 'printer' and 'prepress' were removed from the UI after the first run
// showed them returning the input byte-for-byte in 0.0s on every fixture.
const COMPRESS_PRESETS = ['screen', 'ebook']

const bytesToMb = (bytes) => Number((bytes / 1024 / 1024).toFixed(3))

/* ------------------------------------------------------------------ setup */

if (!existsSync(CHROME)) {
  console.error(`[bench] Chrome not found at ${CHROME} - set CHROME_PATH`)
  process.exit(1)
}
if (!existsSync(CORPUS)) {
  console.error('[bench] no corpus - run: python3 benchmarks/generate-corpus.py')
  process.exit(1)
}

const corpusFiles = (await readdir(CORPUS))
  .filter((name) => name.endsWith('.pdf'))
  .filter((name) => !ONLY_FILE || name.startsWith(ONLY_FILE))
  .sort()

if (corpusFiles.length === 0) {
  console.error('[bench] corpus is empty')
  process.exit(1)
}

const previous = existsSync(RESULTS) ? JSON.parse(await readFile(RESULTS, 'utf8')) : { results: [] }

/**
 * Refuse to mix origins, and check it before measuring anything rather than
 * after.
 *
 * This file is the source the published benchmark page is generated from, so
 * a local run merging into a production record silently republishes numbers
 * from a build nobody can reach. It has already happened once: a stale
 * localhost job finished after a production run and overwrote one row with a
 * pre-fix measurement. Same base, or start a fresh file.
 */
if (previous.base && previous.base !== BASE && !hasFlag('force')) {
  console.error(
    `[bench] results.json was measured against ${previous.base}, this run targets ${BASE}.\n` +
      '        Merging would mix origins in a published record. Re-run everything against one\n' +
      '        base, or pass --force if that is genuinely what you want.',
  )
  process.exit(1)
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: !hasFlag('headful'),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

const downloadDir = await mkdtemp(join(tmpdir(), 'pdf-bench-'))

/* ------------------------------------------------------------------ helpers */

const newPage = async (route) => {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1000 })

  await page.evaluateOnNewDocument(() => {
    // Consent banner would sit over the controls. Declining also keeps the
    // benchmark from firing analytics on every run.
    try {
      localStorage.setItem('pdf-toolkit-consent', 'denied')
      localStorage.setItem('consent', 'denied')
    } catch {
      /* storage disabled - the banner is dismissible anyway */
    }

    // Capture the result without going through Chrome's download machinery.
    // The app hands the finished file to the browser as a Blob via
    // URL.createObjectURL, so intercepting that is exact and synchronous -
    // no download directory to poll and no .crdownload race.
    const blobs = []
    Object.defineProperty(window, '__benchBlobs', { value: blobs })
    const original = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (source) => {
      if (source instanceof Blob) blobs.push(source)
      return original(source)
    }

    // Tee the worker's own error payload. The page runs it through
    // ErrorHandler before display, which replaces the real cause with a
    // guess ("the PDF might be corrupted"), so the on-screen text alone
    // cannot tell a broken fixture from a broken tool.
    const errors = []
    Object.defineProperty(window, '__benchWorkerErrors', { value: errors })
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args)
        this.addEventListener('message', (event) => {
          const data = event.data
          if (data && data.type === 'error') errors.push(String(data.payload?.message ?? data.payload))
        })
        this.addEventListener('error', (event) => errors.push(`worker crashed: ${event.message}`))
      }
    }
  })

  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 60000 })
  await dismissConsent(page)
  return page
}

const dismissConsent = async (page) => {
  const declined = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((element) =>
      /decline|odrzu/i.test(element.textContent ?? ''),
    )
    if (button) {
      button.click()
      return true
    }
    return false
  })
  if (declined) await new Promise((done) => setTimeout(done, 300))
}

const clickByText = async (page, pattern) => {
  const clicked = await page.evaluate((source) => {
    const regex = new RegExp(source, 'i')
    const button = [...document.querySelectorAll('button')].find(
      (element) => regex.test(element.textContent ?? '') && !element.disabled,
    )
    if (!button) return false
    button.click()
    return true
  }, pattern.source ?? pattern)
  if (!clicked) throw new Error(`no enabled button matching ${pattern}`)
}

/** MUI renders its Select as a listbox in a portal, so this is two clicks. */
const chooseSelectValue = async (page, value) => {
  await page.click('[role="combobox"]')
  await page.waitForSelector(`li[data-value="${value}"]`, { timeout: 10000 })
  await page.click(`li[data-value="${value}"]`)
  await new Promise((done) => setTimeout(done, 200))
}

const uploadFiles = async (page, paths) => {
  const input = await page.waitForSelector('input[type="file"]', { timeout: 20000 })
  await input.uploadFile(...paths)
  await new Promise((done) => setTimeout(done, 500))
}

/**
 * Waits for the result panel, triggers the download, and pulls the produced
 * Blob straight out of the page. Written to a temp file so pdfjs can read it
 * back for the OCR text comparison.
 *
 * Polls for two outcomes rather than one. The original version only watched
 * for success text, so a tool that failed in two seconds still burned the
 * whole 15-minute ceiling before the run gave up, and reported it as a
 * timeout. A failure is a result too - it just needs to be recorded as one.
 */
const captureResult = async (page, startedAt) => {
  const deadline = Date.now() + JOB_TIMEOUT_MS
  let ready = false

  while (Date.now() < deadline) {
    const state = await page.evaluate(() => ({
      // The download button is the unambiguous success signal. Matching on
      // body text caught the progress bar's own "Complete" stage label a
      // beat before the result panel existed.
      ready: [...document.querySelectorAll('button')].some(
        (element) => /download/i.test(element.textContent ?? '') && !element.disabled,
      ),
      failed: document.querySelector('.MuiAlert-standardError')?.textContent ?? null,
      raw: window.__benchWorkerErrors.at(-1) ?? null,
    }))

    if (state.failed) {
      const shown = state.failed.trim()
      throw new Error(state.raw ? `${shown} [worker: ${state.raw}]` : shown)
    }
    if (state.ready) {
      ready = true
      break
    }
    await new Promise((done) => setTimeout(done, 1000))
  }

  if (!ready) throw new Error(`no result and no error after ${JOB_TIMEOUT_MS}ms`)
  const elapsedMs = Date.now() - startedAt

  await clickByText(page, /download/)
  await page.waitForFunction(() => window.__benchBlobs.length > 0, {
    timeout: 60000,
    polling: 250,
  })

  const captured = await page.evaluate(async () => {
    const blob = window.__benchBlobs.at(-1)
    const buffer = new Uint8Array(await blob.arrayBuffer())
    let binary = ''
    // Chunked because String.fromCharCode blows the stack on large buffers.
    for (let offset = 0; offset < buffer.length; offset += 0x8000) {
      binary += String.fromCharCode(...buffer.subarray(offset, offset + 0x8000))
    }
    return { base64: btoa(binary), mimeType: blob.type }
  })

  const bytes = Buffer.from(captured.base64, 'base64')
  const outputPath = join(downloadDir, `out-${Date.now()}.pdf`)
  await writeFile(outputPath, bytes)

  // The OCR page offers three output formats but the worker only implements
  // two, so it can hand back a .txt while the UI says PDF. Recording the
  // blob's own type is how that shows up in the results instead of as a
  // confusing pdfjs parse error.
  return { elapsedMs, outputBytes: bytes.length, outputPath, outputMimeType: captured.mimeType }
}

/* -------------------------------------------------------------- extraction */

const openPdf = async (path) => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(await readFile(path))
  return pdfjs.getDocument({ data, useSystemFonts: true }).promise
}

/**
 * Page count of a file.
 *
 * Checked on both sides of every job, because a size reduction is only good
 * news if the pages survived it. A "compressor" that silently drops half the
 * document would otherwise post the best numbers in the table.
 */
const countPages = async (path) => {
  const doc = await openPdf(path)
  const pages = doc.numPages
  await doc.destroy()
  return pages
}

/** Pulls the text layer out of a PDF, which is how OCR output is scored. */
const extractText = async (path) => {
  const doc = await openPdf(path)
  const pages = []
  for (let number = 1; number <= doc.numPages; number += 1) {
    const page = await doc.getPage(number)
    const content = await page.getTextContent()
    pages.push(content.items.map((item) => item.str).join(' '))
  }
  await doc.destroy()
  return pages.join('\n')
}

const normalise = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Word-level recall against the ground truth: of the words that should be
 * there, how many are. Deliberately not edit distance - recall is the number
 * that maps onto "can I find this document by searching for a word in it",
 * which is the only reason anyone runs OCR.
 */
const wordRecall = (truth, actual) => {
  const expected = normalise(truth).split(' ').filter(Boolean)
  const got = new Map()
  for (const word of normalise(actual).split(' ').filter(Boolean)) {
    got.set(word, (got.get(word) ?? 0) + 1)
  }
  let found = 0
  for (const word of expected) {
    const count = got.get(word) ?? 0
    if (count > 0) {
      found += 1
      got.set(word, count - 1)
    }
  }
  return expected.length === 0 ? null : Number((found / expected.length).toFixed(4))
}

/* ------------------------------------------------------------------- tools */

const benchmarkCompress = async (file) => {
  const inputPath = join(CORPUS, file)
  const { size: inputBytes } = await stat(inputPath)
  const inputPages = await countPages(inputPath)
  const runs = []

  for (const preset of COMPRESS_PRESETS) {
    const page = await newPage('/compress')
    try {
      await uploadFiles(page, [inputPath])
      await chooseSelectValue(page, preset)
      const startedAt = Date.now()
      await clickByText(page, /compress \d+ file/)
      const { elapsedMs, outputBytes, outputPath } = await captureResult(page, startedAt)
      const outputPages = await countPages(outputPath).catch(() => null)

      const savedPercent = Number((100 * (1 - outputBytes / inputBytes)).toFixed(1))
      runs.push({
        preset,
        inputBytes,
        outputBytes,
        inputPages,
        outputPages,
        pagesLost: outputPages === null ? null : inputPages - outputPages,
        ratio: Number((outputBytes / inputBytes).toFixed(4)),
        savedPercent,
        elapsedMs,
      })

      const pageNote =
        outputPages === null
          ? '  UNREADABLE OUTPUT'
          : outputPages === inputPages
            ? ''
            : `  PAGES ${inputPages}->${outputPages}`
      console.log(
        `    ${preset.padEnd(8)} ${bytesToMb(inputBytes)} MB -> ${bytesToMb(outputBytes)} MB ` +
          `(${savedPercent > 0 ? '-' : '+'}${Math.abs(savedPercent)}%) ` +
          `${(elapsedMs / 1000).toFixed(1)}s${pageNote}`,
      )
    } catch (error) {
      runs.push({ preset, inputBytes, inputPages, error: String(error.message ?? error) })
      console.log(`    ${preset.padEnd(8)} FAILED: ${error.message ?? error}`)
    } finally {
      await page.close()
    }
  }

  return { tool: 'compress', file, runs }
}

const benchmarkOcr = async (file) => {
  const inputPath = join(CORPUS, file)
  const truthPath = join(TRUTH, file.replace(/\.pdf$/, '.txt'))
  if (!existsSync(truthPath)) return null

  const { size: inputBytes } = await stat(inputPath)
  const inputPages = await countPages(inputPath)
  const page = await newPage('/ocr')

  try {
    await uploadFiles(page, [inputPath])
    const startedAt = Date.now()
    await clickByText(page, /start ocr/)
    const { elapsedMs, outputBytes, outputPath, outputMimeType } = await captureResult(
      page,
      startedAt,
    )

    // Same reasoning as compress: an OCR pass that quietly loses pages would
    // otherwise post a respectable recall number on the pages it kept.
    const outputPages = await countPages(outputPath).catch(() => null)
    const truth = await readFile(truthPath, 'utf8')
    const actual = await extractText(outputPath).catch(() => '')
    const recall = wordRecall(truth, actual)

    const pageNote =
      outputPages === null
        ? '  UNREADABLE OUTPUT'
        : outputPages === inputPages
          ? ''
          : `  PAGES ${inputPages}->${outputPages}`
    console.log(
      `    ocr      ${bytesToMb(inputBytes)} MB -> ${bytesToMb(outputBytes)} MB, ` +
        `word recall ${recall === null ? 'n/a' : `${(recall * 100).toFixed(1)}%`}, ` +
        `${(elapsedMs / 1000).toFixed(1)}s${pageNote}`,
    )

    return {
      tool: 'ocr',
      file,
      runs: [
        {
          inputBytes,
          outputBytes,
          inputPages,
          outputPages,
          pagesLost: outputPages === null ? null : inputPages - outputPages,
          outputMimeType,
          elapsedMs,
          wordRecall: recall,
        },
      ],
    }
  } catch (error) {
    console.log(`    ocr      FAILED: ${error.message ?? error}`)
    return {
      tool: 'ocr',
      file,
      runs: [{ inputBytes, inputPages, error: String(error.message ?? error) }],
    }
  } finally {
    await page.close()
  }
}

/* -------------------------------------------------------------------- main */

console.log(`[bench] ${BASE}`)
console.log(`[bench] corpus: ${corpusFiles.join(', ')}\n`)

const results = []

for (const file of corpusFiles) {
  console.log(`  ${file}`)
  if (!ONLY || ONLY === 'compress') results.push(await benchmarkCompress(file))
  if (!ONLY || ONLY === 'ocr') {
    const ocr = await benchmarkOcr(file)
    if (ocr) results.push(ocr)
  }
  console.log('')
}

// Read before closing; the handle is useless afterwards.
const chromeVersion = await browser.version().catch(() => null)
await browser.close()
await rm(downloadDir, { recursive: true, force: true })

/**
 * Merge rather than overwrite.
 *
 * A `--only=ocr` run used to replace the whole file, silently destroying the
 * recorded compress numbers - which is also what the published benchmark page
 * is generated from. Entries are keyed by tool and file, so a partial run
 * updates exactly what it measured and leaves the rest of the record alone.
 */
const merged = new Map(
  (previous.results ?? []).map((entry) => [`${entry.tool}:${entry.file}`, entry]),
)
for (const entry of results) merged.set(`${entry.tool}:${entry.file}`, entry)

await mkdir(dirname(RESULTS), { recursive: true })
await writeFile(
  RESULTS,
  `${JSON.stringify(
    {
      // BENCH_DATE lets the caller stamp the run: benchmarks are compared
      // across runs and a wrong clock makes the history meaningless.
      measuredAt: process.env.BENCH_DATE ?? new Date().toISOString().slice(0, 10),
      base: BASE,
      chrome: chromeVersion,
      results: [...merged.values()].sort((a, b) =>
        `${a.tool}:${a.file}`.localeCompare(`${b.tool}:${b.file}`),
      ),
    },
    null,
    2,
  )}\n`,
  'utf8',
)

console.log(`[bench] wrote ${RESULTS}`)
