---
title: How small a PDF actually gets, from 50 KB to 1 MB
description: Five test files, both presets, and which size targets each one clears. Measured in the browser, with nothing uploaded at any point.
date: 2026-08-15
updated: 2026-09-03
locale: en
slug: compress-pdf-to-100kb-free-offline-without-losing
tags: [compress, privacy, offline, benchmarks]
---

Whether a PDF reaches 100 KB, or 500 KB, or any other number somebody put in a
form's help text, depends almost entirely on what is inside it. Here is what
the screen preset did to five test files in this project's benchmark suite,
and which targets each result clears:

| File | Before | After (screen) | Change | 50 KB | 100 KB | 200 KB | 500 KB | 1 MB |
|---|---|---|---|---|---|---|---|---|
| scan-clean-300dpi-3p.pdf | 949 KB | 52 KB | −94.5% | no | yes | yes | yes | yes |
| scan-150dpi-5p.pdf | 634 KB | 86 KB | −86.5% | no | yes | yes | yes | yes |
| photo-3p.pdf | 4306 KB | 162 KB | −96.2% | no | no | yes | yes | yes |
| scan-300dpi-10p.pdf | 4040 KB | 171 KB | −95.8% | no | no | yes | yes | yes |
| text-native-20p.pdf | 16 KB | 16 KB | +0% | started under every one of them | | | | |

Each run took 1.0 second, except the 10-page scan at 2.0 seconds.

Three things fall out of that table.

**Nothing reached 50 KB.** The closest was a clean 3-page scan at 52 KB, and it
missed. If a form demands 50 KB, re-compressing a whole document is the wrong
lever — send fewer pages instead.

**100 KB is a coin flip decided by page count.** The two files that cleared it
had three and five pages. The two that missed had ten pages and three
photographic ones. A 96% reduction still lands at 162 KB when the input was
4306 KB, because the floor is set by how much page there is, not by how hard
the preset squeezes.

**200 KB and above is not really a question.** Every image-heavy file in the set
cleared 200 KB with room to spare. If your target is 500 KB or 1 MB, you can
stop reading here, use either preset, and it will work.

## Why scans collapse and text PDFs do not

Compression here works by re-rendering every page as an image and rebuilding
the PDF around those images. For a scan, that is exactly the right move: a scan
is already a picture of a page, usually stored at a resolution far higher than
screen reading needs. Re-rendering it lower throws away detail nobody was going
to look at.

A PDF exported from a word processor is not a picture. It is drawing
instructions plus an embedded font. Those instructions are already tiny — 16 KB
for 20 pages, in the file above — and turning them into images would make the
file *bigger* and the text unselectable. So the tool leaves them alone. If your
PDF is already vector text and you were hoping to shrink it, there is nothing
to shrink. That is not a limitation to work around; it is the file telling you
it is done.

The quick test: open the PDF and try to select a sentence with your cursor. If
the text highlights word by word, it is native text and compression will not
help. If you can only draw a box over it, it is a scan and compression will.

## What "without losing quality" actually means

You lose image resolution. That is the whole mechanism. On the screen preset the
result is sized for reading on a display, not for reprinting. The ebook preset
keeps more detail and costs you size:

| File | screen | ebook |
|---|---|---|
| scan-clean-300dpi-3p.pdf | 52 KB (−94.5%) | 142 KB (−85.0%) |
| scan-150dpi-5p.pdf | 86 KB (−86.5%) | 247 KB (−61.1%) |
| scan-300dpi-10p.pdf | 171 KB (−95.8%) | 482 KB (−88.1%) |
| photo-3p.pdf | 162 KB (−96.2%) | 850 KB (−80.3%) |

No ebook output reaches 100 KB, and one of them misses 500 KB. So the preset
choice is a target question, not a taste question: pick ebook when your limit is
1 MB and you want the document to still look like a document, pick screen when
the limit is tight enough that appearance is not the constraint. There is no
third preset and no resolution slider.

What you do not lose is page count — every file came out with the same number of
pages it went in with — and, on a scan, you were never going to lose selectable
text, because a scan has none to begin with.

If you need the words as text rather than as pixels, run OCR instead of, or
before, compressing. The same benchmark measures 100.0% word recall on all three
scan files, taking 5.0 seconds for the 5-page and 10-page scans and 2.0 seconds
for the clean 3-page one.

## When the preset is not enough

Two options remain, both honest about their cost:

- **Send fewer pages.** The 10-page scan compressed to 171 KB. Splitting it and
  sending only the pages that matter cuts the size roughly in proportion — the
  benchmark does not measure the split output directly, but the arithmetic is
  not subtle. Use the split tool first, then compress. This is the only real
  answer for a 50 KB target.
- **Accept the number you got.** A 4040 KB file at 171 KB will clear almost every
  real upload limit. The figure in a form's help text is often a suggestion
  rather than a rejection threshold. Try the upload before spending an hour
  chasing the last 70 KB.

## Nothing is uploaded, and that is checkable

The compression runs in a Web Worker in your browser using a WebAssembly build
of the rendering engine. Your file is read into memory, processed, and handed
back as a download. There is no server round trip, no queue, no temporary copy
on someone else's disk, and no retention policy to read, because there is
nothing to retain.

You can verify this rather than trust it. Open your browser's developer tools,
watch the Network tab during a run, and see that no request carries your
document. For medical records, contracts, or ID scans, that difference matters
more than the last few kilobytes.

## Steps

1. Open the compress tool and drop your PDF in.
2. Pick **screen** if you have a size target under 500 KB, **ebook** if your
   limit is generous and you care about looking at the result.
3. Wait — a second or two for the files above.
4. Check the output size. If it missed your target, split the document and
   compress the part you actually need to send.
