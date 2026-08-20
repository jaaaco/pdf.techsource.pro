---
title: The 50 KB target: what compresses and what won't
description: Measured results from a browser-only PDF compressor, including which files reached 50 KB, which stopped above it, and which came back unchanged.
date: 2026-08-20
updated: 2026-08-20
locale: en
slug: compress-pdf-to-50kb-offline-online-free
tags: [compress, privacy, benchmarks]
---

## Can a PDF actually reach 50 KB?

Sometimes. In our benchmark set, one file landed there: a clean 300 dpi scan of 3 pages went from 949 KB to 52 KB on the screen preset, in 1.0s. That is the shape of document that gets close — few pages, flat scanned text, no photographs.

Everything else in the set stopped higher. A 5-page 150 dpi scan came out at 86 KB. A 10-page 300 dpi scan came out at 171 KB. A 3-page photo PDF came out at 162 KB even though it started at 4306 KB, because photographic detail survives compression better than a page of black text on white.

And a 20-page vector text PDF came back at 16 KB, exactly what it went in at. It was already under 50 KB, and there was nothing for this tool to do.

## The measured numbers

| File | Preset | Before | After | Change | Time |
|---|---|---|---|---|---|
| scan-clean-300dpi-3p | screen | 949 KB | 52 KB | −94.5% | 1.0s |
| scan-clean-300dpi-3p | ebook | 949 KB | 142 KB | −85% | 1.0s |
| scan-150dpi-5p | screen | 634 KB | 86 KB | −86.5% | 1.0s |
| scan-150dpi-5p | ebook | 634 KB | 247 KB | −61.1% | 1.0s |
| scan-300dpi-10p | screen | 4040 KB | 171 KB | −95.8% | 2.0s |
| scan-300dpi-10p | ebook | 4040 KB | 482 KB | −88.1% | 2.0s |
| photo-3p | screen | 4306 KB | 162 KB | −96.2% | 1.0s |
| photo-3p | ebook | 4306 KB | 850 KB | −80.3% | 1.0s |
| text-native-20p | screen or ebook | 16 KB | 16 KB | +0% | 1.0s |

If 50 KB is a hard limit, use the screen preset. The ebook preset never came close on any file in this set.

## Why "offline" and "online" are both true here

The tool is a web page, so you reach it with a browser. But the file never leaves your machine. Compression runs in a WebAssembly engine inside a Web Worker on your own CPU. There is no upload step, no server-side queue, no temporary copy on someone else's disk to worry about deleting later.

Once the page has loaded, you can switch off networking entirely and it keeps working. Free, no account, no watermark, no daily cap.

This matters more than usual for the 50 KB case. Files with a hard kilobyte limit are almost always going into a government portal, a bank form, a visa application or a job application — passport scans, payslips, signed contracts. Those are exactly the documents you should not hand to an unknown compression service in exchange for a smaller file.

## What determines whether you hit the target

Two things, roughly in this order:

**What the pages contain.** Scanned text compresses hardest. The clean 300 dpi scan lost 94.5% of its size. The photo PDF lost 96.2% of its size and still ended at 162 KB, because it started ten times bigger and photographs hold onto detail.

**How many pages there are.** The 10-page scan finished at 171 KB — a bigger percentage cut than the 3-page scan, but a larger file, because every page costs something.

## If screen preset isn't enough

Split first, then compress each part. Fewer pages per file is the most reliable way to push a document under a fixed limit, and the split tool is on the same site and works the same way — locally, no upload.

Failing that, drop the pages you don't actually need to submit. A 12-page bank statement where the form only wants page 1 is not a compression problem.

## When this tool cannot help you

If your PDF was generated as vector text — exported from Word, LaTeX, an invoicing system — and it is still above 50 KB, compression here will not shrink it. Compression on this site works by re-rendering each page as an image. On a scan that is a huge win. On vector text it produces a file that is no smaller and often looks worse, so the tool returns the original unchanged instead. That is the 16 KB → 16 KB row in the table, and it is deliberate.

For that case, go back to whatever produced the PDF and export it again with images downsampled or removed. That is where the bytes are.

## One consequence to plan for

Compressing a scan turns its pages into images. If the file needs to stay text-searchable, run OCR. On the three scanned fixtures, OCR recovered 100.0% of words: 2.0s for the 3-page clean scan, 5.0s each for the 5-page and 10-page scans. Those runs were measured on the original scans, not on compressed output, so treat OCR as something you do to get text out — not as a guarantee about what survives a screen-preset pass.

## The steps

1. Open the compress tool.
2. Drop the PDF in. Nothing uploads.
3. Choose the screen preset.
4. Check the resulting size against your limit.
5. Still over? Split the file and compress each part.
