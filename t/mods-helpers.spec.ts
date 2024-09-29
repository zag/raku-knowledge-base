import path from 'path'
import fs from 'fs'
import {
  PodliteWebPlugin,
  PodliteWebPluginContext,
  processFile,
  processPlugin,
  publishRecord,
} from '@podlite/publisher'
import { modPlugin } from '../src'
const glob = require('glob')

const tctx = { testing: true }
it('modPlugin:  set process', () => {
  console.log(JSON.stringify(processFile('src/template.podlite', undefined, 'text/podlite'), null, 2))
})
it('modPlugin:  set publishUrl', () => {
  // lower case and cut prefix

  const [stat, ctx] = processPlugin(
    { plugin: modPlugin({ rootdir: './' }), includePatterns: '.*' },
    // [],
    [processFile('src/template.podlite', undefined, 'text/podlite')],
    tctx,
  )
  console.log(stat.length)
  //   console.log(stat)
  // console.log(JSON.stringify(stat.map(i=>{i.publishUrl) ,null,2))
  // const [item] = stat.filter(i=>i.publishUrl === '/doc/language/intro')
  //  const [item] = stat.filter(i=>i.publishUrl === '/doc/language/brackets')
  //  item.template = processFile('src/template.podlite',undefined, 'text/podlite')
  // console.log(JSON.stringify(item,null,2))

  // //   const state = [processFile('virtual/index.podlite', indexFile)]
  //     console.log(process.cwd())
  //   const doc_state = parseSources1('work_doc/**/*.{rakudoc, md}')
  //   console.log(doc_state.length)
  // //   fs.writeFileSync('./index.json',JSON.stringify(doc_state,null,2))
  //   const [stat, ctx ] = processPlugin(makeConfigMainPlugin(), doc_state, tctx)
})
