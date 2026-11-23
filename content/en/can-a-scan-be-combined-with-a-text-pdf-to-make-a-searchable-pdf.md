---
title: Making a scan searchable with a text PDF instead of OCR
description: A scan can borrow the text layer from a matching text PDF, but only by overlaying pages, not merging them. Here is when that works and what to do when it does not.
date: 2026-11-23
updated: 2026-11-23
locale: en
slug: can-a-scan-be-combined-with-a-text-pdf-to-make-a-searchable-pdf
tags: [ocr, privacy, merge]
---

## Short answer

Yes, but only in one specific situation, and not with a normal merge.

If the text PDF is the same document as the scan, page for page, you can stack each text page underneath the matching scanned page. The scan stays visible and the text underneath stays searchable. No OCR is involved.

If the two files are different documents, combining them does nothing for the scan. A merge puts pages one after another. The text pages stay searchable and the scanned pages stay pictures.

## Why a merge does not do it

A scanned page is an image. Search needs a text layer, which is a set of characters with positions on the page. A text PDF has that layer and a scan does not.

Merging two PDFs appends pages. It never moves content from one page onto another, so the text layer cannot reach the scanned pages. This is true of the merge tool on this site and of every other merge tool.

What you need is an overlay: two pages drawn on top of each other to make one page.

## When an overlay works

It works when you have both versions of the same document. The usual case is a contract you exported from a word processor, printed, signed and scanned back in. You want the signed scan to be what people see, and the original text to be what search finds.

Three conditions matter:

- **Same pages in the same order.** Page 4 of the text PDF must be page 4 of the scan.
- **Same page size.** If the scanner saved a slightly different size, the layers will not line up.
- **The scan covers the whole page.** The text sits behind the image. If the image leaves a margin uncovered, the text shows through there.

Even when all three hold, alignment is approximate. Paper goes through a scanner slightly skewed or shifted. Search will still find the right page, but the highlight may sit a little off the visible words.

There is one more trade-off. The hidden text is the original text, not what is on the paper. Handwritten changes and signatures on the scan are not in the text layer.

## How to do it without uploading anything

This site cannot overlay pages. It compresses, merges, splits and runs OCR. Two free command-line tools do overlays, and both run on your own machine, so the files stay local.

With qpdf:

```
qpdf scan.pdf --underlay text.pdf -- searchable.pdf
```

With pdftk:

```
pdftk scan.pdf multibackground text.pdf output searchable.pdf
```

Both place each page of `text.pdf` behind the matching page of `scan.pdf`. Open the result, search for a word you know is on page 2, and check that it is found.

If the scan and the text PDF have different page counts, split them into matching ranges first. The split tool here does that in the browser.

## If the reason to avoid OCR is privacy

Many people ask this question because OCR usually means sending the document to a server. That is a fair reason to look for another route.

OCR on this site does not upload the file. The engine is Tesseract compiled to WebAssembly, and it runs in your browser tab. The document is read from your disk into memory, processed there, and offered back as a download.

So if you do not have a matching text PDF, local OCR is the realistic option. It reads the page images and writes the recognised text back into the PDF.

## How well the local OCR does

These are the results from the public benchmark in the repository. Each file was run twice.

| Test file | Pages | Word recall | Time |
|---|---|---|---|
| scan-150dpi-5p.pdf | 5 | 100.0% | 5.0s and 3.0s |
| scan-300dpi-10p.pdf | 10 | 100.0% | 5.0s and 5.0s |
| scan-clean-300dpi-3p.pdf | 3 | 100.0% | 2.0s and 2.0s |

Read these numbers for what they are. The test files are clean, printed pages. Handwriting, heavy skew, faded photocopies and unusual fonts will do worse, and there is no measurement here for those.

Word recall means the words on the page were found. It says nothing about a signature or a stamp, which OCR does not turn into text.

## Overlay or OCR: which to pick

- **You have the original text PDF of the same document.** Use the overlay. The text is exact, because it never went through recognition.
- **You only have the scan.** Use OCR. There is no text to borrow.
- **The text PDF is a different document.** Merge them if you want one file, then run OCR so the scanned pages become searchable too.

## A note on compression order

Scans are large, so you may want to shrink the file as well. Compression here re-renders each page as an image. On the 10-page 300 dpi test scan, the screen preset took it from 3.94 MB (4040 KB) to 0.17 MB (171 KB), and the ebook preset to 0.47 MB (482 KB).

Because pages are re-rendered as images, do not count on a text layer surviving compression. Compress the scan first, then add the text layer by overlay or OCR as the last step. Check the result by searching it before you send it anywhere.
