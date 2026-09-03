/**
 * Weekly Search Console digest.
 *
 * The point is not a traffic number. On a domain this young the number is
 * zero and stays zero for months, which tells you nothing. The point is the
 * three things that are actionable before rankings exist:
 *
 *   1. Is anything indexed at all? A page missing from the index is a
 *      technical problem wearing a content problem's clothes.
 *   2. Are pages competing with each other? Several near-identical pages on
 *      one query means Google is picking one and discarding the rest, and the
 *      fix is consolidation, not more pages.
 *   3. What sits in positions 11-20? Those are cheap to push and everything
 *      else is not.
 */

import { argOf, hasFlag, log, notify, readState, writeState } from './lib.mjs'
import { inspectUrl, resolveSite, searchAnalytics } from './gsc.mjs'

const JOB = 'rank-report'
const HOST = 'pdf.techsource.pro'
const SITEMAP = `https://${HOST}/sitemap.xml`

/** Search Console data lags two to three days; asking for yesterday returns nothing. */
const day = (offset) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10)
const END = argOf('end', day(3))
const START = argOf('start', day(31))

const pct = (value) => `${value >= 0 ? '+' : ''}${value}`

const main = async () => {
  const site = await resolveSite(HOST)
  await log(JOB, `property ${site}, window ${START}..${END}`)

  const [byPage, byQueryPage, totals] = await Promise.all([
    searchAnalytics(site, { startDate: START, endDate: END, dimensions: ['page'] }),
    searchAnalytics(site, { startDate: START, endDate: END, dimensions: ['query', 'page'] }),
    searchAnalytics(site, { startDate: START, endDate: END }),
  ])

  const total = totals.rows?.[0] ?? { clicks: 0, impressions: 0 }
  const pages = byPage.rows ?? []

  /* ---------------------------------------------------------- indexation */
  // Every URL the site publishes, versus every URL that drew an impression.
  const sitemapXml = await (await fetch(SITEMAP, { signal: AbortSignal.timeout(15000) })).text()
  const published = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  const seen = new Set(pages.map((row) => row.keys[0]))
  const silent = published.filter((url) => !seen.has(url))

  /* ------------------------------------------------------ cannibalisation */
  // One query served by several of our own pages: they split the signal
  // between them, and the weaker ones cannot win on their own.
  const perQuery = new Map()
  for (const row of byQueryPage.rows ?? []) {
    const [query, page] = row.keys
    if (!perQuery.has(query)) perQuery.set(query, new Map())
    perQuery.get(query).set(page, (perQuery.get(query).get(page) ?? 0) + row.impressions)
  }
  const clashes = [...perQuery.entries()]
    .filter(([, byUrl]) => byUrl.size > 1)
    .map(([query, byUrl]) => ({ query, pages: [...byUrl.entries()].sort((a, b) => b[1] - a[1]) }))
    .sort((a, b) => b.pages.length - a.pages.length)
    .slice(0, 8)

  /* ------------------------------------------------------ striking distance */
  const striking = pages
    .filter((row) => row.position > 10 && row.position <= 20 && row.impressions > 0)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 8)

  /* ---------------------------------------------------------------- delta */
  const previous = await readState(JOB, { impressions: 0, clicks: 0 })
  const deltaImpressions = Math.round(total.impressions - previous.impressions)
  const deltaClicks = Math.round(total.clicks - previous.clicks)

  /* --------------------------------------------------------- optional probe */
  // Rate limits are generous (2000/day) but this is the slow part of the run,
  // so it stays behind a flag until there is a reason to look.
  let indexation = null
  if (hasFlag('inspect')) {
    indexation = []
    for (const url of published) {
      try {
        const result = await inspectUrl(site, url)
        indexation.push({ url, verdict: result.indexStatusResult?.coverageState ?? 'unknown' })
      } catch (error) {
        indexation.push({ url, verdict: `error: ${error.message.slice(0, 80)}` })
      }
    }
  }

  /* -------------------------------------------------------------- report */
  const lines = [
    `📊 GSC ${START} → ${END}`,
    `${Math.round(total.impressions)} impresji (${pct(deltaImpressions)}), ${Math.round(total.clicks)} kliknięć (${pct(deltaClicks)})`,
    `${seen.size}/${published.length} URL-i z sitemapy ma jakąkolwiek impresję`,
  ]

  if (clashes.length) {
    lines.push('', '🔴 Kanibalizacja — jedna fraza, kilka naszych stron:')
    for (const { query, pages: hits } of clashes) {
      lines.push(`• "${query}" — ${hits.length} stron`)
      for (const [url, impressions] of hits.slice(0, 3)) {
        lines.push(`    ${url.replace(`https://${HOST}`, '')} (${Math.round(impressions)})`)
      }
    }
  }

  if (striking.length) {
    lines.push('', '🎯 Pozycje 11–20 (opłaca się dobić):')
    for (const row of striking) {
      lines.push(`• ${row.keys[0].replace(`https://${HOST}`, '')} — poz. ${row.position.toFixed(1)}, ${Math.round(row.impressions)} imp.`)
    }
  }

  if (silent.length) {
    lines.push('', `🕳️ Zero impresji (${silent.length}):`)
    for (const url of silent.slice(0, 10)) lines.push(`• ${url.replace(`https://${HOST}`, '')}`)
  }

  if (indexation) {
    lines.push('', '🔍 Indeksacja:')
    for (const row of indexation) lines.push(`• ${row.url.replace(`https://${HOST}`, '')} — ${row.verdict}`)
  }

  const report = lines.join('\n')
  console.log(report)
  await notify(report)
  await writeState(JOB, { impressions: total.impressions, clicks: total.clicks, end: END })
  await log(JOB, `${Math.round(total.impressions)} impressions, ${clashes.length} cannibalised queries, ${silent.length} silent URLs`)
}

main().catch(async (error) => {
  await log(JOB, `FAILED: ${error.message}`)
  await notify(`🔴 rank-report: ${error.message}`)
  process.exit(1)
})
