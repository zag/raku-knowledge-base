import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_INDEX = path.join(here, '..', 'kb-index.json')

const tokenize = s =>
  s
    .toLowerCase()
    .split(/[^a-z0-9:]+/)
    .filter(Boolean)

export const loadCorpus = (indexPath = process.env.RAKU_KB_INDEX || DEFAULT_INDEX) => {
  const pages = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
  const lower = pages.map(p => ({ ...p, _title: p.title.toLowerCase(), _text: p.text.toLowerCase() }))
  return { pages: lower }
}

const snippet = (text, terms) => {
  const lower = text.toLowerCase()
  let at = -1
  for (const t of terms) {
    const i = lower.indexOf(t)
    if (i >= 0 && (at < 0 || i < at)) at = i
  }
  const start = at < 0 ? 0 : Math.max(0, at - 60)
  const s = text.slice(start, start + 200).trim()
  return (start > 0 ? '…' : '') + s + (start + 200 < text.length ? '…' : '')
}

const normalizeUrl = u => {
  let p = u.replace(/^https?:\/\/[^/]+/, '')
  if (!p.startsWith('/')) p = '/' + p
  if (p.length > 1) p = p.replace(/\/$/, '')
  return p || '/'
}

export const getPage = (corpus, url) => {
  const want = normalizeUrl(url)
  const p = corpus.pages.find(x => x.url === want)
  if (!p) return null
  return { url: p.url, title: p.title, section: p.section, text: p.text, truncated: Boolean(p.truncated) }
}

export const listSections = corpus => {
  const map = new Map()
  for (const p of corpus.pages) {
    const s = map.get(p.section) || { section: p.section, pages: 0, url: p.url }
    s.pages += 1
    if (p.url.length < s.url.length) s.url = p.url
    map.set(p.section, s)
  }
  return [...map.values()].sort((a, b) => b.pages - a.pages)
}

export const search = (corpus, query, limit = 10) => {
  const terms = tokenize(query)
  if (terms.length === 0) return []
  const scored = []
  for (const p of corpus.pages) {
    let score = 0
    for (const t of terms) {
      if (p._title.includes(t)) score += 10
      const idx = p._text.indexOf(t)
      if (idx >= 0) score += 3
    }
    if (score > 0) scored.push({ score, page: p })
  }
  scored.sort((a, b) => b.score - a.score || a.page.url.localeCompare(b.page.url))
  return scored.slice(0, limit).map(({ page }) => ({
    url: page.url,
    title: page.title,
    section: page.section,
    snippet: snippet(page.text, terms),
  }))
}
