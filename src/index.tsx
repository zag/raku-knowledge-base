import {
  composePlugins,
  isExistsDocBlocks,
  PluginConfig,
  PodliteWebPlugin,
  PodliteWebPluginContext,
  publishRecord,
} from '@podlite/publisher'
import { processFile } from '@podlite/publisher/lib/node-utils'
import * as CRC32 from 'crc-32'
import React from 'react'
import * as fs from 'fs'
import { getFromTree, getTextContentFromNode, makeAttrs, makeInterator, mkBlock, mkRootBlock, PodNode } from '@podlite/schema'
import { url } from 'inspector'

// README markdown leaks brackets and emphasis into the target
const linkFromText = (text: string): string =>
  text
    .trim()
    .replace(/^[[(<]+|[\])>]+$/g, '')
    .replace(/^\*+|\*+$/g, '')
    // some readme files were written on windows and carry backslash paths
    .replace(/\\/g, '/')
    .trim()

// A module file without a title of its own was named by its file alone, and 2 329 pages
// were all called README. Every file now carries its module: a code file under lib/ is
// named by the package its module provides from that very path, and a package that does
// not start with the module's name keeps the module in front of it; any other file, and
// code no package claims, is named by its module and its own name or path. A title of
// the author's stays, unless it is only the file name again.
const codeFile = /\.(rakumod|pm6|pm|pod6|pod|rakudoc|raku|p6)$/
// a provides key may carry adverbs (RKDS:api<2>); they are not part of the name
const packageName = (key: string) => key.replace(/(:(api|ver|auth)<[^>]*>)+$/, '')
const startsWithModule = (pkg: string, module: string) => {
  const p = pkg.toLowerCase().split('::')
  const m = module.toLowerCase().split('::')
  return m.length <= p.length && m.every((part, i) => part === p[i])
}
export const moduleFileTitle = (file: string, ownTitle: unknown, meta?: { provides?: Record<string, string> }) => {
  const parts = file.split('/') // work_mods/<zef|all>/<module>/…
  const module = parts[2]
  const name = parts[parts.length - 1]
  const base = name.replace(/\.[^.]*$/, '')
  const own = String(ownTitle ?? '').replace(/\s+/g, ' ').trim()
  if (own && own.toLowerCase() !== base.toLowerCase()) return own
  const lib = parts.indexOf('lib', 3)
  if (lib < 0 || !codeFile.test(name)) return `${module} — ${base}`
  const path = parts.slice(lib).join('/')
  const names = [
    ...new Set(
      Object.entries(meta?.provides || {})
        .filter(([, value]) => value === path)
        .map(([key]) => packageName(key)),
    ),
  ]
  if (names.length !== 1) return `${module} — ${path}`
  return startsWithModule(names[0], module) ? names[0] : `${module} — ${names[0]}`
}

export const modPlugin = ({ rootdir }): PodliteWebPlugin => {
  const mods_state = require('../built/mods-tree.json') //.splice(0, 10);
  const all_mods = require('../built/ecosystem.json')
  const zef_mods = require('../built/mods.json')

  const outCtx: PodliteWebPluginContext = {}
  const onExit = ctx => ({ ...ctx, ...outCtx })
  const processNode = (node: PodNode, file: string) => {
    function isRemoteUrl(url: string): boolean {
      try {
        const parsedUrl = new URL(url)
        return ['http:', 'https:'].includes(parsedUrl.protocol)
      } catch (error) {
        // If URL parsing fails, assume it's a local path
        return false
      }
    }

    const rules = {
      // we need add prefic to all /doc/ links
      'L<>': node => {
        const { meta, content } = node
        const link = meta ? meta : getTextContentFromNode(content)
        return { ...node, meta: isRemoteUrl(link) ? meta : `/doc${link}` }
      },
    }
    return makeInterator(rules)(node, {})
  }
  // a name with control characters cannot be carried through a publish url
  const isPublishableName = (name: string) => Boolean(name) && !/[\u0000-\u001f"]/.test(name)
  const oneLine = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim()
  // the registry's line is what a search result should show for a module page; the page
  // carries it only as a subtitle, which no description is ever taken from
  const descriptionBlock = (value: unknown) => (oneLine(value) ? `\n    =DESCRIPTION ${oneLine(value)}` : '')

  const onProcess = (recs: publishRecord[]) => {
    // filter out files without docuemntation
    const filesWithDocs = mods_state
      .filter(item => isExistsDocBlocks(item.node))
      .filter(item => isPublishableName(item.file.split('/')[2]))
    //   convert all doc: links to file:: links
    // README authors leave stray brackets and emphasis inside link targets
    // ([text]([https://…) and **http://…**); the site should not carry them through.
    const cleanModuleLinks = (node: PodNode) =>
      makeInterator({
        'L<>': (n: any) => {
          // only clean an existing target: a link without one must stay without one,
          // otherwise 708 plain-text links turn into broken addresses
          if (typeof n.meta !== 'string' || !n.meta) return n
          const cleaned = linkFromText(n.meta)
          return cleaned === n.meta ? n : { ...n, meta: cleaned }
        },
      })(node, {})

    const withUrls = filesWithDocs.map(item => {
      const publishUrl = item.file.replace(/^work_mods/g, '/mods')
      return { ...item, publishUrl, node: cleanModuleLinks(item.node) }
    })

    // A checkout the registry does not know about gets no pages at all: one such
    // directory used to stop the whole build. The lookup runs once here, so nothing
    // downstream searches the registry again and nothing publishes what was skipped.
    const metaOf = new Map()
    const withoutMeta = new Set<string>()
    for (const item of withUrls) {
      const [_, namespace, name] = item.file.split('/')
      const meta = namespace === 'zef' ? zef_mods.find(i => i.name === name) : all_mods.find(i => i.name === name)
      if (meta) metaOf.set(item.file, meta)
      else withoutMeta.add(name)
    }
    const addedUrls = withUrls.filter(item => metaOf.has(item.file))

    // const addedUrls = mods_state
    console.log(`modPlugin is running: ${rootdir}`)

    //  group mods by type and add meta info
    const mods_info = addedUrls.reduce((acc, item) => {
      const [_, namespace, name] = item.file.split('/')
      const meta = metaOf.get(item.file)
      acc[namespace] = acc[namespace] || {}
      acc[namespace][name] = acc[namespace][name] || {}
      const moduleInfo = {
        ...acc[namespace][name],
        meta,
        files: [...(acc[namespace][name]['files'] || []), { file: item.file, publishUrl: item.publishUrl }],
        src: namespace,
        url: '/mods/' + namespace + '/' + name,
      }

      acc[namespace][name] = moduleInfo
      return acc
    }, {})

    if (withoutMeta.size) {
      const names = [...withoutMeta].sort()
      const shown = names.slice(0, 10).join(', ')
      console.log(
        `[modPlugin] modules skipped, not in the registry: ${withoutMeta.size} (${shown}${names.length > 10 ? ', …' : ''})`,
      )
    }

    // generate pages for each module
    const all_mods_pages = Object.values({
      ...(mods_info.all || {}),
      ...(mods_info.zef || {}),
    })

    const mapFileNameToModuleInfo: any = all_mods_pages.reduce((acc: any, item) => {
      const { files } = item as any
      if (files.length === 0) return acc
      files.forEach(file => {
        acc[file.file] = item
      })
      return acc
    }, {})

    // fill module info for each doc
    // add moduleInfo to each mods document

    addedUrls.forEach(item => {
      if (mapFileNameToModuleInfo[item.file]) {
        item.pluginsData = item.pluginsData || {}
        item.pluginsData.moduleInfo = mapFileNameToModuleInfo[item.file]
      }
    })

    const makePage = (item, index_item) => {
      return `
    =begin pod :puburl("${item.url}")
    =TITLE ${oneLine(item.meta.name)}
    =SUBTITLE ${oneLine(item.meta.description)}${descriptionBlock(item.meta.description)}
    =useReact {RenderItem} from 'raku-knowledge/components'
    =begin React :component<RenderItem>
    =begin data
    ${JSON.stringify(index_item)}
    =end data
    =end React
 
    
    =end pod
    `
    }
    interface FileInfo {
      file: string
      publishUrl: string
    }

    const chooseRootFile = (files: FileInfo[]): string | null => {
      if (files.length === 0) return null

      return files.sort((a, b) => {
        const pathA = a.file.split('/')
        const pathB = b.file.split('/')

        // First, compare path lengths
        if (pathA.length !== pathB.length) {
          return pathA.length - pathB.length
        }

        // If path lengths are equal, check for README.md
        const isReadmeA = a.file.toLowerCase().endsWith('readme.md')
        const isReadmeB = b.file.toLowerCase().endsWith('readme.md')

        if (isReadmeA && !isReadmeB) return -1
        if (!isReadmeA && isReadmeB) return 1

        // If both or neither are README.md, compare alphabetically
        return a.file.localeCompare(b.file)
      })[0].file
    }
    // A module without documentation gets no page at all, so it stays invisible to
    // search, to the change report and to the mcp server. The registry still knows
    // its name, version, description and where the source lives — enough for a stub.
    const namedPage = /^[A-Za-z][A-Za-z0-9:_.-]*$/
    const documented = new Set(all_mods_pages.map((i: any) => `${i.src}:${i.meta.name}`))

    const makeStubPage = (meta: any, source: string) => {
      const dir = source === 'zef' ? 'zef' : 'all'
      const url = `/mods/${dir}/${meta.name}`
      // 435 registry entries still point at git:// or ssh; those cannot be links.
      // Rewrite what is rewritable, drop the rest — a link must be clickable.
      const rawSrc = String(meta['source-url'] || (meta.support || {}).source || '')
      const httpSrc = rawSrc.startsWith('git://')
        ? 'https://' + rawSrc.slice('git://'.length)
        : rawSrc.startsWith('git@') && rawSrc.includes(':')
          ? 'https://' + rawSrc.slice(4).replace(':', '/')
          : rawSrc
      const src = /^https?:\/\/[^\s"<>]+$/.test(httpSrc) ? httpSrc : ''
      const author = meta.auth || (Array.isArray(meta.authors) ? meta.authors.join(', ') : meta.authors) || ''
      const depends = Array.isArray(meta.depends) ? meta.depends.filter(Boolean) : []
      return `
    =begin pod :puburl("${url}")
    =TITLE ${oneLine(meta.name)}
    =SUBTITLE ${oneLine(meta.description)}${descriptionBlock(meta.description)}

    This module ships no documentation. What the ecosystem registry knows about it:

    =item Version: ${oneLine(meta.version) || 'unknown'}
    =item Source: ${source === 'zef' ? 'zef ecosystem' : 'p6c ecosystem'}${author ? `\n    =item Author: ${oneLine(author)}` : ''}${src ? `\n    =item Repository: L<${oneLine(src)}|${oneLine(src)}>` : ''}${depends.length ? `\n    =item Depends on: ${oneLine(depends.join(', '))}` : ''}

    =end pod
    `
    }

    const stubPages = [
      ...zef_mods.map((m: any) => ({ meta: m, source: 'zef' })),
      ...all_mods.map((m: any) => ({ meta: m, source: 'p6c' })),
    ]
      .filter(({ meta, source }) => meta && meta.name && !documented.has(`${source === 'zef' ? 'zef' : 'all'}:${meta.name}`))
      .filter(({ meta }) => namedPage.test(meta.name))
      .map(({ meta, source }) =>
        processFile(`virtual/stub/${meta.name}.podlite`, makeStubPage(meta, source), 'text/podlite'),
      )
    console.log(`[modPlugin] stub pages for modules without docs: ${stubPages.length}`)

    const modulePages = all_mods_pages.map((item: any) => {
      // get root document for first module page
      const { files } = item as any
      const root_file = chooseRootFile(files)
      const index_item = root_file ? (addedUrls as publishRecord[]).find(i => i.file === root_file) : null
      const mod_item = processFile(`virtual/src/${item.meta.name}.podlite`, makePage(item, index_item), 'text/podlite')
      // add module info to
      mod_item.pluginsData = mod_item.pluginsData || {}
      mod_item.pluginsData.moduleInfo = item
      return mod_item
    })
    console.log('[modPlugin] collect all doc records')
    // collect all doc records
    const controlJson = addedUrls.reduce((acc, item) => {
      acc[item.publishUrl] = item
      return acc
    }, {})

    // const modsData = JSON.stringify({ urls: controlJson });
    const modsInfoData = JSON.stringify({ mods_info })
    const storeFile = `
=begin pod
=for NAME  :id<RAKU_MODS_PLUGIN_DATA>
SITE DATA
=begin data :id<mods-info>
${modsInfoData}
=end data
=end pod    
    `
    const storeDoc = processFile('virtual/raku-mods-data-plugin.podlite', storeFile)

    console.log('[modPlugin] collect all doc records - ok')
    console.log('[modPlugin] fix title')
    // a module file is named with its module; the rest keep the file name as before
    addedUrls.forEach(i => (i.title = moduleFileTitle(i.file, i.title, metaOf.get(i.file))))
    const all = [...recs, ...modulePages]
    all.forEach(
      i =>
        (i.title =
          i.title ||
          (i.file.split('/').pop() || '').replace(/\.\S+$/, '')),
    )
    console.log('finishg modPlugin')
    return [...recs, ...addedUrls, ...modulePages, ...stubPages, storeDoc]
  }

  return [onProcess, onExit]
}

export const docPlugin = ({ rootdir }): PodliteWebPlugin => {
  const docs_state = require('../built/docs-tree.json') //.splice(0, 100);

  const outCtx: PodliteWebPluginContext = {}
  const onExit = ctx => ({ ...ctx, ...outCtx })
  const processNode = (node: PodNode, file: string) => {
    function isRemoteUrl(url: string): boolean {
      try {
        const parsedUrl = new URL(url)
        // any scheme reaches outside; doc: and file: are resolved by the publisher
        return !['doc:', 'file:'].includes(parsedUrl.protocol)
      } catch (error) {
        // If URL parsing fails, assume it's a local path
        return false
      }
    }

    const rules = {
      // we need add prefic to all /doc/ links
      'L<>': node => {
        const { meta, content } = node
        const link = meta ? meta : linkFromText(getTextContentFromNode(content))
        return { ...node, meta: isRemoteUrl(link) ? link : `/doc${link}` }
      },
    }
    return makeInterator(rules)(node, {})
  }
  const onProcess = (recs: publishRecord[]) => {
    // convert all doc: links to file:: links
    const addedUrls = docs_state
      .map(item => {
        const publishUrl = item.file
          .toLowerCase()
          .replace(/^.*?(?=\/doc)/g, '')
          .replace(/\.\S+$/, '')
        const node = processNode(item.node, item.file)
        return { ...item, publishUrl, node }
      })
      .filter(
        i =>
          ![
            //list of files to exclude
            '/doc/announcements',
          ].includes(i.publishUrl),
      )

    console.log(`docPlugin is running: ${rootdir}`)

    // collect all doc records
    const controlJson = addedUrls.reduce((acc, item) => {
      acc[item.publishUrl] = item
      return acc
    }, {})

    // index all docs with kind, subkind, category

    const categoryIndex = addedUrls.reduce((acc, item) => {
      const { node, template, ...attrs } = item
      // get pod node
      const [podnode] = getFromTree(node, 'pod')
      if (podnode) {
        const conf = makeAttrs(podnode, {})
        const kind = conf.getFirstValue('kind')
        const subkind = conf.getFirstValue('subkind')
        const category = conf.getFirstValue('category')
        acc.push({ ...attrs, kind, subkind, category })
      }
      return acc
    }, [])
    const storeFile = `
    =begin pod
    =for NAME  :id<RAKU_DOCS_PLUGIN_DATA>
    SITE DATA
    =begin data :id<control>
    ${JSON.stringify({ urls: controlJson })}
    =end data
    =begin data :id<index-category>
    ${JSON.stringify({ categoryIndex })}
    =end data

    =end pod    
        `
    const storeDoc = processFile('virtual/raku-docs-data-plugin.podlite', storeFile)
    // fills addonsData.seealso depends on kind, subkind, category
    addedUrls.forEach(item => {
      const categoryRec = categoryIndex.find(i => i.publishUrl === item.publishUrl)
      if (categoryRec) {
        const { kind, subkind, category } = categoryRec
        const seeAlso = categoryIndex
          .filter(
            i =>
              i.publishUrl !== item.publishUrl && i.kind === kind && i.subkind === subkind && i.category === category,
          )
          .map(i => {
            return {
              publishUrl: i.publishUrl,
              title: i.title,
              subtitle: i.subtitle,
            }
          })
        if (seeAlso.length > 0) {
          item.pluginsData = item.pluginsData || {}
          item.pluginsData.seeAlso = seeAlso
        }
      }
    })

    return [...recs, ...addedUrls, storeDoc]
  }

  return [onProcess, onExit]
}

export const splitDocAndCode = (doc: publishRecord) => {
  const blocks: PodNode[] = []
  const code: PodNode[] = []
  const processNode = (node: PodNode, srcfile: string) => {
    const rules = {
      ':ambient': node => {
        const { text, location, type } = node
        code.push(text)
      },
      ':block': (node, ctx, interator) => {
        if (node.name === 'root') {
          if (node.content) {
            return interator(node.content, ctx)
          }
          return
        }
        blocks.push(node)
      },
    }
    return makeInterator(rules)(node, {})
  }
  processNode(doc.node, doc.file)
  const getCodePod = text => {
    return `=begin code :lang<raku>
${text}
=end code
`
  }
  const { node } = processFile('src/file2', getCodePod(code.join('\n')), 'text/podlite')
  const root = mkRootBlock({}, [...blocks, node])
  return { ...doc, node: root }
}

export const examplesPlugin = ({ rootdir }): PodliteWebPlugin => {
  const examples_state = require('../built/examples-tree.json')

  const outCtx: PodliteWebPluginContext = {}
  const onExit = ctx => ({ ...ctx, ...outCtx })
  const processNode = (node: PodNode, file: string) => {
    function isRemoteUrl(url: string): boolean {
      try {
        const parsedUrl = new URL(url)
        return ['http:', 'https:'].includes(parsedUrl.protocol)
      } catch (error) {
        // If URL parsing fails, assume it's a local path
        return false
      }
    }

    const rules = {
      // we need add prefic to all /doc/ links
      'L<>': node => {
        const { meta, content } = node
        const link = meta ? meta : getTextContentFromNode(content)
        return { ...node, meta: isRemoteUrl(link) ? meta : `/doc${link}` }
      },
    }
    return makeInterator(rules)(node, {})
  }
  const onProcess = (recs: publishRecord[]) => {
    // convert all doc: links to file:: links
    console.log(`examplesPlugin is running: ${rootdir}`)
    const addedUrls = examples_state.map(item => {
      const publishUrl = item.file.replace(/^work_examples\/categories/g, '/examples')
      return { ...item, publishUrl, node: item.node }
    })
    // process body
    const bodyProcessed = addedUrls.map(item => {
      // skip md files
      if (item.file.endsWith('.md')) return item
      return splitDocAndCode(item)
    })

    // index all docs with kind, subkind, category

    const categoryIndex = bodyProcessed.reduce((acc, item) => {
      const { file, node, template, publishUrl, subtitle, title, ...attrs } = item
      // get pod node
      const category = publishUrl.split(/\//).splice(2, 1).shift()
      const filename = publishUrl.split(/\//).splice(3).shift()
      acc[category] = acc[category] || []
      acc[category].push({
        file,
        publishUrl,
        title,
        category,
        filename,
        subtitle,
      })
      return acc
    }, {})

    const storeFile = `
    =begin pod
    =for NAME  :id<RAKU_EXAMPLES_PLUGIN_DATA>
    SITE DATA
    =begin data :id<examples-index-category>
    ${JSON.stringify({ categoryIndex })}
    =end data

    =end pod    
        `
    const storeDoc = processFile('virtual/raku-examples-data-plugin.podlite', storeFile)
    // fills addonsData.seealso depends on kind, subkind, category
    bodyProcessed.forEach(item => {
      const categoryRec: any[] = Object.values(categoryIndex).find(i =>
        (i as any[]).map(t => t.file).includes(item.file),
      ) as any[]
      if (categoryRec) {
        const seeAlso = categoryRec
          .filter(i => i.publishUrl !== item.publishUrl)
          .map(i => {
            return {
              publishUrl: i.publishUrl,
              title: i.filename,
              subtitle: i.title,
            }
          })
        if (seeAlso.length > 0) {
          item.pluginsData = item.pluginsData || {}
          item.pluginsData.seeAlso = seeAlso
        }
      }
    })
    // fix title
    bodyProcessed.forEach(
      i =>
        (i.title =
          i.title ||
          i.file
            .split('/')
            .pop()
            .replace(/\.\S+$/, '')),
    )
    return [...recs, ...bodyProcessed, storeDoc]
  }

  return [onProcess, onExit]
}

export const plugin = (): PodliteWebPlugin => {
  const outCtx: PodliteWebPluginContext = {}
  const onExit = ctx => ({ ...ctx, ...outCtx })
  const onProcess = (recs: publishRecord[]) => {
    console.log('plugin running1' + CRC32.str('sdsd'))
    return recs
  }

  return [onProcess, onExit]
}

const DESCRIPTION_MAX = 160
// shorter paragraphs are badges, version lines and the like more often than a description
const DESCRIPTION_MIN = 40
// headings are not the text under them, and a comment is not shown at all
const notText = /^(head\d*|TITLE|SUBTITLE|comment)$/

// Cuts on a sentence boundary when one is close enough to the limit, on a word otherwise.
const trimDescription = (text: string): string => {
  if (text.length <= DESCRIPTION_MAX) return text
  const head = text.slice(0, DESCRIPTION_MAX)
  const sentence = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '))
  if (sentence > DESCRIPTION_MAX / 2) return head.slice(0, sentence + 1)
  const word = head.lastIndexOf(' ')
  return (word > 0 ? head.slice(0, word) : head) + '…'
}

// The first paragraph long enough to say something, else the first one at all: where a
// document has no long paragraph, its short first line still beats the title repeated
// (measured on the corpus, 17.10.2026). The text comes from the rendered node: `text` on a
// para is the raw source in a pod file and the literal word "text" in a Markdown one.
export const describeNode = (root: unknown): string => {
  const paras: string[] = []
  const walk = (node: any) => {
    if (!node) return
    if (Array.isArray(node)) return node.forEach(walk)
    if (typeof node !== 'object') return
    if (node.type === 'block' && notText.test(node.name)) return
    if (node.type === 'para') {
      const text = getTextContentFromNode(node).replace(/\s+/g, ' ').trim()
      if (text) paras.push(text)
      return
    }
    walk(node.content)
  }
  walk(root)
  return trimDescription(paras.find(p => p.length >= DESCRIPTION_MIN) || paras[0] || '')
}

// A record without a description of its own gets one from its text; with none to take,
// it gets none, and the engine writes its own fallback.
export const fillDescriptionPlugin = ({ rootdir }): PodliteWebPlugin => {
  const outCtx: PodliteWebPluginContext = {}
  const onExit = ctx => ({ ...ctx, ...outCtx })
  const onProcess = (recs: publishRecord[]) =>
    recs.map(item => {
      if (item.description) return item
      const text = describeNode(item.node)
      return text ? { ...item, description: mkBlock({ name: 'para' }, [text]) } : item
    })
  return [onProcess, onExit]
}

const makePlugins = ({ rootdir }) => {
  const makeDocPlugin: PluginConfig = {
    plugin: docPlugin({ rootdir }),
    includePatterns: '.*',
  }
  const makeModsPlugin: PluginConfig = {
    plugin: modPlugin({ rootdir }),
    includePatterns: '.*',
  }
  const makeExamplesPlugin: PluginConfig = {
    plugin: examplesPlugin({ rootdir }),
    includePatterns: '.*',
  }
    const makeFillDescriptionPlugin: PluginConfig = {
        plugin: fillDescriptionPlugin({ rootdir }),
        includePatterns: '.*',
    }

  return composePlugins([makeDocPlugin, makeModsPlugin, makeExamplesPlugin,makeFillDescriptionPlugin ], {})
  //   return composePlugins([makeDocPlugin, makeExamplesPlugin], {});
}

export default makePlugins
