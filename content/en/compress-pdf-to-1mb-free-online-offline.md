---
title: Getting a PDF under 1 MB without it leaving your laptop
description: Two presets, measured results on five real files, and the cases where re-compressing a PDF cannot reach 1 MB at all.
date: 2026-08-31
updated: 2026-08-31
locale: en
slug: compress-pdf-to-1mb-free-online-offline
tags: [compress, privacy, offline]
---

If the file you need under 1 MB is a scan or a photo PDF, either preset on this site will almost certainly get you there. Here is what actually happened on the benchmark files in this repository:

| File | Original | screen | ebook | Time |
|---|---|---|---|---|
| photo-3p.pdf | 4.21 MB (4306 KB) | 0.16 MB (162 KB) | 0.83 MB (850 KB) | 1.0s |
| scan-150dpi-5p.pdf | 0.62 MB (634 KB) | 0.08 MB (86 KB) | 0.24 MB (247 KB) | 1.0s |
| scan-300dpi-10p.pdf | 3.94 MB (4040 KB) | 0.17 MB (171 KB) | 0.47 MB (482 KB) | 2.0s |
| scan-clean-300dpi-3p.pdf | 0.93 MB (949 KB) | 0.05 MB (52 KB) | 0.14 MB (142 KB) | 1.0s |
| text-native-20p.pdf | 0.02 MB (16 KB) | 0.02 MB (16 KB) | 0.02 MB (16 KB) | 1.0s |

Four of those five are image-heavy, and all four cleared 1 MB on both presets. The fifth is the interesting one, and it gets its own section below.

## Which preset to pick

There is no size slider and no "compress to exactly 1 MB" field. You choose a preset, the file is re-rendered, and you look at the number that comes back.

Start with **ebook**. It is the middle ground and it keeps more detail. On the benchmark files it landed at 0.83 MB, 0.24 MB, 0.47 MB and 0.14 MB — all under the limit, with the photo file the closest call at 850 KB.

Drop to **screen** if ebook leaves you over budget, or if you want headroom for a mail attachment limit that also counts encoding overhead. Screen produced 162 KB, 86 KB, 171 KB and 52 KB on the same files. The reduction on the 300 dpi ten-page scan was 95.8% at screen against 88.1% at ebook — a real gap, and it shows on screen when you zoom in.

There is no print preset. If you need print quality, this is the wrong operation entirely; keep the original.

## Why offline is the point, not a bonus

"Free online PDF compressor" usually means: upload your file to a stranger's server, wait, download it back. For a passport scan, a signed contract, a medical result or a bank statement, that is the whole problem.

Nothing on this site uploads. The compression engine is Ghostscript compiled to WebAssembly, and it runs inside your browser tab, in a Web Worker, against an in-memory filesystem. Your PDF is read by JavaScript on your own machine and never becomes an HTTP request body.

You can verify this rather than trust it. Open the compress page, let it load, then turn off your Wi-Fi. Drop the file in. It still works. The one-to-two-second timings above are local CPU time, not a queue on someone else's hardware — there is no upload wait, because there is no upload.

Nothing persists either. Close the tab and the file is gone from memory. There is no account, no history and no "your files are deleted after 24 hours" promise you have to take on faith.

## The file that did not shrink

`text-native-20p.pdf` went in at 0.02 MB (16 KB) and came out at 0.02 MB (16 KB). Zero change, on both presets. That is not a bug.

Compression here works by re-rendering every page as an image and rebuilding the PDF around those images. On a scan, the page was already a photograph of paper, so re-rendering it at a lower resolution throws away data nobody was reading. On a PDF that was generated from text — a LaTeX paper, a Word export, an invoice from accounting software — the page is vector instructions and embedded fonts. Rasterising that makes the file *bigger*, not smaller, and blurrier at the same time. The tool leaves those alone deliberately.

So if your over-1 MB file is a text-native PDF, this tool cannot get you to 1 MB. Say what the file actually contains before you keep trying presets. Vector-text PDFs are usually large because of embedded images, embedded fonts, or sheer page count — and page count is the one you can act on: split the document and send the part that matters, which is a separate tool on this site and equally offline.

## The trade-off you are accepting

Compressed pages are images. Text inside them is no longer selectable or searchable, because it is no longer text.

If you need it back, run OCR afterwards. On the three scans in the benchmark, OCR recovered every word — 100% word recall on all three — taking 5.0s, 5.0s and 2.0s. That also runs in the browser, on the same no-upload basis.

## Doing it

1. Open the compress tool and let the page finish loading. Disconnect from the network now if you want to prove the point.
2. Drop the PDF in.
3. Pick ebook. Run it.
4. Check the output size. Over 1 MB? Run the original again at screen.
5. Download. If the text needs to stay searchable, run OCR on the result.
