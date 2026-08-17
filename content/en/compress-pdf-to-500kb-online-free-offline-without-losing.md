---
title: Hitting a 500 KB PDF Limit Without Uploading
description: Measured results from compressing five test PDFs in the browser, and which ones land under 500 KB. Nothing leaves your machine at any point.
date: 2026-08-17
updated: 2026-08-17
locale: en
slug: compress-pdf-to-500kb-online-free-offline-without-losing
tags: [compress, privacy, offline]
---

If your file is a scan or a photo-heavy PDF, the screen preset will almost certainly clear 500 KB. In our benchmark set, four scanned or photographic files all landed between 52 KB and 171 KB on screen, from starting sizes of 0.62 MB to 4.21 MB. That happened in the browser tab, in one to two seconds, with no upload.

The honest caveat first: nothing here is lossless. Compression on this site re-renders every page as an image at a lower resolution. That is why the numbers are large. It is also why a PDF that was already vector text comes back the same size — there is nothing to squeeze.

## The measurements

Five files, both presets, run from the repository benchmark:

| File | Original | screen | ebook | Time |
|---|---|---|---|---|
| photo-3p.pdf | 4.21 MB (4306 KB) | 0.16 MB (162 KB) | 0.83 MB (850 KB) | 1.0s |
| scan-150dpi-5p.pdf | 0.62 MB (634 KB) | 0.08 MB (86 KB) | 0.24 MB (247 KB) | 1.0s |
| scan-300dpi-10p.pdf | 3.94 MB (4040 KB) | 0.17 MB (171 KB) | 0.47 MB (482 KB) | 2.0s |
| scan-clean-300dpi-3p.pdf | 0.93 MB (949 KB) | 0.05 MB (52 KB) | 0.14 MB (142 KB) | 1.0s |
| text-native-20p.pdf | 0.02 MB (16 KB) | 0.02 MB (16 KB) | 0.02 MB (16 KB) | 1.0s |

Page counts were unchanged in every run: 3 → 3, 5 → 5, 10 → 10, 3 → 3, 20 → 20.

Seven of the eight preset runs on the four image-based files finished under 500 KB. The one that missed was photo-3p.pdf on ebook, at 0.83 MB (850 KB). The same file on screen was 0.16 MB (162 KB).

## Which preset to pick

There are two: **screen** and **ebook**. There is no print preset.

Start with ebook. It reduced scan-300dpi-10p.pdf from 3.94 MB (4040 KB) to 0.47 MB (482 KB) — under a 500 KB cap, with visibly more detail retained than screen. If the result is still over your limit, switch to screen and run again. The re-run costs a second or two.

If your file is photographic rather than a document scan, expect to need screen. Ebook left photo-3p.pdf at 0.83 MB (850 KB), well over the cap.

## Nothing leaves your machine

The processing engine is Ghostscript compiled to WebAssembly. It loads into the page once, then runs inside your browser tab against an in-memory filesystem. Your PDF is read from disk by the file picker and never sent anywhere.

You do not have to take that on faith. Two checks, in order of effort:

1. Open your browser's Network tab, then compress a file. You will see the WASM engine load. You will not see a request carrying your document.
2. Load the page once, then turn off your Wi-Fi and compress. It still works. A tool that uploads cannot do that.

The second check is the stronger one, and it is also the practical answer to "offline". Once the page is cached, the compressor runs with no connection at all. Nothing is queued for later upload — there is no server component to queue it to.

## What compression costs you

Re-rendering to an image throws away the text layer. After compression, a PDF that had selectable, searchable text will not have it anymore. On a scan, this is a non-issue, since scans rarely had a text layer to begin with. On a text document it matters, and it is a reason not to compress that document at all.

If you need the file both small and searchable, compress first, then run the OCR tool on the result. In our benchmark, OCR recovered every word from all three scans — 100% word recall on scan-150dpi-5p.pdf and scan-300dpi-10p.pdf in 5.0 seconds each, and on scan-clean-300dpi-3p.pdf in 2.0 seconds.

## When this tool cannot help you

If your PDF is native vector text — exported from Word, LaTeX, a design tool, or a form generator — compression here will return it unchanged. text-native-20p.pdf went in at 0.02 MB (16 KB) and came out at 0.02 MB (16 KB) on both presets. That is the tool working correctly. There is no image data to downsample, and rasterising clean text would make the file both larger and worse.

Such files are usually already tiny. If yours is a vector-text PDF that is somehow over 500 KB, the weight is likely embedded fonts or attached images, and a different approach is needed — re-export from the source application with subsetted fonts, or split the document and send the part that matters.

## The steps

1. Open the compress tool. Drop the PDF in, or click to pick it.
2. Choose ebook.
3. Run it. On files of this size, expect one to two seconds.
4. Check the reported output size. Under your cap? Download it.
5. Over your cap? Switch to screen and run again on the original.
6. Need the text searchable? Run the compressed file through OCR.
