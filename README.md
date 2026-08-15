# PDF Toolkit

A privacy-first, open-source collection of client-side PDF processing tools.

## Features

- **Compress PDF**: Reduce file size with quality presets
- **Merge PDFs**: Combine multiple PDF files into one
- **Split PDF**: Extract pages or ranges from PDF files
- **OCR PDF**: Make scanned PDFs searchable with text recognition

## Privacy First

- All processing happens entirely in your browser
- No files are uploaded to any server
- No data leaves your device
- Works completely offline

Analytics are opt-in and anonymous, and error reports are stripped of personal
data. The full statement is at [/privacy](https://pdf.techsource.pro/privacy).

## Technology

- Built with React + TypeScript + Vite
- WebAssembly (WASM) for heavy processing
- Web Workers for non-blocking operations
- Static hosting compatible

## Development

```bash
npm install
npm run dev
```

## Testing

```bash
npm test
```

## Content and SEO

Vite produces a single `index.html`, so without a prerender step every URL
would return the same title, description and empty body — invisible to search
engines. `npm run build` therefore ends with `scripts/prerender.mjs`.

| Path | What it holds |
|---|---|
| `seo/site.json` | Origin, locales, publisher, contact |
| `seo/routes.json` | Title, description, h1, intro, bullets and FAQ for each route |
| `content/<locale>/*.md` | Articles, front matter + markdown |
| `scripts/prerender.mjs` | Writes `dist/<route>/index.html`, `sitemap.xml`, `robots.txt` |

Two rules keep this honest:

1. **Prerendered HTML and hydrated React must show the same text.** Both read
   `seo/routes.json` — `ToolHero` renders the h1 and intro, `SeoSection`
   renders the bullets and FAQ. Diverging from the static copy is cloaking.
2. **Programmatic pages need substance, not just prose.** A generated page
   should carry a working tool for its specific intent and real measured data.
   Bulk text spun up to catch keywords is a search-spam policy violation and
   risks the whole domain.

### Adding an article

Create `content/en/<slug>.md`:

```markdown
---
title: A specific, honest headline
description: One or two sentences, 50-170 characters.
date: 2026-08-15
locale: en
slug: <slug>
tags: [privacy, how-to]
---

Body in markdown.
```

It appears at `/blog/<slug>`, in the blog index and in the sitemap on the next
build. No list to update.

## Configuration

Copy `.env.example` to `.env`. Everything is optional; each feature stays off
while its variable is empty.

| Variable | Effect |
|---|---|
| `VITE_GTM_ID` | Loads Google Tag Manager, gated behind the consent banner |
| `VITE_SENTRY_DSN` | Enables error reporting, configured to send no PII |
| `VITE_ETHICALADS_PUBLISHER` | Renders ad slots; empty means the site is ad-free |
| `VITE_BUY_ME_COFFEE_URL` | Shows the support link |
| `VITE_GITHUB_URL` | Shows the repository links |

## License

See [LICENSE.md](./LICENSE.md) for licensing information.
