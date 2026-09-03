---
title: Compressing to 100 KB with no upload step
description: Whether a PDF reaches 100 KB depends on what is inside it. Measured results for scans, photo pages and vector text, all compressed in the browser.
date: 2026-09-03
updated: 2026-09-03
locale: en
slug: compress-pdf-to-100kb-free-offline
tags: [compress, privacy, offline]
---

Some PDFs reach 100 KB. Some do not. The difference is what the file is made of, not which tool you use, and you can tell which case you have before you start.

Scanned documents compress hard, because compression here re-renders every page as an image at a lower resolution. Photo-heavy pages compress hard too, but they start much bigger, so they can land above 100 KB anyway. PDFs that were already vector text come back byte-for-byte unchanged — there is nothing to re-render away.

## Measured results

Five files from the benchmark in this repository, run with the **screen** preset (the smallest of the two):

| File | Before | After | Change | Under 100 KB? |
|---|---|---|---|---|
| scan-clean-300dpi-3p.pdf | 949 KB | 52 KB | -94.5% | yes |
| scan-150dpi-5p.pdf | 634 KB | 86 KB | -86.5% | yes |
| scan-300dpi-10p.pdf | 4040 KB | 171 KB | -95.8% | no |
| photo-3p.pdf | 4306 KB | 162 KB | -96.2% | no |
| text-native-20p.pdf | 16 KB | 16 KB | +0% | already was |

Every run finished in 1.0s, except the 10-page scan at 2.0s.

The pattern: a 3-page clean scan dropped to 52 KB, a 5-page scan to 86 KB, a 10-page scan to 171 KB. Page count sets the floor. Ten scanned pages did not fit under 100 KB even after a 95.8% cut.

The 20-page text PDF is the honest failure case. It went in at 16 KB and came out at 16 KB, +0%. That is correct behaviour — it was already vector text, already small, and re-rendering it would have made it worse in quality and no better in size.

## The ebook preset will not get you there

The second preset trades size for fidelity. Same files:

| File | Before | After (ebook) | Change |
|---|---|---|---|
| scan-clean-300dpi-3p.pdf | 949 KB | 142 KB | -85% |
| scan-150dpi-5p.pdf | 634 KB | 247 KB | -61.1% |
| scan-300dpi-10p.pdf | 4040 KB | 482 KB | -88.1% |
| photo-3p.pdf | 4306 KB | 850 KB | -80.3% |

None of these reach 100 KB. If 100 KB is a hard limit imposed on you by an upload form, use screen. Ebook is for when the limit is looser and the page still has to be readable at full zoom. There is no third preset — no print option — so screen is the floor.

## Why nothing is uploaded

The compressor is Ghostscript compiled to WebAssembly. It runs in a Web Worker inside your browser tab, reads the file from an in-memory filesystem, and writes the result back to the same place. Your PDF is never sent anywhere. There is no server that receives it, so there is no server-side copy to retain, log, or leak.

This is checkable rather than a promise. Open the network tab, drop a file in, compress it. You will see the WASM binary load once and then nothing. Or turn off wifi after the page has loaded and compress with the machine fully disconnected — it works, because there is no step that needs a network.

Nothing persists after you close the tab either. The virtual filesystem lives in memory only.

## Steps

1. Open the compress tool.
2. Drop the PDF in. It stays on your disk; the browser reads it locally.
3. Pick **screen**.
4. Run it. Expect a second or two for files in this size range.
5. Check the resulting size before you download. If it is over your limit, see below.

## If screen still overshoots 100 KB

Compression has already done what it can. What is left is reducing what goes in:

- **Send fewer pages.** Split the document and compress the part that actually has to be submitted. The 3-page scan hit 52 KB where the 10-page scan hit 171 KB.
- **Re-scan at a lower resolution** if you still have the original. The 150 dpi 5-page scan started at 634 KB; the 300 dpi 10-page scan started at 4040 KB.
- **Accept that photo pages are expensive.** The 3-page photo file dropped 96.2% and still came out at 162 KB. Three photographic pages under 100 KB is a stretch regardless of tool.

## If the compressed file needs to stay searchable

Re-rendering pages as images removes any text layer. If the recipient needs to search or copy text, run OCR on the compressed file afterwards to put one back. On the three scans in the benchmark, OCR word recall was 100.0% — 5.0s for the 150 dpi 5-page scan, 5.0s for the 300 dpi 10-page scan, 2.0s for the clean 3-page scan. OCR runs in the browser too, on the same no-upload path.

Adding a text layer adds bytes, so check the size again after OCR if you are close to the limit.
