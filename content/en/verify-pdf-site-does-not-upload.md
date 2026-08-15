---
title: How to check whether a PDF site actually uploads your file
description: Every online PDF tool claims your files are safe. Here are four checks you can run yourself in about two minutes, without trusting anybody's marketing page.
date: 2026-08-15
updated: 2026-08-15
locale: en
slug: verify-pdf-site-does-not-upload
tags: [privacy, how-to]
---

"Your files are deleted after one hour." "Bank-level encryption." "We respect your privacy."

Every online PDF converter says some version of this, and none of it is checkable. A promise to delete a file later is still an admission that the file was uploaded in the first place, and you have no way to audit what happened to it in between. If the document is a payslip, a signed contract or a medical scan, that gap matters.

The good news is that you do not have to take anybody's word for it. Whether a page uploads your file is directly observable from your own browser, and the checks take about two minutes.

## Check 1: watch the network tab

This is the definitive test.

1. Open the PDF site.
2. Open developer tools: `F12`, or `Cmd+Option+I` on macOS.
3. Go to the **Network** tab and make sure recording is on.
4. Clear the log, then select your file and start the operation.

Now look at the requests. You are looking for a `POST` or `PUT` whose size is roughly the size of your document. A 4 MB PDF that gets uploaded produces a request with about 4 MB of payload; there is nowhere to hide that. Click any suspicious request and check the **Payload** or **Request** tab to see what was actually sent.

A tool that processes locally produces no such request. You will see the page's own scripts, styles and possibly a WebAssembly binary being downloaded, and then nothing while the work happens.

Watch out for one trap: some sites upload the file the moment you select it, before you press the button. Start recording *before* you pick the file, not after.

## Check 2: pull the plug

Simpler, and almost as convincing.

1. Load the page and wait until it has fully finished loading.
2. Turn off your wifi, or tick **Offline** in the Network tab's throttling dropdown.
3. Now try to process a file.

If the tool completes the job with no connection, the processing was happening on your machine, because there was no server to reach. If it hangs, errors out, or shows a spinner forever, the work was being done elsewhere.

One caveat: some client-side tools download a WebAssembly module or OCR language data on first use, so the very first run may need the network even though nothing is uploaded. Run the operation once while online, then go offline and run it again. The second run is the honest test.

## Check 3: read the request URLs, not the privacy policy

While you are in the Network tab, scan the domains being contacted. Analytics and error reporting are normal and are not the same thing as uploading your document, but a request to an unfamiliar host carrying a large body is worth understanding before you continue.

The rule of thumb: small requests to analytics domains are routine, and a large request timed exactly to when you selected your file is your document leaving the building.

## Check 4: look at the source

Not applicable everywhere, but decisive when it is. If the tool is open source, you can read what it does, and more importantly other people can too. A closed tool asking you to trust a sentence on its homepage and an open tool whose processing code is public are not in the same category of claim.

## Why this keeps mattering

Server-side processing is not evil in itself. It is faster for very large jobs, it works on weak devices, and for plenty of documents nobody cares. The problem is that it is the default for almost every "free online PDF" result, including for the documents where it is least appropriate, and the marketing copy is carefully written to make you not ask.

So ask. The two-minute version is check 1 and check 2. If a site passes both, its privacy claim is not marketing, it is just a description of how the thing works.

This site is built to pass those checks. Compression, merging, splitting and OCR all run in your browser, and you are welcome to open the Network tab and confirm it before you trust it with anything real.
