// The site is built from parsed trees, and a site release takes them from an
// earlier data release instead of parsing the corpus again. Trees of the wrong
// shape would not fail the build — they would change what the pages mean — so
// the corpus travels with a manifest and the site release refuses to build
// without a match.
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { execSync } from 'child_process'

// Raise this by hand when the shape of a tree changes. It is the only field a
// mismatch of which stops a build; the rest is there to say what happened.
const SCHEMA = 1

const TREES = [
  'built/mods-tree.json',
  'built/ecosystem.json',
  'built/mods.json',
  'built/docs-tree.json',
  'built/examples-tree.json',
]
const PODS_ROOT = 'work_mods'
const PODS_EXT = ['.pod6', '.podlite']
const MANIFEST = 'corpus-manifest.json'

const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')

const walk = dir => {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (PODS_EXT.includes(path.extname(entry.name).toLowerCase())) out.push(full)
  }
  return out
}

const readVersion = name => {
  const file = `node_modules/${name}/package.json`
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).version : null
}

const write = image => {
  const missing = TREES.filter(f => !fs.existsSync(f))
  if (missing.length) {
    console.error(`ERROR: the corpus is incomplete, missing: ${missing.join(', ')}`)
    process.exit(1)
  }
  let parser = null
  try {
    parser = execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    // a checkout without git history still produces a usable corpus
  }
  const manifest = {
    schema: SCHEMA,
    date: new Date().toISOString().slice(0, 10),
    parser,
    image: image || null,
    publisher: readVersion('@podlite/publisher'),
    podlite: readVersion('podlite'),
    trees: TREES.map(file => ({ file, bytes: fs.statSync(file).size, sha256: digest(file) })),
    pods: walk(PODS_ROOT)
      .sort()
      .map(file => ({ file, sha256: digest(file) })),
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1))
  const bytes = manifest.trees.reduce((sum, t) => sum + t.bytes, 0)
  console.log(`corpus: ${manifest.trees.length} trees, ${manifest.pods.length} pods, ${(bytes / 1048576).toFixed(1)} MB raw`)
}

const check = () => {
  if (!fs.existsSync(MANIFEST)) {
    console.error(`ERROR: ${MANIFEST} is missing — this corpus cannot be trusted`)
    process.exit(1)
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  if (manifest.schema !== SCHEMA) {
    console.error(`ERROR: corpus schema ${manifest.schema} against ${SCHEMA} here — parse the corpus again`)
    process.exit(1)
  }
  const faults = []
  for (const { file, bytes, sha256 } of manifest.trees) {
    if (!fs.existsSync(file)) faults.push(`${file} is missing`)
    else if (fs.statSync(file).size !== bytes) faults.push(`${file} is ${fs.statSync(file).size} bytes against ${bytes}`)
    else if (digest(file) !== sha256) faults.push(`${file} does not match its digest`)
  }
  const present = new Set(walk(PODS_ROOT))
  for (const { file, sha256 } of manifest.pods) {
    if (!present.has(file)) faults.push(`${file} is missing`)
    else if (digest(file) !== sha256) faults.push(`${file} does not match its digest`)
    present.delete(file)
  }
  for (const file of present) faults.push(`${file} is here but not in the manifest`)
  if (faults.length) {
    console.error(`ERROR: the corpus does not match its manifest`)
    for (const fault of faults.slice(0, 20)) console.error(`  ${fault}`)
    if (faults.length > 20) console.error(`  and ${faults.length - 20} more`)
    process.exit(1)
  }
  console.log(`corpus matches its manifest: ${manifest.trees.length} trees, ${manifest.pods.length} pods, parsed ${manifest.date}`)
}

const args = process.argv.slice(2)
const imageAt = args.indexOf('--image')
if (args.includes('--check')) check()
else write(imageAt > -1 ? args[imageAt + 1] : null)
