---
title: Getting a PDF under 100 KB without uploading it
description: Measured results from five test files — which ones reach 100 KB on the screen preset, which stop short, and why nothing leaves the browser.
date: 2026-08-15
updated: 2026-08-15
locale: en
slug: compress-pdf-to-100kb-free-offline-without-losing
tags: [compress, privacy, offline]
---

Whether a PDF reaches 100 KB depends almost entirely on what is inside it. Here is what the screen preset did to five test files in this project's benchmark suite:

| File | Before | After (screen) | Change | Under 100 KB? |
|---|---|---|---|---|
| scan-clean-300dpi-3p.pdf | 0.93 MB | 0.05 MB | −94.5% | yes |
| scan-150dpi-5p.pdf | 0.62 MB | 0.08 MB | −86.5% | yes |
| photo-3p.pdf | 4.21 MB | 0.16 MB | −96.2% | no |
| scan-300dpi-10p.pdf | 3.94 MB | 0.17 MB | −95.8% | no |
| text-native-20p.pdf | 16 KB | 16 KB | +0% | it started under it |

Two of the four image-heavy files landed under 100 KB. Two landed at 160 KB and 170 KB — a 96% reduction that still misses the target, because page count and photographic detail set a floor the preset cannot go below. The native text file came back byte-for-byte the same size, which is the correct outcome and explained below.

Each run took 1.0 second, except the 10-page scan at 2.0 seconds.

## Why scans collapse and text PDFs do not

Compression here works by re-rendering every page as an image and rebuilding the PDF around those images. For a scan, that is exactly the right move: a scan is already a picture of a page, usually stored at a resolution far higher than screen reading needs. Re-rendering it at a lower resolution throws away detail nobody was going to look at.

A PDF exported from a word processor is not a picture. It is drawing instructions plus an embedded font. Those instructions are already tiny — 16 KB for 20 pages, in the file above — and turning them into images would make the file *bigger* and the text unselectable. So the tool leaves them alone. If your PDF is already vector text and you were hoping to shrink it, there is nothing to shrink. That is not a limitation to work around; it is the file telling you it is done.

The quick test: open the PDF and try to select a sentence with your cursor. If the text highlights word by word, it is native text and compression will not help. If you can only draw a box over it, it is a scan and compression will.

## What "without losing" actually means

You lose image resolution. That is the whole mechanism. On the screen preset the result is sized for reading on a display, not for reprinting at full quality. The ebook preset keeps more detail:

| File | screen | ebook |
|---|---|---|
| scan-clean-300dpi-3p.pdf | 0.05 MB (−94.5%) | 0.14 MB (−85%) |
| scan-150dpi-5p.pdf | 0.08 MB (−86.5%) | 0.24 MB (−61.1%) |
| scan-300dpi-10p.pdf | 0.17 MB (−95.8%) | 0.47 MB (−88.1%) |
| photo-3p.pdf | 0.16 MB (−96.2%) | 0.83 MB (−80.3%) |

None of the ebook outputs reach 100 KB. If 100 KB is a hard requirement from a portal or a form, screen is the only preset worth trying. There is no third, higher-quality preset, and no resolution slider.

What you do not lose is page count — every file came out with the same number of pages it went in with — and, on a scan, you were never going to lose selectable text, because a scan has none to begin with.

If you need the words as text rather than as pixels, run OCR instead of, or before, compressing. The same benchmark measures 100.0% word recall on all three scan files, taking 5.0 seconds for the 5-page and 10-page scans and 2.0 seconds for the clean 3-page one.

## When the screen preset is not enough

Two options remain, both honest about their cost:

- **Send fewer pages.** The 10-page scan compressed to 170 KB. Splitting it and sending only the pages that matter cuts the size roughly in proportion — the benchmark does not measure the split output directly, but the arithmetic is not subtle. Use the split tool first, then compress.
- **Accept the number you got.** A 3.94 MB file at 170 KB will clear almost every real upload limit. The 100 KB figure in a form's help text is often a suggestion, not a rejection threshold. Try the upload before spending an hour chasing the last 70 KB.

## Nothing is uploaded, and that is checkable

The compression runs in a Web Worker in your browser using a WebAssembly build of the rendering engine. Your file is read into memory, processed, and handed back as a download. There is no server round trip, no queue, no temporary copy on someone else's disk, and no retention policy to read, because there is nothing to retain.

You can verify this rather than trust it. Load the page, turn off your network connection, and compress a file. It works. Or open your browser's developer tools, watch the Network tab during a run, and see that no request carries your document. For medical records, contracts, or ID scans, that difference matters more than the last few kilobytes.

## Steps

1. Open the compress tool and drop your PDF in.
2. Pick **screen** if you have a size target, **ebook** if you care about looking at the result.
3. Wait — a second or two for the files above.
4. Check the output size. If it missed your target, split the document and compress the part you actually need to send.
