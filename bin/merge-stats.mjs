// Folds the per-corpus measurements into one dated record.
//
// A half-filled record is worse than none: an absence is visible, a partial one
// reads as a measurement. Every expected fragment must be there or nothing is written.
import fs from 'fs'
import path from 'path'

const DIR = 'snapshots/corpus'

const args = process.argv.slice(2)
const dateAt = args.indexOf('--date')
const date = dateAt >= 0 ? args[dateAt + 1] : new Date().toISOString().slice(0, 10)
const fragments = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--date')

if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error(`ERROR: expected a date as YYYY-MM-DD, got ${date}`)
  process.exit(1)
}
if (fragments.length === 0) {
  console.error('Usage: merge-stats.mjs [--date YYYY-MM-DD] <fragment.json> ...')
  process.exit(1)
}

const missing = fragments.filter(f => !fs.existsSync(f))
if (missing.length) {
  console.error(`ERROR: ${missing.length} of ${fragments.length} measurements are missing: ${missing.join(', ')}`)
  console.error('refusing to write a partial record')
  process.exit(1)
}

const mergeSection = (into, from) => {
  for (const [key, cell] of Object.entries(from)) {
    const seat = into[key] || (into[key] = { n: 0, files: 0, modules: 0 })
    seat.n += cell.n
    seat.files += cell.files
    seat.modules += cell.modules
    if (cell.values) {
      seat.values = seat.values || {}
      for (const [value, n] of Object.entries(cell.values)) seat.values[value] = (seat.values[value] || 0) + n
    }
  }
}

const census = { blocks: {}, codes: {}, attrs: {} }
const sources = {}
const pages = []
const errors = []
let conditions = null

for (const file of fragments) {
  const part = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (const kind of Object.keys(census)) mergeSection(census[kind], part.census[kind] || {})
  sources[part.conditions.source] = part.totals
  pages.push(...part.pages)
  errors.push(...part.errors)
  // the rule and its thresholds are one run's settings; a fragment that disagrees
  // means the parts were measured under different rules and cannot be compared
  if (!conditions) conditions = part.conditions
  else if (conditions.selectionRule !== part.conditions.selectionRule) {
    console.error('ERROR: fragments were measured under different selection rules')
    process.exit(1)
  }
}

const order = section =>
  Object.fromEntries(Object.entries(section).sort((a, b) => b[1].n - a[1].n))

const record = {
  date,
  conditions: { ...conditions, source: undefined, files: undefined },
  totals: { pages: pages.length, errors: errors.length, modules: new Set(pages.map(p => p.module).filter(Boolean)).size },
  sources,
  census: { blocks: order(census.blocks), codes: order(census.codes), attrs: order(census.attrs) },
  pages,
  errors,
}

fs.mkdirSync(DIR, { recursive: true })
const dest = path.join(DIR, `${date}.json`)
fs.writeFileSync(dest, JSON.stringify(record))
console.warn(
  `corpus: ${record.totals.pages} pages from ${record.totals.modules} modules, ${record.totals.errors} unparsed → ${dest}`,
)
