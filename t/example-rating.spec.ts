import fs from 'fs'
import os from 'os'
import path from 'path'
import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import { getFromTree, getTextContentFromNode } from '@podlite/schema'
import { publishRecord } from '@podlite/publisher'
import { processFile } from '@podlite/publisher/lib/node-utils'
import { ModulesWithoutCode } from '../src/components'
import { exampleRatingPlugin, newestRecord, rateExamples } from '../src/ratings'

type TestPage = {
  module: string | null
  codeBlocks: number
  usesModule: boolean
  hasOutputBlock: boolean
}

type TestRecord = {
  date: string
  declarations: Record<string, unknown>
  pages: TestPage[]
}

let dir: string

const page = (module: string | null, codeBlocks = 0, usesModule = false, hasOutputBlock = false): TestPage => ({
  module,
  codeBlocks,
  usesModule,
  hasOutputBlock,
})

const record = (date: string, declarations: Record<string, unknown>, pages: TestPage[]): TestRecord => ({
  date,
  declarations,
  pages,
})

const expectMutationToFail = <T>(assertion: (value: T) => void, mutated: T) => {
  expect(() => assertion(mutated)).toThrow()
}

const writeRecord = (fileName: string, value: unknown) =>
  fs.writeFileSync(path.join(dir, 'snapshots', 'corpus', fileName), JSON.stringify(value))

const writeMeasurement = (fileName: string, value: unknown) => {
  const recordsDir = path.join(dir, 'snapshots', 'corpus')
  fs.mkdirSync(recordsDir, { recursive: true })
  writeRecord(fileName, value)
}

const generatedPage = (extraRecords: publishRecord[] = []) => {
  const [onProcess] = exampleRatingPlugin({ projectRoot: dir })
  return onProcess(extraRecords)
}

const pageText = (item: { node: Parameters<typeof getTextContentFromNode>[0] }) => getTextContentFromNode(item.node)

const isObjectValue = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const expectNoMeasurementContent = (item: publishRecord) => {
  const text = pageText(item)
  expect(text).not.toContain('The measurement recorded documentation files for')
  expect(text).not.toContain('%')
  expect(text).not.toContain('Measurement date:')
  expect(text).not.toContain('Modules with documentation and no code block yet')
  expect(getFromTree(item.node, 'React')).toHaveLength(0)
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'example-rating-'))
})

afterEach(() => {
  jest.restoreAllMocks()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('rateExamples', () => {
  it('uses the zef copy instead of combining registries', () => {
    const rating = rateExamples(
      record('2026-10-01', { 'all:A': {}, 'zef:A': {} }, [page('all:A', 1, true, true), page('zef:A')]),
    )

    const expected = {
      modules: 1,
      withCode: 0,
      withUse: 0,
      withOutput: 0,
      missing: [{ name: 'A', registry: 'zef' }],
    }
    const assertRating = (value: unknown) => expect(value).toMatchObject(expected)
    assertRating(rating)
    expectMutationToFail(assertRating, { ...expected, withCode: 1, missing: [] })
  })

  it('uses the all copy when only that declared copy has pages', () => {
    const rating = rateExamples(record('2026-10-01', { 'zef:A': {}, 'all:A': {} }, [page('all:A', 1)]))
    expect(rating).toMatchObject({
      modules: 1,
      withCode: 1,
      undocumented: 0,
      missing: [],
    })
  })

  it('counts each feature on any page independently', () => {
    for (const pages of [
      [page('zef:A', 0, false, true), page('zef:A', 1, true, false)],
      [page('zef:A', 1, true, false), page('zef:A', 0, false, true)],
    ]) {
      const expected = {
        modules: 1,
        withCode: 1,
        withUse: 1,
        withOutput: 1,
        missing: [],
      }
      const assertRating = (value: unknown) => expect(value).toMatchObject(expected)
      assertRating(rateExamples(record('2026-10-01', { 'zef:A': {} }, pages)))
      expectMutationToFail(assertRating, { ...expected, withOutput: 0 })
    }
  })

  it('excludes pages without declarations', () => {
    const expected = { modules: 1, withCode: 0, missing: [{ name: 'C', registry: 'zef' }] }
    const assertRating = (value: unknown) => expect(value).toMatchObject(expected)
    assertRating(rateExamples(record('2026-10-01', { 'zef:C': {} }, [page('zef:B', 1), page('zef:C')])))
    expectMutationToFail(assertRating, { modules: 2, withCode: 1, missing: [{ name: 'C', registry: 'zef' }] })
  })

  it('excludes names the site cannot publish', () => {
    const expected = { modules: 1, withCode: 0, missing: [{ name: 'Ok', registry: 'zef' }] }
    const assertRating = (value: unknown) => expect(value).toMatchObject(expected)
    assertRating(
      rateExamples(
        record('2026-10-01', { 'zef:Ok': {}, 'zef:Bad"Name': {}, 'zef:Bad\u0001Name': {} }, [
          page('zef:Ok'),
          page('zef:Bad"Name', 1),
          page('zef:Bad\u0001Name', 1),
        ]),
      ),
    )
    expectMutationToFail(assertRating, {
      modules: 3,
      withCode: 2,
      missing: [
        { name: 'Ok', registry: 'zef' },
        { name: 'Bad"Name', registry: 'zef' },
        { name: 'Bad\u0001Name', registry: 'zef' },
      ],
    })
  })

  it('counts undocumented names after collapsing registries', () => {
    const expected = { modules: 1, undocumented: 1 }
    const assertRating = (value: unknown) => expect(value).toMatchObject(expected)
    assertRating(rateExamples(record('2026-10-01', { 'zef:D': {}, 'all:D': {}, 'zef:E': {} }, [page('zef:E')])))
    expectMutationToFail(assertRating, { modules: 1, undocumented: 2 })
  })

  it('sorts missing names from the generated page and renders hard names as text', () => {
    const names = ['b', 'A', 'Foo::<b>Foo', 'Raku doc', "Acme::Don't", 'A|B', 'A&B']
    const declarations = Object.fromEntries(names.map(name => [`zef:${name}`, {}]))
    writeMeasurement(
      '2026-10-01.json',
      record(
        '2026-10-01',
        declarations,
        names.map(name => page(`zef:${name}`)),
      ),
    )
    const [item] = generatedPage().slice(-1)
    const [reactNode] = getFromTree(item.node, 'React')
    const dataNode = getFromTree(reactNode, 'data')[0]
    const data: unknown = JSON.parse(getTextContentFromNode(dataNode))
    const isRatingItem = (value: unknown): value is { name: string; url: string | null } =>
      isObjectValue(value) && typeof value.name === 'string' && (typeof value.url === 'string' || value.url === null)
    expect(Array.isArray(data) && data.every(isRatingItem)).toBe(true)
    const items = Array.isArray(data) ? data.filter(isRatingItem) : []
    const orderedNames = items.map(({ name }) => name)
    const expected = ['A', 'A&B', 'A|B', "Acme::Don't", 'b', 'Foo::<b>Foo', 'Raku doc']
    const assertOrder = (value: unknown) => expect(value).toEqual(expected)
    assertOrder(orderedNames)
    expectMutationToFail(assertOrder, [...orderedNames].reverse())

    const html = ReactDOMServer.renderToString(
      React.createElement(ModulesWithoutCode, { getThisNode: () => reactNode }),
    )
    expect(html).toContain('data-pagefind-ignore=""')
    expect(html).toContain('<li>Foo::&lt;b&gt;Foo</li>')
    expect(html).toContain('<li>A&amp;B</li>')
    expect(html).toContain('<li>Acme::Don&#x27;t</li>')
    expect(html).toContain('<li>Raku doc</li>')
    expect(html).not.toContain('<b>Foo</b>')
    expect(items.every(({ url }) => url === null)).toBe(true)
  })
})

describe('newestRecord', () => {
  it('chooses the newest usable date filename', () => {
    writeMeasurement('2026-09-11.json', record('2026-09-11', { 'zef:A': {} }, [page('zef:A')]))
    writeMeasurement('2026-10-01.json', record('2026-10-01', { 'zef:B': {}, 'all:B': {} }, [page('all:B', 1)]))
    writeMeasurement('notes.json', record('2026-12-01', { 'zef:C': {} }, [page('zef:C')]))

    const selected = newestRecord(path.join(dir, 'snapshots', 'corpus'))?.fileName
    const assertNewest = (value: unknown) => expect(value).toBe('2026-10-01.json')
    assertNewest(selected)
    expectMutationToFail(assertNewest, '2026-09-11.json')
  })

  it('skips invalid measurement shapes and records the reason', () => {
    const older = record('2026-09-11', { 'zef:A': {} }, [page('zef:A')])
    writeMeasurement('2026-09-11.json', older)
    const invalid: Array<[string, unknown]> = [
      ['2026-10-01.json', older],
      ['2026-10-02.json', { date: '2026-10-02', pages: [page('zef:A')] }],
      ['2026-10-03.json', { date: '2026-10-03', declarations: [], pages: [page('zef:A')] }],
      ['2026-10-04.json', { date: '2026-10-04', declarations: null, pages: [page('zef:A')] }],
      ['2026-10-05.json', { ...older, date: '2026-10-05', pages: [] }],
      [
        '2026-10-06.json',
        {
          ...older,
          date: '2026-10-06',
          pages: [{ module: 'zef:A', codeBlocks: '1', usesModule: false, hasOutputBlock: false }],
        },
      ],
      ['2026-10-07.json', { ...older, date: '2026-10-07', pages: [page(null)] }],
      ['2026-10-08.json', { ...older, date: '2026-10-08', pages: [null] }],
      ['2026-10-09.json', { ...older, date: '2026-10-09', pages: [page('zef:A'), null] }],
    ]
    for (const [fileName, value] of invalid) writeMeasurement(fileName, value)
    fs.writeFileSync(path.join(dir, 'snapshots', 'corpus', '2026-10-10.json'), '{')
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})

    const selected = newestRecord(path.join(dir, 'snapshots', 'corpus'))?.fileName
    const assertFallback = (value: unknown) => expect(value).toBe('2026-09-11.json')
    assertFallback(selected)
    expectMutationToFail(assertFallback, '2026-10-09.json')
    const output = log.mock.calls.map(args => args.join(' ')).join('\n')
    for (const [fileName] of invalid) expect(output).toContain(fileName)
    expect(output).toContain('2026-10-10.json')
  })

  it('returns null for an absent or empty directory', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    expect(newestRecord(path.join(dir, 'missing'))).toBeNull()
    const empty = path.join(dir, 'empty')
    fs.mkdirSync(empty)
    expect(newestRecord(empty)).toBeNull()
    expect(log).toHaveBeenCalledWith('[codeExamples] no usable corpus record')
  })
})

describe('exampleRatingPlugin page states', () => {
  const sample = record('2026-10-01', { 'zef:A': {}, 'zef:B': {} }, [page('zef:A'), page('zef:B', 1)])

  it('links from the module index as a paragraph', () => {
    const text = fs.readFileSync(path.join(__dirname, '..', 'mods', 'index.podlite'), 'utf8')
    expect(text).toContain('=para L<Which modules have a code block in their documentation|/mods/code-examples>')
    expect(text).not.toContain('=head2 L<Code blocks in module documentation|/mods/code-examples>')
  })

  it('publishes the measurement and matching or unknown data date', () => {
    writeMeasurement('2026-10-01.json', sample)
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    const generated = generatedPage()
    const [item] = generated.slice(-1)
    expect(item.publishUrl).toBe('/mods/code-examples')
    expect(String(item.title).trim()).toBe('Code blocks in module documentation')
    expect(generated.filter(record => record.publishUrl === '/mods/code-examples')).toHaveLength(1)
    expect(pageText(item)).toContain('Measurement date: 2026-10-01.')
    expect(pageText(item)).toContain(
      'The measurement recorded documentation files for 2 modules. At least one file had a code block for 1 modules (50.0%).',
    )
    expect(pageText(item)).toContain('A code block had a use line for 0 modules (0.0%).')
    expect(pageText(item)).toContain(
      'A file had an output block for 0 modules (0.0%). The ecosystem registries listed 0 more modules with no documentation files in this measurement.',
    )
    expect(pageText(item)).toContain(
      'The measurement and the data used to build this site may differ in date and in which files they include.',
    )
    expect(pageText(item)).not.toContain('Site data date:')
    expect(item.description ? getTextContentFromNode(item.description).replace(/\s+/g, ' ').trim() : '').toBe(
      'Which modules have a code block in their documentation, counted from the newest measurement.',
    )
    expect(log).toHaveBeenCalledWith('[codeExamples] record 2026-10-01.json, corpus unknown')
    // the engine renders a component only when the page imports it
    const imports = getFromTree(item.node, 'useReact').map(node => JSON.stringify(node))
    expect(
      imports.some(node => node.includes('ModulesWithoutCode') && node.includes('raku-knowledge/components')),
    ).toBe(true)

    fs.writeFileSync(path.join(dir, 'corpus-manifest.json'), JSON.stringify({ date: '2026-10-01' }))
    expect(pageText(generatedPage().slice(-1)[0])).not.toContain('Site data date:')
  })

  it('reports an older or newer record against the data date', () => {
    writeMeasurement('2026-10-01.json', sample)
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    for (const dataDate of ['2026-09-11', '2026-11-01']) {
      fs.writeFileSync(path.join(dir, 'corpus-manifest.json'), JSON.stringify({ date: dataDate }))
      const [item] = generatedPage().slice(-1)
      const sentence = `Site data date: ${dataDate}. The numbers on this page come from the measurement.`
      expect(pageText(item)).toContain(sentence)
      expect(log).toHaveBeenCalledWith(`[codeExamples] record 2026-10-01 is not the corpus date ${dataDate}`)
      expectMutationToFail((text: unknown) => expect(text).toContain(sentence), pageText(item).replace(sentence, ''))
    }
  })

  it('links only modules with built documentation pages', () => {
    const listing = record('2026-10-01', { 'zef:A': {}, 'zef:B': {}, 'zef:C': {} }, [
      page('zef:A'),
      page('zef:B'),
      page('zef:C'),
    ])
    writeMeasurement('2026-10-01.json', listing)
    const first = processFile('virtual/a.podlite', '=begin pod\n=end pod', 'text/podlite')
    const second = processFile('virtual/b.podlite', '=begin pod\n=end pod', 'text/podlite')
    Object.assign(first, {
      pluginsData: { moduleInfo: { meta: { name: 'A' }, url: '/mods/zef/A' } },
    })
    Object.assign(second, {
      pluginsData: { moduleInfo: { meta: { name: 'B' }, url: '/mods/all/B' } },
    })
    const [item] = generatedPage([first, second]).slice(-1)
    const [reactNode] = getFromTree(item.node, 'React')
    const html = ReactDOMServer.renderToString(
      React.createElement(ModulesWithoutCode, { getThisNode: () => reactNode }),
    )

    const assertLinks = (value: unknown) => {
      expect(value).toContain('<a href="/mods/zef/A">A</a>')
      expect(value).toContain('<a href="/mods/all/B">B</a>')
      expect(value).not.toContain('href="/mods/zef/C"')
      expect(value).toContain('<li>C</li>')
    }
    assertLinks(html)
    expectMutationToFail(
      assertLinks,
      '<ul><li><a href="/mods/zef/A">A</a></li><li><a href="/mods/zef/B">B</a></li></ul>',
    )

    const [withoutPages] = generatedPage().slice(-1)
    const [withoutPagesReact] = getFromTree(withoutPages.node, 'React')
    const withoutPagesHtml = ReactDOMServer.renderToString(
      React.createElement(ModulesWithoutCode, { getThisNode: () => withoutPagesReact }),
    )
    expect(withoutPagesHtml).toContain('<li>A</li>')
    expect(withoutPagesHtml).not.toContain('<a ')
  })

  it('shows no numbers without a measurement and includes a known data date', () => {
    fs.writeFileSync(path.join(dir, 'corpus-manifest.json'), JSON.stringify({ date: '2026-11-01' }))
    const [item] = generatedPage().slice(-1)
    expect(item.publishUrl).toBe('/mods/code-examples')
    expect(pageText(item)).toContain('This build has no measurement, so the page shows no numbers.')
    expect(pageText(item)).toContain('Site data date: 2026-11-01.')
    expectNoMeasurementContent(item)
  })

  it('shows no numbers or data date when neither is available', () => {
    const generated = generatedPage()
    const [item] = generated.slice(-1)
    expect(pageText(item)).toContain('This build has no measurement, so the page shows no numbers.')
    expect(pageText(item)).not.toContain('Site data date:')
    expect(generated.filter(record => record.publishUrl === '/mods/code-examples')).toHaveLength(1)
    expectNoMeasurementContent(item)
  })

  it('omits retired words in every page state', () => {
    writeMeasurement('2026-10-01.json', sample)
    const states = [pageText(generatedPage().slice(-1)[0])]

    fs.writeFileSync(path.join(dir, 'corpus-manifest.json'), JSON.stringify({ date: '2026-11-01' }))
    states.push(pageText(generatedPage().slice(-1)[0]))

    fs.rmSync(path.join(dir, 'snapshots'), { recursive: true, force: true })
    fs.rmSync(path.join(dir, 'corpus-manifest.json'), { force: true })
    states.push(pageText(generatedPage().slice(-1)[0]))

    fs.writeFileSync(path.join(dir, 'corpus-manifest.json'), JSON.stringify({ date: '2026-11-01' }))
    states.push(pageText(generatedPage().slice(-1)[0]))

    const assertNoRetiredWords = (texts: string[]) => {
      for (const text of texts) {
        for (const word of ['corpus', 'AI assistant', 'runnable', 'works']) {
          expect(text).not.toContain(word)
        }
      }
    }
    assertNoRetiredWords(states)
    expectMutationToFail(assertNoRetiredWords, [...states.slice(0, 3), `${states[3]} works`])
  })
})
