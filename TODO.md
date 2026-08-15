# TODO

## Done

1. ~~Google Tag Manager~~ — wired via `VITE_GTM_ID` (`src/lib/gtm.ts`), gated by the consent banner and Google Consent Mode (`src/lib/consent.ts`).
2. ~~Fix build and configure deployment on Netlify~~ — deploys from `main`.
3. ~~Debug console behind a keyboard shortcut~~ — `src/hooks/useDebugConsole.ts`, state persisted.
4. ~~Sentry error reporting~~ — `src/lib/monitoring.ts`, loaded lazily when `VITE_SENTRY_DSN` is set. Configured with `sendDefaultPii: false` and fully masked replays: a site that promises documents never leave the browser cannot ship unmasked session recordings.
5. ~~Buy me a coffee / sponsor link~~ — `VITE_BUY_ME_COFFEE_URL`, shown in the app bar.

## Open

### Needs an account before it can be finished

- **EthicalAds** — sign up at https://www.ethicalads.io/publishers/, then set `VITE_ETHICALADS_PUBLISHER` in Netlify. `src/components/AdSlot.tsx` renders nothing until it is set, so the site stays ad-free until then.
- **Google Search Console** — verify the domain, submit `https://pdf.techsource.pro/sitemap.xml`, then wire the API for the ranking reports.
- **IndexNow** — the key file is already in `public/`. Ping Bing/Yandex on deploy.
- **Contact email** — `seo/site.json` has `contactEmail: null`, so the contact page shows only the GitHub route. Set it if a mailbox should be published.

### Content and reach

- **Open Graph image** — no `og:image` is emitted. Social shares render bare. Needs a 1200x630 PNG in `public/` plus the tag in `scripts/prerender.mjs`.
- **Polish version** — `/pl/*` routes with real Polish copy. `seo/routes.json` and the prerenderer already handle multiple locales and emit hreflang; the copy and the router entries are missing.
- **Benchmarks** — measure the tools against a fixed corpus and publish the numbers. This is what makes the generated pages worth indexing rather than filler.
- Article on Medium / dev.to to promote the service, cross-posted with `canonical_url` pointing here.

### Housekeeping

- **The test suite is red and was before any of this work**: 22 failures plus a heap OOM when the whole suite runs. `tests/e2e/app-flow.test.tsx` (11) never resolves the lazy routes under jsdom; `tests/unit/file-utils.test.ts` (7) fails constructing mock `File` objects; `tests/unit/components/ProgressBar.test.tsx` (4) queries text that no longer exists. The four `tests/integration/*.test.tsx` files collect zero tests. This is what kept the old GitHub Actions workflow red for all 18 of its runs, and it is why the workflow was removed rather than kept as a broken gate. Fixing it is the precondition for reintroducing CI.
- **No CI at all right now.** `npm run lint`, `npm run type-check` and `npm run build` all pass and would make a useful one-minute gate. Worth adding once there is something to gate — a green signal is a prerequisite for the automated deploy checks in the traffic plan.
- `.env` is committed. Nothing in it is secret — a Sentry DSN and a GTM ID are public by design — but the file should move to Netlify environment variables and out of the repository.
