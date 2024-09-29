

import imagesPlugin from '@podlite/publisher/lib/images-plugin'
import linksPlugin from '@podlite/publisher/lib/links-plugin'
import pubdatePlugin from '@podlite/publisher/lib/pubdate-plugin'
import reactPlugin from '@podlite/publisher/lib/react-plugin'
import siteDataPlugin from '@podlite/publisher/lib/site-data-plugin'
import stateVersionPlugin from '@podlite/publisher/lib/state-version-plugin'


import {composePlugins, parseSources, PluginConfig, processFile, processPlugin, publishRecord} from "@podlite/publisher"
import path from 'path'
import fs from 'fs'
const glob = require('glob')


const public_path = 'public'
const indexFilePath = 'index.podlite'
const built_path = 'built'
const site_url = 'example.com'
const makeConfigMainPlugin = () => {
    const configSiteDataPlugin: PluginConfig = {
      plugin: siteDataPlugin({
        public_path,
        indexFilePath: indexFilePath,
        built_path: built_path,
        site_url:site_url 
      }),
      includePatterns: '.*',
    }
    const configPubdatePlugin: PluginConfig = {
      plugin: pubdatePlugin(),
      includePatterns: '.*',
      excludePatterns: indexFilePath,
    }
    const configImagesPlugin: PluginConfig = {
      plugin: imagesPlugin(),
      includePatterns: '.*',
    }
    const configLinksPlugin: PluginConfig = {
      plugin: linksPlugin(),
      includePatterns: '.*',
    }
    const configReactPlugin: PluginConfig = {
      plugin: reactPlugin(),
      includePatterns: '.*',
    }
  
    const configStateVersionPlugin: PluginConfig = {
      plugin: stateVersionPlugin(),
      includePatterns: '.*',
    }
    return composePlugins(
      [
        // configPubdatePlugin,
        configReactPlugin,
        configImagesPlugin,
        configLinksPlugin,
        configStateVersionPlugin,
        configSiteDataPlugin,
      ],
      tctx,
    )
  } 

export function parseSources1(fpath: string): publishRecord[] {
    let count = 0
    const allFiles = glob
      .sync(fpath)
      .map((f: any) => {
        count++
        console.log(` ${count} : start processing  ${f}`)
        const ext = path.extname(f).toLowerCase()
        if (ext === '.rakudoc') {
            return processFile(f,undefined, 'text/podlite')    
        }
        return processFile(f)
      })
      .flat()
      .filter(Boolean)
    return allFiles as publishRecord[]
  }

const makeAbstactDocument = (title: string, content: string) => {
  return `
=begin pod 
=TITLE ${title}
=para
${content}
=end pod
`
}
const indexFile = `
=begin pod 
= :favicon<./logo.png>
= :puburl<http://example.com>
= :globalStyles("./styles.css")

=TITLE Site Index
=end pod
`
const tctx = { testing: true }
it('linksPlugin: linking', () => {
//   const state = [processFile('virtual/index.podlite', indexFile)]
    console.log(process.cwd())
  const doc_state = parseSources1('work_doc/**/*.{rakudoc, md}')
  console.log(doc_state.length)
//   fs.writeFileSync('./index.json',JSON.stringify(doc_state,null,2))
  const [stat, ctx ] = processPlugin(makeConfigMainPlugin(), doc_state, tctx)

})
