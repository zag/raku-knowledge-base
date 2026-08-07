// Turns two snapshots into release notes: what appeared, what moved, what went away.
import fs from 'fs'
import path from 'path'

const DIR = 'snapshots'

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

const name = key => key.slice(key.indexOf(':') + 1)
const lines = []
lines.push(`Modules: ${newer.count} (was ${older.count}) — ${older.date} → ${newer.date}`)
lines.push('')

if (!added.length && !changed.length && !removed.length) {
  lines.push('No changes.')
} else {
  if (added.length) {
    lines.push(`### Added (${added.length})`, '')
    for (const [key, version] of added) lines.push(`- ${name(key)} ${version}`)
    lines.push('')
  }
  if (changed.length) {
    lines.push(`### Updated (${changed.length})`, '')
    for (const [key, was, now] of changed) lines.push(`- ${name(key)} ${was} → ${now}`)
    lines.push('')
  }
  if (removed.length) {
    lines.push(`### Removed (${removed.length})`, '')
    for (const [key, version] of removed) lines.push(`- ${name(key)} ${version}`)
    lines.push('')
  }
}

process.stdout.write(lines.join('\n'))
