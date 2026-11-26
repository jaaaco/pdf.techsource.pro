---
title: OCR a PDF with the network switched off: what works
description: OCR does not need a server. How to run it in a browser tab with the connection off, how to verify nothing leaves, and where it falls short.
date: 2026-11-26
updated: 2026-11-26
locale: en
slug: ocr-pdf-offline
tags: [ocr, privacy, offline]
---

## Short answer

Yes, you can OCR a PDF without sending it anywhere. Text recognition is ordinary computation, and a laptop has plenty of it. The upload step in most online OCR services exists because of how those services are built, not because the job needs a server.

The OCR tool on this site runs Tesseract compiled to WebAssembly inside your browser tab. The file is read from disk into the tab's memory, recognised there, and handed back as a download. There is no upload endpoint to send it to.

## How to do it

1. Open the OCR page while you are still online, so the page and the recognition engine load.
2. Disconnect: airplane mode, Wi-Fi off, cable out.
3. Drop the PDF onto the page and start the run.
4. Wait for the progress bar, which counts real pages rather than a timer.
5. Download the result and close the tab. Nothing is kept afterwards.

Step 2 is optional for the tool and useful for you, because it turns a privacy claim into something you have tested.

## How do you check that nothing is uploaded?

Do not take the site's word for it. Two checks, both quick:

- **Disconnect first.** If the OCR finishes with the network off, the file cannot have gone anywhere. This is the strongest test, and it needs no technical knowledge.
- **Watch the network panel.** Open the browser's developer tools, switch to the Network tab, and run the OCR while online. You should see no request carrying your file.

The same test works on any tool that calls itself "offline" or "private". A service that fails with the connection off is doing the work on someone else's machine.

## Does your PDF need OCR at all?

Try to select a sentence in the PDF with your cursor. If the text highlights word by word, the file already has a text layer and OCR adds nothing. If the whole page behaves like one picture, it is a scan, and OCR is what makes it searchable.

## What the benchmark measured

The repository has a public benchmark that runs OCR on scanned test files and compares the recognised words against the known source text. Each file appears twice in the results.

| File | Pages | Word recall | Time |
|---|---|---|---|
| scan-150dpi-5p.pdf | 5 | 100.0% | 5.0s |
| scan-150dpi-5p.pdf | 5 | 100.0% | 3.0s |
| scan-300dpi-10p.pdf | 10 | 100.0% | 5.0s |
| scan-300dpi-10p.pdf | 10 | 100.0% | 5.0s |
| scan-clean-300dpi-3p.pdf | 3 | 100.0% | 2.0s |
| scan-clean-300dpi-3p.pdf | 3 | 100.0% | 2.0s |

Read this table narrowly. These are test scans of printed text, and the timings come from the benchmark machine, not yours. The table shows that browser OCR is not a weaker version of the server kind: on clean printed pages, it found every word, in seconds.

It does not show what happens with your documents.

## Where it falls short

There are no measurements for the cases below, so they come without numbers.

- **Handwriting.** Tesseract is built for printed text. Handwritten notes come out badly or not at all.
- **Poor source images.** Skewed phone photos, shadows across the page, faint faxes and coffee stains all cost accuracy. A flat, evenly lit scan beats a clever tool.
- **Very large files.** Everything happens in the tab's memory. A scan of several hundred pages can exceed what the browser allows, and splitting it into parts first is the practical fix.
- **Batches.** The tool handles one job at a time, by hand. For a folder of hundreds of scans, a command-line tool such as OCRmyPDF is the better fit. It uses the same Tesseract engine, runs locally, and can be scripted.
- **Tables and layouts.** OCR recovers words, not structure. A scanned spreadsheet becomes searchable, but it does not become a spreadsheet.

Always check the result. Search the output for a word you can see on the page, and spot-check any figures that matter. Search shows whether a word was found, not whether every digit in it is right.

## If the scan is also too big

Scans are often large, and compression on this site works well on them because it re-renders each page as an image. In the same benchmark, scan-300dpi-10p.pdf went from 3.94 MB to 0.47 MB on the ebook preset and to 0.17 MB on the screen preset. Screen is the smallest, and ebook is the middle ground.

Mind the order: compress first, then OCR. Compression rebuilds pages as images, so it belongs before the text layer is added, not after. Recognition also works from the pixels it is given, so if the text is small or faint, prefer ebook over screen before running OCR.

A PDF that is already vector text comes back from compression unchanged, on purpose. The 20-page text file in the benchmark went from 0.02 MB to 0.02 MB. That file would not need OCR either.

## The trade-off, plainly

Offline OCR in a browser costs you nothing in privacy and, on clean printed scans, nothing in accuracy. What you give up is scale and convenience: no batch queue, no handwriting model, and a memory ceiling set by your own machine. For a contract, a medical letter or a stack of invoices, that is usually the right trade.
