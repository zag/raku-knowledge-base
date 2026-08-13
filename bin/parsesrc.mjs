import path from 'path'
import { createRequire } from 'module'
import fs from 'fs'
import glob from 'glob'
import { makeCollector, writeReport } from './stats.mjs'

const require = createRequire(import.meta.url)
const { processFile } = require('@podlite/publisher')

async function run() {
  const atpath = process.argv[2]
  const statsAt = process.argv.indexOf('--stats')
  const statsPath = statsAt > 0 ? process.argv[statsAt + 1] : null
  const collector = statsPath ? makeCollector({ selectionRulePath: './bin/pick-module-docs.mjs' }) : null
  console.warn('atpath', atpath)

  let count = 0
  // an argument starting with @ names a file that lists the paths, NUL separated:
  // the module selection is a rule, not a pattern, so it cannot be a glob, and a
  // module name may hold a newline, which would tear one path into two
  const list = atpath.startsWith('@')
    ? fs.readFileSync(atpath.slice(1), 'utf8').split('\0').filter(Boolean)
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
        collector?.fail(f, err)
        return null
        // process.exit(1)
      }
    })
    .flat()
    .filter(Boolean)

  if (collector) {
    for (const record of allFiles) collector.add(record)
    writeReport(statsPath, collector.report({ source: atpath, files: count }))
    console.warn('stats', statsPath)
  }
  // no indentation: it more than doubled the file, and nothing reads this by eye
  console.log(JSON.stringify(allFiles))
}

run()
