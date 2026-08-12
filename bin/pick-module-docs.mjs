// Chooses which module files carry documentation worth a page.
//
// Documentation files (.md, .pod6, .rakudoc) are always taken. Source files are
// taken only when their pod says something the README does not: almost every
// module ships both, and in most of them the two texts are the same.
//
// Prints one path per line.
import fs from 'fs'
import path from 'path'

const ROOT = process.argv[2] || 'work_mods'
const OVERLAP = Number(process.env.RAKU_KB_README_OVERLAP ?? 0.4)
// a file whose pod is a couple of lines has nothing to show on a page of its own
const MIN_LINES = Number(process.env.RAKU_KB_MIN_POD_LINES ?? 4)

const DOC_EXT = new Set(['.md', '.pod6', '.rakudoc'])
const SRC_EXT = new Set(['.rakumod', '.pm6', '.raku', '.pl6', '.pod'])
const TEST_DIR = /(^|\/)(t|xt|test|tests|t-[^/]*)(\/|$)/
const POD_START = /^=(begin\s+pod|pod\b|head\d|NAME\b|TITLE\b|SYNOPSIS\b)/m
// =cut and =over exist in Perl 5 pod and never in Podlite
const PERL5 = /^=(cut|over|back)\b/m

const read = file => {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

// Only lines long enough to carry meaning; short ones match by accident.
const meaningful = text =>
  new Set(
    text
      .split('\n')
      .map(line => line.replace(/\s+/g, ' ').trim().toLowerCase())
      .filter(line => line.length > 25),
  )

const podOf = text => {
  const out = []
  let inside = false
  for (const line of text.split('\n')) {
    if (line.startsWith('=begin pod')) {
      inside = true
      continue
    }
    if (line.startsWith('=end pod')) {
      inside = false
      continue
    }
    if (inside || line.startsWith('=')) out.push(line)
  }
  return out.join('\n')
}

const share = (a, b) => {
  if (a.size === 0) return 0
  let common = 0
  for (const line of a) if (b.has(line)) common++
  return common / a.size
}

const walk = dir => {
  const acc = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git') continue
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) acc.push(...walk(p))
    else acc.push(p)
  }
  return acc
}

const modules = []
for (const source of fs.readdirSync(ROOT)) {
  const sp = path.join(ROOT, source)
  if (!fs.statSync(sp).isDirectory()) continue
  for (const name of fs.readdirSync(sp)) {
    const mp = path.join(sp, name)
    if (fs.statSync(mp).isDirectory()) modules.push(mp)
  }
}

const chosen = []
let sourcePages = 0
let skippedSame = 0
let skippedThin = 0
for (const mp of modules) {
  const files = walk(mp)
  const docs = files.filter(f => DOC_EXT.has(path.extname(f).toLowerCase()))
  chosen.push(...docs)

  const readme = docs.find(f => path.basename(f).toLowerCase().startsWith('readme'))
  const readmeLines = readme ? meaningful(read(readme) || '') : null

  for (const f of files) {
    if (!SRC_EXT.has(path.extname(f).toLowerCase())) continue
    if (TEST_DIR.test(path.relative(mp, f).split(path.sep).join('/'))) continue
    const text = read(f)
    if (!text || !POD_START.test(text) || PERL5.test(text)) continue
    const pod = podOf(text)
    if (pod.split('\n').filter(line => line.trim()).length < MIN_LINES) {
      skippedThin++
      continue
    }
    if (readmeLines && share(meaningful(pod), readmeLines) >= OVERLAP) {
      skippedSame++
      continue
    }
    chosen.push(f)
    sourcePages++
  }
}

console.warn(
  `modules ${modules.length}, files ${chosen.length}, from sources ${sourcePages}, skipped as same as README ${skippedSame}, skipped as too thin ${skippedThin}`,
)
process.stdout.write(chosen.join('\n') + '\n')
