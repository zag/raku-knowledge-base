// Records what the ecosystem looked like today: one line per module, name and version.
// Registries are overwritten on every refresh, so without this there is nothing to compare against.
import fs from 'fs'
import path from 'path'

const SOURCES = [
  { file: 'built/mods.json', source: 'zef' },
  { file: 'built/ecosystem.json', source: 'p6c' },
]
const DIR = 'snapshots'

const date = process.argv[2] || new Date().toISOString().slice(0, 10)
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error(`Usage: snapshot-registry.mjs [YYYY-MM-DD]\nGot: ${date}`)
  process.exit(1)
}

const modules = {}
for (const { file, source } of SOURCES) {
  if (!fs.existsSync(file)) {
    console.error(`ERROR: ${file} is missing — refresh the registries first`)
    process.exit(1)
  }
  for (const entry of JSON.parse(fs.readFileSync(file, 'utf8'))) {
    const { name, version } = entry
    if (!name || !version) continue
    modules[`${source}:${name}`] = String(version)
  }
}

const count = Object.keys(modules).length
if (count === 0) {
  console.error('ERROR: registries parsed to zero modules — refusing to write an empty snapshot')
  process.exit(1)
}

fs.mkdirSync(DIR, { recursive: true })
const dest = path.join(DIR, `${date}.json`)
const snapshot = { date, count, modules: Object.fromEntries(Object.entries(modules).sort()) }
fs.writeFileSync(dest, JSON.stringify(snapshot, null, 1) + '\n')

const size = (fs.statSync(dest).size / 1024).toFixed(0)
console.warn(`snapshot: ${count} modules → ${dest} (${size} KB)`)
