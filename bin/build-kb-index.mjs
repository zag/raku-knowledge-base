import fs from 'fs'
import path from 'path'

const OUT = process.argv[2]
const DEST = process.argv[3]
if (!OUT || !DEST) {
  console.error('usage: build-kb-index.mjs <out-dir> <dest.json>')
  process.exit(1)
}

const EXCERPT = 4000

const walk = dir => {
  const acc = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'pagefind' || e.name === '_next' || e.name === 'static') continue
      acc.push(...walk(p))
    } else if (e.name.endsWith('.html')) {
      acc.push(p)
    }
  }
  return acc
}

const strip = s =>
  s
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const toUrl = file => {
  let u = '/' + path.relative(OUT, file).replace(/\\/g, '/')
  u = u.replace(/index\.html$/, '').replace(/\.html$/, '')
  if (u.length > 1) u = u.replace(/\/$/, '')
  return u || '/'
}

const files = walk(OUT)
const entries = []
for (const f of files) {
  const html = fs.readFileSync(f, 'utf-8')
  const titleM = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || html.match(/<title>([\s\S]*?)<\/title>/)
  const title = titleM ? strip(titleM[1]).replace(/\s*-\s*The Raku.*$/, '') : ''
  const artM = html.match(/<article[^>]*>([\s\S]*?)<\/article>/)
  const mainM = html.match(/<main[^>]*>([\s\S]*?)<\/main>/)
  const body = artM ? artM[1] : mainM ? mainM[1] : html
  const text = strip(body)
  if (!text) continue
  const url = toUrl(f)
  const section = url === '/' ? 'home' : url.split('/')[1]
  entries.push({ url, title, section, text: text.slice(0, EXCERPT) })
}

entries.sort((a, b) => a.url.localeCompare(b.url))
fs.mkdirSync(path.dirname(DEST), { recursive: true })
fs.writeFileSync(DEST, JSON.stringify(entries))
const bySection = entries.reduce((a, e) => ((a[e.section] = (a[e.section] || 0) + 1), a), {})
console.log('kb-index:', entries.length, 'pages', JSON.stringify(bySection), '→', DEST)
