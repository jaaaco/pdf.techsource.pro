#!/usr/bin/env node
/**
 * Text-native fixture for the corpus.
 *
 * Every other corpus file is raster, which is what compression is designed
 * to attack. This one is vector text with no images at all - the shape a PDF
 * has when it was exported from Word rather than scanned. It exists to keep
 * the benchmark honest: a compressor that only ever reports huge savings is
 * being fed only the case it is good at.
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'benchmarks/corpus/text-native-20p.pdf')

const PARAGRAPH =
  'The customer shall pay each invoice within thirty days of the invoice date. ' +
  'Amounts not paid when due shall bear interest at the statutory rate applicable ' +
  'to commercial transactions, accruing daily from the due date until payment.'

const wrap = (text, font, size, maxWidth) => {
  const lines = []
  let line = ''
  for (const word of text.split(' ')) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

const doc = await PDFDocument.create()
const body = await doc.embedFont(StandardFonts.TimesRoman)
const heading = await doc.embedFont(StandardFonts.TimesRomanBold)

for (let pageNumber = 0; pageNumber < 20; pageNumber += 1) {
  const page = doc.addPage([595.28, 841.89])
  const margin = 64
  const width = page.getWidth() - margin * 2
  let y = page.getHeight() - margin

  page.drawText(`Section ${pageNumber + 1}`, { x: margin, y, size: 18, font: heading })
  y -= 34

  for (let block = 0; block < 6; block += 1) {
    for (const line of wrap(PARAGRAPH, body, 11, width)) {
      page.drawText(line, { x: margin, y, size: 11, font: body, color: rgb(0.1, 0.1, 0.1) })
      y -= 16
    }
    y -= 10
  }
}

const bytes = await doc.save()
await mkdir(dirname(OUT), { recursive: true })
await writeFile(OUT, bytes)
console.log(`  text-native-20p.pdf  20p vector  ${(bytes.length / 1024).toFixed(0)} KB`)
