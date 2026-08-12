import path from 'path'
import { createRequire } from 'module'
import fs from 'fs'
import glob from 'glob'

const require = createRequire(import.meta.url)
const { processFile } = require('@podlite/publisher')

async function run() {
  const atpath = process.argv[2]
  console.warn('atpath', atpath)

  let count = 0
  // an argument starting with @ names a file that lists the paths, one per line:
  // the module selection is a rule, not a pattern, so it cannot be a glob
  const list = atpath.startsWith('@')
    ? fs
        .readFileSync(atpath.slice(1), 'utf8')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
    : glob.sync(atpath)

  const allFiles = list
    .map(f => {
      count++
      console.warn('Processing', count, f)
      const ext = path.extname(f).toLowerCase()
      try {
        if (ext === '.rakudoc') {
          return processFile(f, undefined, 'text/podlite')
        }
        return processFile(f)
      } catch (err) {
        // console.error(err)
        console.error('Error processing', f)
        return null
        // process.exit(1)
      }
    })
    .flat()
    .filter(Boolean)
  console.log(JSON.stringify(allFiles, null, 2))
}

run()
