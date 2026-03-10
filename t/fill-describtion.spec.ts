import { processFile, publishRecord } from '@podlite/publisher'
import {
  getTextContentFromNode,
  makeInterator,
  mkBlock,
  mkRootBlock,
  PodNode,
} from '@podlite/schema'
// import React from 'react'
// import { renderToStaticMarkup } from 'react-dom/server'
import { getFromTree, makeAttrs } from '@podlite/schema'

// const root = { innerHTML: '' }
// function render(jsx) {
//   root.innerHTML = renderToStaticMarkup(jsx)
//   return root.innerHTML
// }

const file1 = `
  =begin pod :kind("Language") :subkind("Language") :category("fundamental")
  =TITLE test
  =SUBTITLE subtitle
  =para test
  asdadasdasd
  adad
  ad
  asdas
  dad
  ad
  asd

  =end pod
`

const file2 = `
=begin pod :kind("Language") :subkind("Language") :category("fundamental")
  =TITLE  test2
  =DESCRIPTION
  This is a description
  =SUBTITLE subtitle2
  =para
  =end pod
`


const tctx = { testing: true }
it('fill description comp: parse', () => {
  const state = [
    processFile('src/file2.podlite', file1, 'text/podlite'),
    processFile('src/file1.podlite', file2, 'text/podlite'),
  ]
  const res = state.map((item) => {
    const { node,description, ...attrs } = item
    if (description) {
        return item
    }
    // get pod node
      const blocks: PodNode[] = []
      const para: PodNode[] = []
      const processNode = (node: PodNode) => {
        const rules = {
          ':para': node => {
            const { text, location, type } = node
            para.push(text)
          },
   
      ':block': (node, ctx, interator) => {
        // ctx.parent = node
        if (node.content) {
          // provess root block content
          return interator(node.content, { ...ctx, parent: node })
        }
          },
        }
        return makeInterator(rules)(node, {})
      }

    const r = processNode(node)

    const new_description = getTextContentFromNode(mkBlock({name:'para'}, para))
    
    return {...item, description: mkBlock({name:'para'},[  new_description.length > 150 ? new_description.substring(0, 150) : new_description])}
  })
  console.log(JSON.stringify(res, null, 2))
//   expect(res).toMatchInlineSnapshot()
})
