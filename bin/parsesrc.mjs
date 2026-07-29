import path from 'path'
import { createRequire } from 'module'
import glob from 'glob'

const require = createRequire(import.meta.url)
const { processFile } = require('@podlite/publisher')

async function run() {
  const atpath = process.argv[2]
  console.warn('atpath', atpath)

  let count = 0
  const allFiles = glob
    .sync(atpath)
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
