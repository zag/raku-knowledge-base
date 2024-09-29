import path from 'path'
import { Command } from 'commander'
import glob from 'glob'
import { processFile } from '@podlite/publisher'
const packagePath = process.cwd()

async function run() {
  const program = new Command()
  program.name('attachExternal').description('service tool')

  program.argument('[glob]', 'i.e dir/**/*.{podlite,pod6}')

  program.parse(process.argv)
  const [atpath] = program.args
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
