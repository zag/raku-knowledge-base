import { processFile, publishRecord } from '@podlite/publisher'

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
  =end pod
`

const file2 = `
=begin pod :kind("Language") :subkind("Language") :category("fundamental")
  =TITLE  test2
  =SUBTITLE subtitle2
  =para
  =end pod
`

const file3 = `
=for ListFiles :select{kind => 'Language', category => 'fundamental'}
Fundamental topics
`

const tctx = { testing: true }
it('listfiles comp: parse', () => {
  const state = [
    processFile('src/file2.podlite', file1, 'text/podlite'),
    processFile('src/file1.podlite', file2, 'text/podlite'),
  ]
  const res = state.reduce((acc, item) => {
    const { node, ...attrs } = item
    // get pod node
    const [podnode] = getFromTree(node, 'pod')
    if (podnode) {
      const conf = makeAttrs(podnode, {})
      const kind = conf.getFirstValue('kind')
      const subkind = conf.getFirstValue('subkind')
      const category = conf.getFirstValue('category')
      // console.log(JSON.stringify({kind, subkind, category}, null, 2))
      const index = `${kind}-${subkind}-${category}`
      acc[index] = [...(acc[index] || []), { ...attrs, kind, subkind, category }]
    }
    return acc
  }, {})
  expect(res).toMatchInlineSnapshot(`
Object {
  "Language-Language-fundamental": Array [
    Object {
      "author": undefined,
      "category": "fundamental",
      "description": "",
      "file": "src/file2.podlite",
      "footer": "",
      "kind": "Language",
      "pubdate": undefined,
      "publishUrl": undefined,
      "sources": Array [],
      "subkind": "Language",
      "subtitle": "subtitle
",
      "title": "test
",
      "type": "page",
    },
    Object {
      "author": undefined,
      "category": "fundamental",
      "description": "",
      "file": "src/file1.podlite",
      "footer": "",
      "kind": "Language",
      "pubdate": undefined,
      "publishUrl": undefined,
      "sources": Array [],
      "subkind": "Language",
      "subtitle": "subtitle2
",
      "title": "test2
",
      "type": "page",
    },
  ],
}
`)
})
