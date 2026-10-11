import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import { getFromTree } from '@podlite/schema'
import { processFile } from '@podlite/publisher/lib/node-utils'
import { ListMods } from '../src/components'

const modsInfo = {
  mods_info: {
    zef: { 'Acme::Cow': { url: '/mods/zef/Acme::Cow', meta: { description: 'Talking barnyard animals' } } },
    all: { 'Acme::Cow': { url: '/mods/all/Acme::Cow', meta: { description: 'Talking barnyard animals' } } },
  },
}

const render = () => {
  const { node } = processFile(
    'virtual/list-mods.podlite',
    `=begin pod\n=begin React :component<ListMods>\n=begin data\n${JSON.stringify(modsInfo)}\n=end data\n=end React\n=end pod\n`,
    'text/podlite',
  )
  const [reactNode] = getFromTree(node, 'React')
  return ReactDOMServer.renderToString(
    React.createElement(ListMods, {
      id: 'mods',
      children: null,
      item: {},
      renderNode: () => null,
      getThisNode: () => reactNode,
    }),
  )
}

describe('ListMods', () => {
  it('links the description to the module page, like the name', () => {
    const html = render()
    expect(html).toContain('<a href="/mods/zef/Acme::Cow">Talking barnyard animals</a>')
    expect(html).not.toContain('href="/mods/Acme::Cow"')
  })
})
