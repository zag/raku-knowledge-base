// Turns two snapshots into release notes: what appeared, what moved, what went away.
import fs from 'fs'
import path from 'path'

const DIR = 'snapshots'
const SITE = 'https://raku-knowledge-base.podlite.org'

// A module page exists only when the module ships documentation, so links come
// from the built index rather than being guessed from the name.
const loadPages = () => {
  const file = process.env.RAKU_KB_INDEX || 'mcp-server/kb-index.json'
  if (!fs.existsSync(file)) return null
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    const pages = Array.isArray(data) ? data : data.pages || []
    return new Set(pages.map(p => p && p.url).filter(Boolean))
  } catch {
    return null
  }
}

const pageUrl = (key, known) => {
  const source = key.slice(0, key.indexOf(':'))
  const name = key.slice(key.indexOf(':') + 1)
  const path = `/mods/${source === 'p6c' ? 'all' : source}/${name}`
  if (known && !known.has(path) && !known.has(SITE + path)) return null
  return SITE + encodeURI(path)
}

const load = arg => {
  // an argument may be a date, a bare file name from the directory listing, or a path
  const file = arg.includes('/') ? arg : path.join(DIR, arg.endsWith('.json') ? arg : `${arg}.json`)
  if (!fs.existsSync(file)) {
    console.error(`ERROR: ${file} not found`)
    process.exit(1)
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

const listSnapshots = () =>
  fs.existsSync(DIR)
    ? fs
        .readdirSync(DIR)
        .filter(f => f.endsWith('.json'))
        .sort()
    : []

let [before, after] = process.argv.slice(2)
if (!before) {
  const all = listSnapshots()
  if (all.length < 2) {
    console.error(`ERROR: need two snapshots in ${DIR}/, found ${all.length}`)
    process.exit(1)
  }
  ;[before, after] = all.slice(-2)
}

const older = load(before)
const newer = load(after || listSnapshots().slice(-1)[0])

const added = []
const changed = []
const removed = []

for (const [key, version] of Object.entries(newer.modules)) {
  const was = older.modules[key]
  if (was === undefined) added.push([key, version])
  else if (was !== version) changed.push([key, was, version])
}
for (const key of Object.keys(older.modules)) {
  if (newer.modules[key] === undefined) removed.push([key, older.modules[key]])
}

const known = loadPages()
const name = key => key.slice(key.indexOf(':') + 1)
const link = key => {
  const url = pageUrl(key, known)
  return url ? `[${name(key)}](${url})` : name(key)
}
const lines = []
lines.push(`Modules: ${newer.count} (was ${older.count}) — ${older.date} → ${newer.date}`)
lines.push('')

if (!added.length && !changed.length && !removed.length) {
  lines.push('No changes.')
} else {
  if (added.length) {
    lines.push(`### Added (${added.length})`, '')
    for (const [key, version] of added) lines.push(`- ${link(key)} ${version}`)
    lines.push('')
  }
  if (changed.length) {
    lines.push(`### Updated (${changed.length})`, '')
    for (const [key, was, now] of changed) lines.push(`- ${link(key)} ${was} → ${now}`)
    lines.push('')
  }
  if (removed.length) {
    lines.push(`### Removed (${removed.length})`, '')
    for (const [key, version] of removed) lines.push(`- ${name(key)} ${version}`)
    lines.push('')
  }
}

process.stdout.write(lines.join('\n'))
