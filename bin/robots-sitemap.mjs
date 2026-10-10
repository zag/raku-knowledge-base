// robots.txt comes from the engine, one file for every site, and names no sitemap:
// a robot finds the map only if someone submitted it by hand. This adds the line
// for this site after the build, once, and refuses a line that names another map.
// Drop the step when the engine writes the line itself.
import fs from 'fs'
import path from 'path'

const [outDir, site] = process.argv.slice(2)
if (!outDir || !site) {
  console.error('usage: robots-sitemap.mjs <out-dir> <site-url>')
  process.exit(1)
}

const sitemap = path.join(outDir, 'sitemap.xml')
if (!fs.existsSync(sitemap)) {
  console.error(`  no ${sitemap}: the line would point at nothing`)
  process.exit(1)
}

const robots = path.join(outDir, 'robots.txt')
const line = `Sitemap: ${site.replace(/\/$/, '')}/sitemap.xml`
const text = fs.existsSync(robots) ? fs.readFileSync(robots, 'utf8') : ''
const named = text.split(/\r?\n/).filter(l => /^sitemap:/i.test(l.trim())).map(l => l.trim())
const foreign = named.filter(l => l !== line)
if (foreign.length) {
  console.error(`  ${robots} already names another map: ${foreign.join('; ')}`)
  process.exit(1)
}
if (named.length) {
  console.log(`  ${robots} already names the map`)
} else {
  fs.writeFileSync(robots, (text && !text.endsWith('\n') ? text + '\n' : text) + line + '\n')
  console.log(`  ${robots}: ${line}`)
}
