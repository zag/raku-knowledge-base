import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import { parseAuthor, depLabel, RakuModuleInfo } from '../src/components'

describe('module meta tolerant rendering', () => {
  it('parses a nested-array authors entry without throwing', () => {
    expect(parseAuthor(['Jonathan Worthington', 'Raku Community']).name).toBe('Jonathan Worthington, Raku Community')
    expect(parseAuthor('Samuel Young <samyoung12788@gmail.com>').name).toBe('Samuel Young')
  })

  it('labels an alternative-dependency hash instead of rendering an object', () => {
    expect(depLabel('File::Temp')).toBe('File::Temp')
    expect(depLabel({ any: ['elinks:from<bin>', 'links:from<bin>'] })).toBe('any: elinks:from<bin>, links:from<bin>')
  })

  it('renders module info with wild meta shapes without throwing', () => {
    const data = {
      src: 'zef',
      files: [],
      meta: {
        name: 'X',
        version: '1',
        description: 'd',
        authors: [['Jonathan Worthington', 'Raku Community']] as any,
        license: 'Artistic-2.0',
        depends: ['File::Temp', { any: ['elinks:from<bin>', 'links:from<bin>'] }] as any,
        'test-depends': ['Test'],
        provides: {},
      },
    }
    const html = ReactDOMServer.renderToString(React.createElement(RakuModuleInfo, { data: data as any }))
    expect(html).toContain('Jonathan Worthington')
    expect(html).toContain('any: elinks')
  })
})
