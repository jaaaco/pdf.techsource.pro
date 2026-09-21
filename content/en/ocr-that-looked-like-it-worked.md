---
title: OCR that looked like it worked
description: Five bugs in a browser OCR pipeline, every one of which produced a plausible success instead of an error. Measured before and after, with the code paths named.
date: 2026-09-14
updated: 2026-09-21
locale: en
slug: ocr-that-looked-like-it-worked
tags: [ocr, benchmarks, privacy]
---

For months the OCR on this site returned a file. It took a believable four or five
seconds, reported no error, and handed back a PDF of the right page count. The text
layer inside it was empty.

Nobody complained, because there was nothing to complain about. A searchable PDF with
no searchable text looks exactly like a searchable PDF until you press Ctrl+F. It took
a benchmark harness with a ground-truth word list to notice, and what it found was one
number that explained everything:

| File | "Searchable PDF" output | "Text only" output |
|---|---|---|
| scan-150dpi-5p.pdf | **0.0% word recall** | **100.0% word recall** |

Recognition was perfect. Everything downstream of it was broken. Below are the five
faults, in the order they had to be peeled back, because each one hid the next.

## 1. A crash that only happened on good scans

Three-hundred-dpi scans failed on page one. Hundred-and-fifty-dpi scans went all the
way through. That is backwards from every intuition about "large files are harder", and
the reason is a code path that only large pages reach.

pdf.js renders through a canvas factory, and its default is `DOMCanvasFactory`, which
calls `document.createElement('canvas')`. This code runs in a Web Worker, where
`document` does not exist. But the default factory is not reached on every render. It
is reached through `ImageResizer`, which engages once a page exceeds `MIN_IMAGE_DIM`,
2048 pixels. A 300 dpi A4 page is 2481 x 3507. A 150 dpi page is 1240 x 1754, under the
line, and never touches that path at all.

So the bug was invisible at the resolution anybody would use for a quick test, and the
threshold depends on the machine, which means "works on my machine" was not a figure of
speech here. It was literally true and completely useless.

The fix is a canvas factory built on `OffscreenCanvas`, which a worker does have,
injected where pdf.js expects its own.

## 2. The text layer was never written

With the crash gone, 300 dpi scans completed. They still had no text.

The code read the recognised words from `result.data.words`. In tesseract.js v7 that
field does not exist. Words live at `data.blocks[].paragraphs[].lines[].words[]`, and
the old flat array is gone.

What made this survive so long was the shape of the guard around it:

```js
if (result.words.length > 0) {
  // draw the invisible text layer
}
```

`result.words` was `undefined`, so `(result.words || [])` gave an empty array, so the
guard never fired, so no text layer was drawn, so no error was raised. The failure path
and the legitimate path are identical: "this scan contained no recognisable words" is a
perfectly normal outcome for a blank page, and the code reported it the same way.

## 3. The field exists, and it is null on purpose

Reading from `data.blocks` instead of `data.words` did not fix it. Recall stayed at 0%.
`data.blocks` was there in the result object, and its value was `null`.

The reason is in `tesseract.js/src/worker-script/constants/defaultOutput.js`: **`blocks`
is off by default.** You have to ask for it:

```js
const result = await worker.recognize(blob, {}, { blocks: true })
```

This is the one worth the article. A field that is absent tells you that you are on the
wrong version or the wrong path, and you go and read the types. A field that is present
and null tells you that recognition ran and found nothing, which is a normal answer to
a normal question. There is nothing to grep for, no stack trace, no deprecation
warning. It reads as working code returning a disappointing result.

Two hours went into checking the scan quality, the render resolution, and the language
data before anybody suspected the output flags. The scan was fine the whole time.

## 4. Polish disappeared, and so did five other languages

With words finally reaching the page, `page.drawText()` wrote them into the PDF. Called
without an explicit `font`, pdf-lib falls back to a standard font with WinAnsi
encoding, and WinAnsi cannot represent most of what the language dropdown offered.

Out of `ąćęłńóśźż`, exactly one character survived: `ó`. For Russian, Japanese, Chinese,
Arabic and Hindi, **every single word** threw an encoding exception. The exceptions went
into an empty `catch`, so the pages came out clean and wordless.

Six of the twelve languages in the dropdown could not produce a text layer at all,
while the interface advertised "multi-language recognition, including languages with
diacritics". Polish, the one language the author actually needed, was not even in the
list.

The fix is a real embedded font, registered through fontkit and subset into the output.
The language list then got cut to the eleven that the embedded font provably encodes,
verified by a round trip: write the words, read the PDF back, compare. Chinese,
Japanese and Hindi came back as NUL bytes and were removed. Arabic survives the round
trip but its accuracy is unmeasured, so it stays out until it is measured.

## 5. The error message blamed the user

The final indignity. The error handler classified any message containing the word
`read` as a file problem, and the message coming out of the broken worker was:

```
Cannot read properties of undefined
```

So a bug in our code told the person using it that their PDF was damaged, and advised
them to re-scan a document that was perfectly fine.

## After

Same corpus, same browser, measured on production:

| File | Before | After |
|---|---|---|
| scan-clean-300dpi-3p.pdf | crash on page 1 | **100.0% recall**, 2.0s |
| scan-150dpi-5p.pdf | 0.0% recall | **100.0% recall**, 5.0s |
| scan-300dpi-10p.pdf | crash on page 1 | **100.0% recall**, 5.0s |

The page copy went to the bin along with the bugs. `/ocr` claimed multi-language support
it did not have, and the homepage FAQ promised the whole site works with the network
off, which is not true for OCR: the engine and language data are fetched on first use.

## The thread running through all five

Not one of these raised an error. Every one produced a plausible success:

- a factory that is only reached above a size threshold, so the bug is resolution-dependent and machine-dependent
- a renamed field read through `|| []`, so a missing structure reads as an empty one
- an output that is **off by default** and comes back as `null`, indistinguishable from "found nothing"
- exceptions thrown per word into an empty `catch`, so a total failure looks like a blank page
- an error classifier matching on a substring, turning an internal bug into a user's fault

The practical lesson is not "write more tests", because a unit test would have mocked
the very thing that was lying. What caught it was an end-to-end harness running the
real site in a real browser against documents whose correct answer was known in advance.
Word recall against ground truth is a number that cannot be satisfied by code that
merely finishes.

One more, learned the hard way while fixing this: a late benchmark run from localhost
finished after the production run and overwrote the results file with pre-fix numbers.
It was caught only because somebody read the numbers by hand. That file is the source
of a published page, so mixing origins is the same thing as publishing false data. The
harness now compares the origin recorded in the file and aborts **before** measuring,
rather than discovering the mismatch fifteen minutes later at write time.

The corpus, the harness and the measurements are in the repository, and the current
numbers are on the [benchmarks page](/blog/pdf-compression-benchmarks).

## Who writes this site

Worth saying plainly, because it is the same lesson wearing different clothes. Most of
the writing here is drafted by an agent: it harvests the search phrases, writes the
page and opens the commit, and a person reviews before anything ships. This post-mortem
was drafted the same way, from the commit history and the benchmark output, then edited
by hand.

That arrangement only survives because of a guard built on the same idea as the harness
above. The generator is handed the measured figures and nothing else, and the script
that runs it throws the draft away if the body quotes a percentage outside that set:

```js
const invented = quoted.filter((value) => !allowedNumbers.has(value))
if (invented.length > 0) {
  await reject(`quotes percentages that were never measured: ${invented.join(', ')}%`)
}
```

It rejects "up to N" phrasing too, because that is the shape a number takes when it has
stopped reporting and started selling.

The reason for the guard is the reason for this whole article. A language model will
produce a plausible statistic exactly the way the OCR pipeline produced a plausible
PDF: quickly, with no error, and indistinguishable from the real thing right up until
somebody checks it against ground truth. Same failure mode, same fix. Measure the
output, and refuse to ship what you did not measure.
