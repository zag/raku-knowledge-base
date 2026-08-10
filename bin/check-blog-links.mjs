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

// the entry is worth nothing if the build did not turn it into a page
const puburl = text.match(/:puburl<([^>]+)>/)
if (!puburl) {
  console.error(`  no :puburl in ${entry} — the publisher will not take it for an article`)
  process.exit(1)
}
const page = path.join(outDir, `${puburl[1].replace(/^\//, '')}.html`)
if (!fs.existsSync(page)) {
  console.error(`  built site has no page at ${puburl[1]}`)
  process.exit(1)
}
console.log(`page: ${puburl[1]} ok`)
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
