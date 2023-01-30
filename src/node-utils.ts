import { getFromTree, getTextContentFromNode, makeInterator, PodNode, Text} from "@podlite/schema"
import * as fs from "fs"
import makeAttrs from "pod6/built/helpers/config"
import { getAllArticles, isExistsPubdate,  pubRecord, publishRecord } from "./shared"
import {parseMd} from '@podlite/markdown'

import { podlite as podlite_core } from "podlite"
import { PodliteDocument, mkRootBlock } from "@podlite/schema"

const glob = require("glob")
const pathFs = require("path")

export const getPathToOpen = (filepath, parentDocPath) => {
    const isRemoteReg = new RegExp(/^(https?|ftp):/)
    const isRemote = isRemoteReg.test(filepath)
    if (isRemote) {
      return { isRemote, path: filepath }
    }
    const path = require("path")
    const docDirPath = path.dirname(parentDocPath)
    return {
      isRemote,
      path: path.isAbsolute(filepath)
        ? filepath
        : path.normalize(path.join(docDirPath, filepath)),
    }
}

export const makeLinksMap = (records:publishRecord[]):{[link:string]:string} => {
    const linksMap = { ...Object.fromEntries(records.map(({publishUrl='',file})=>[ pathFs.resolve(getPathToOpen(file, './').path), publishUrl]))}
    return linksMap
}
export const convertFileLinksToUrl = (records:publishRecord[], additinalMap = {}):publishRecord[] => {
    const linksMap = { ...additinalMap, ...makeLinksMap(records)}
    // console.log(JSON.stringify({additinalMap}, null,2))
    const processed = records.map(
        item=>{
        const converter = makeInterator({
            'L<>': (node, ctx, interator) => {
            const {content,meta} = node
            const link = meta ? meta : getTextContentFromNode(content)
            const r = link.match(/file:\s*(?<path>(.+))\s*$/)
            const convertFileToUrl = (filePath) => {
                const {isRemote, path } = getPathToOpen(filePath, item.file)
                if (! linksMap[path]) {
                    console.warn(`Cant link ${path}`)
                }
                return isRemote ? null : linksMap[path]
            }
            const newLink = r?.groups?.path ? convertFileToUrl(r.groups.path) : link
            const newContent:Text = {
                type: 'text',
                value: newLink
            }
            const updated = meta ? { meta : newLink} : {content:newContent}

            return {...node, ...updated}
            },
      })
      const res = converter(item.node, {})
      if (item.description) {
        const description = converter(item.description, {})
        return { ...item, node:res , description}
      }
      return { ...item, node:res }
    })
    return processed
}

export const makeAstFromSrc = (src: string, ext:string) => {
    if (['.md'].includes(ext.toLowerCase())) {
        return parseMd(src)
    } else {
    let podlite = podlite_core({ importPlugins: true }).use({})
    const podMode = ['.pod6'].includes(ext.toLowerCase()) ? 1 : 0
    console.log({podMode})
    let tree = podlite.parse(src,{skipChain: 0, podMode})
    const asAst = podlite.toAstResult(tree).interator as PodliteDocument
    return asAst
    }
}


export function parseFiles(path:string) {
const allFiles = glob
  .sync(path)
  .map((f: any) => {
    const TO_SKIP = ['Sum/CRC.pm6', '/Documentable/Primary.pm6', '/p6-image-png-inflated', '/p6-image-rgba-text', '/p6-image-rgba', '/p6-nqp-eval', '/p6-unicode-gcb']
    if (fs.lstatSync(f).isDirectory() || TO_SKIP.findIndex(value=>f.includes(value)) != -1 ) {
        return 
    }
    const testData = fs.readFileSync(f).toString()
    // get type of file
    const ext = pathFs.extname(f)
    console.log(`process ${f}`)
    const asAst = makeAstFromSrc(testData, ext)
    return {
    pubdate: new Date(),
    type: "page",
    node: asAst,
    file: f,
    puburl: f
    }
  }).flat()
  .filter(Boolean)
  return allFiles
}
// export function parseFiles2(path:string) {
//     let count = 0
// const allFiles = glob
//   .sync(path)
//   .map((f: any) => {
//     count++
//     const testData = fs.readFileSync(f).toString()
//     const asAst = makeAstFromSrc(testData)
//     // now check if tree contains block with :pubdate attribute
//     // '* :pubdate'
//     if (!isExistsPubdate(asAst)) {
//       return
//     }
//     // extract notes

//     const notes: pubRecord[] = getFromTree(asAst, "para")
//       .filter(n => makeAttrs(n, {}).exists("pubdate"))
//       .map((n: PodNode) => {
//         const a_pubdate = makeAttrs(n, {}).getFirstValue("pubdate")
//         // Due to cover some cases whan new Date fail on safari, i.e.
//         // new Date("2022-05-07 10:00:00").getFullYear() -> NaN
//         // convert to ISO 8601 "2022-05-07 10:00:00" -> "2022-05-07T10:00:00"
//         const  pubdate = a_pubdate.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/) ? a_pubdate.replace(" ","T") : a_pubdate

//         return {
//           pubdate,
//           type: "note",
//           node: n,
//           description: n,
//           file: f,
//         }
//       })


//     const articles:pubRecord[]  = getAllArticles([asAst]).map(({...all})=>({...all, file:f}))
//     // note get full posts
//     const pages: pubRecord[] = getFromTree(asAst, "pod")
//       .filter(n => makeAttrs(n, {}).exists("pubdate"))
//       .map((n: PodNode) => {
//         const a_pubdate = makeAttrs(n, {}).getFirstValue("pubdate")
//         // Due to cover some cases whan new Date fail on safari, i.e.
//         // new Date("2022-05-07 10:00:00").getFullYear() -> NaN
//         // convert to ISO 8601 "2022-05-07 10:00:00" -> "2022-05-07T10:00:00"
//         const  pubdate = a_pubdate.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/) ? a_pubdate.replace(" ","T") : a_pubdate
//        return {
//           pubdate,
//           type: "page",
//           node: n,
//           file: f,
//         }
//       })
//     // console.warn(
//     //   ` pages: ${pages.length} articles: ${articles.length}, notes: ${notes.length} from ${f}`
//     // )
//     return [...pages, ...articles, ...notes].map(item => {
//       return { ...item, file: f }
//     })
//   }).flat()
//   .filter(Boolean)
//   return allFiles
// }