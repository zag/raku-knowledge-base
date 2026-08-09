// Links in a blog entry are built from module names before the site exists.
// This checks them against the site that was just built.
import fs from 'fs'
import path from 'path'

const [entry, outDir] = process.argv.slice(2)
if (!entry || !outDir) {
  console.error('usage: check-blog-links.mjs <entry.podlite> <out-dir>')
  process.exit(1)
}

const SITE = 'https://raku-knowledge-base.podlite.org'
const text = fs.readFileSync(entry, 'utf8')
const urls = [...text.matchAll(/L<[^|>]*\|([^>]+)>/g)].map(m => m[1]).filter(u => u.startsWith(SITE))

const dead = urls.filter(url => {
  const rel = decodeURI(url.slice(SITE.length)).replace(/^\//, '')
  return !fs.existsSync(path.join(outDir, `${rel}.html`)) && !fs.existsSync(path.join(outDir, rel, 'index.html'))
})

console.log(`links: ${urls.length}, dead: ${dead.length}`)
if (dead.length) {
  for (const url of dead) console.error(`  no page: ${url}`)
  process.exit(1)
}
