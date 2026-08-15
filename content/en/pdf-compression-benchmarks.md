---
title: What PDF compression actually does, measured
description: Every PDF site claims "up to 90% smaller" and none of them show their corpus. Here are the numbers for this one, the documents they came from, and how to reproduce them.
date: 2026-08-15
updated: 2026-08-15
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

- `photo-3p.pdf` - 3 full-bleed photographic pages, the hardest thing to compress without visible loss
- `scan-150dpi-5p.pdf` - 5-page scan at 150 dpi - the resolution you get when someone scans "for email"
- `scan-300dpi-10p.pdf` - 10-page contract scanned at 300 dpi, with skew, sensor noise and slight blur
- `scan-clean-300dpi-3p.pdf` - 3-page 300 dpi scan with no degradation, the best case a scanner produces
- `text-native-20p.pdf` - 20-page document exported straight to PDF, vector text and no images at all

Each scanned fixture is built by rendering known text to an image and then
degrading it the way a real scanner does - a fraction of a degree of skew,
sensor noise, a touch of blur. That last part matters: without it the images
are a synthetic ideal that flatters any tool measured against them.

## Compression

| Document | Preset | Before | After | Change | Time |
|---|---|---|---|---|---|
| photo-3p.pdf | screen | 4.21 MB | 162 KB | **−96.2%** | 1.0 s |
| photo-3p.pdf | ebook | 4.21 MB | 850 KB | **−80.3%** | 1.0 s |
| scan-150dpi-5p.pdf | screen | 634 KB | 86 KB | **−86.5%** | 1.0 s |
| scan-150dpi-5p.pdf | ebook | 634 KB | 247 KB | **−61.1%** | 1.0 s |
| scan-300dpi-10p.pdf | screen | 3.94 MB | 171 KB | **−95.8%** | 2.0 s |
| scan-300dpi-10p.pdf | ebook | 3.94 MB | 482 KB | **−88.1%** | 2.0 s |
| scan-clean-300dpi-3p.pdf | screen | 949 KB | 52 KB | **−94.5%** | 1.0 s |
| scan-clean-300dpi-3p.pdf | ebook | 949 KB | 142 KB | **−85%** | 1.0 s |
| text-native-20p.pdf | screen | 16 KB | 16 KB | unchanged | 1.0 s |
| text-native-20p.pdf | ebook | 16 KB | 16 KB | unchanged | 1.0 s |

Measured on 2026-08-15 against https://pdf.techsource.pro, in Chrome/151.0.7922.138.

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

## OCR

Recognised text is scored against the exact string that was drawn into the
page before it was rasterised, so this is measured accuracy rather than an
impression. The metric is word recall: of the words that should be findable,
how many are. That is the number that maps onto "can I search this document",
which is the only reason to run OCR at all.

| Document | Word recall | Time | Output |
|---|---|---|---|
| scan-150dpi-5p.pdf | **100.0%** | 5.0 s | 667 KB |
| scan-300dpi-10p.pdf | **100.0%** | 5.0 s | 4.00 MB |
| scan-clean-300dpi-3p.pdf | **100.0%** | 2.0 s | 972 KB |

## Reproducing this

```bash
git clone https://github.com/jaaaco/pdf.techsource.pro
cd pdf.techsource.pro
npm install
python3 benchmarks/generate-corpus.py
node benchmarks/generate-text-pdf.mjs
node benchmarks/run.mjs
```

The harness drives the live site in headless Chrome exactly as a person would:
it uploads the file, picks the preset, clicks the button and measures what
comes back. Results land in `benchmarks/results.json`, which is also what
generated this page - the table above is not typed by hand, which is the only
way to be sure it still matches the measurements.

If you get different numbers, that is worth knowing. Open an issue.
