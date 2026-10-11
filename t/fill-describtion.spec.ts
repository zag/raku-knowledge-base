import { publishRecord } from '@podlite/publisher'
import { processFile } from '@podlite/publisher/lib/node-utils'
import { getTextContentFromNode } from '@podlite/schema'
import { fillDescriptionPlugin } from '../src'

// the plugin as the build runs it: records from the publisher, the description it leaves
const describe1 = (file: string, text: string, mime: 'text/podlite' | 'text/markdown' = 'text/podlite') => {
  const [onProcess] = fillDescriptionPlugin({ rootdir: '.' }) as any
  const [rec] = onProcess([processFile(file, text, mime)]) as publishRecord[]
  // the engine shows it with its whitespace folded
  return rec.description ? getTextContentFromNode(rec.description).replace(/\s+/g, ' ').trim() : undefined
}
const md = (text: string) => describe1('work_mods/zef/X/README.md', text, 'text/markdown')
const pod = (text: string) => describe1('work_mods/zef/X/lib/X.rakumod', text)

const LONG = 'This module reads the configuration and keeps it for the whole program.'

describe('the description of a page built from its text', () => {
  // reproduce the defects of the description: each of these failed before the fix
  it('takes the text of a Markdown paragraph, not the word "text"', () => {
    expect(md(`# X\n\n${LONG}\n`)).toBe(LONG)
  })

  it('takes the rendered text of a pod paragraph, not its raw codes', () => {
    expect(pod(`=begin pod\n=head1 DESCRIPTION\n\nL<X::Base> keeps the configuration of B<every> run in one place.\n=end pod\n`)).toBe(
      'X::Base keeps the configuration of every run in one place.',
    )
  })

  it('does not open with the word of a heading', () => {
    const d = pod(`=begin pod\n=head1 NAME\n\nX - short\n\n=head1 SYNOPSIS\n\n=begin code\nuse X;\n=end code\n\n=head1 DESCRIPTION\n\n${LONG}\n=end pod\n`)
    expect(d).toBe(LONG)
  })

  it('leaves a document with no paragraph without a description', () => {
    expect(pod(`=begin pod\n=head1 SYNOPSIS\n\n=begin code\nuse X;\n=end code\n=end pod\n`)).toBeUndefined()
  })

  it('takes the short first paragraph when there is no long one', () => {
    expect(pod(`=begin pod\n=head1 NAME\n\nX - keeps configuration\n\n=head1 SYNOPSIS\n\n=begin code\nuse X;\n=end code\n=end pod\n`)).toBe(
      'X - keeps configuration',
    )
  })

  it('cuts a long paragraph on a word', () => {
    const d = md(`# X\n\n${'word '.repeat(60)}end\n`) as string
    expect(d.length).toBeLessThanOrEqual(161)
    expect(d.endsWith('word…')).toBe(true)
  })

  it('cuts on a sentence when one ends close to the limit', () => {
    const first = 'A first sentence that runs long enough to pass the middle of the limit, well past eighty characters.'
    // the last sentence that ends within the limit: the first one and the next, not a word more
    expect(md(`# X\n\n${first} ${'More words follow here and here. '.repeat(4)}\n`)).toBe(`${first} More words follow here and here.`)
  })

  it('does not take the text of a comment', () => {
    expect(pod(`=begin pod\n=begin comment\nA note to the author that is long enough to be taken as text.\n=end comment\n\n${LONG}\n=end pod\n`)).toBe(LONG)
  })

  it('drops a bold label that is a heading word, and the heading line repeating it', () => {
    expect(md(`# X\n\n**Description** Distribution to set up Raku Documentation website.\n`)).toBe('Distribution to set up Raku Documentation website.')
    expect(md(`# X\n\n**DESCRIPTION** # DESCRIPTION\nSoftware to collect content files written in Rakudoc.\n`)).toBe(
      'Software to collect content files written in Rakudoc.',
    )
  })

  it('keeps a sentence that only begins with such a word', () => {
    expect(md(`# X\n\nDescription of an AWS Simple Notification Service message.\n`)).toBe('Description of an AWS Simple Notification Service message.')
  })

  it('builds a description where the document gives an empty one', () => {
    expect(pod(`=begin pod\n=begin DESCRIPTION\n=end DESCRIPTION\n\n${LONG}\n=end pod\n`)).toBe(LONG)
  })

  it('does not take the target of an include or the content of a component', () => {
    const page = `=begin pod\n=useReact {ListFiles} from 'raku-knowledge/components'\n=TITLE Language References\n=SUBTITLE Broader explanations of fundamental topics\n\n=begin React :component<ListFiles>\n=include doc:RAKU_DOCS_PLUGIN_DATA#index-category\n=end React\n=end pod\n`
    expect(pod(page)).toBe('Broader explanations of fundamental topics')
  })

  it('does not take the entries of a table of contents', () => {
    const page = `=begin pod\n=TITLE Language References\n=SUBTITLE Broader explanations of fundamental topics\n\n=toc\n\n=head2 Fundamental topics\n=begin React :component<ListFiles>\n=include doc:RAKU_DOCS_PLUGIN_DATA#index-category\n=end React\n=end pod\n`
    expect(pod(page)).toBe('Broader explanations of fundamental topics')
  })

  it('takes the prose a component shows as its children', () => {
    const page = `=begin pod\n=TITLE X\n=SUBTITLE A subtitle\n=begin React :component<ModulePage>\n${LONG}\n=end React\n=end pod\n`
    expect(pod(page)).toBe(LONG)
  })

  it('leaves a page with neither a paragraph nor a subtitle without a description', () => {
    expect(pod(`=begin pod\n=TITLE Documentation\n=begin React :component<IndexAllDocs>\n=include doc:RAKU_DOCS_PLUGIN_DATA#control\n=end React\n=end pod\n`)).toBeUndefined()
  })

  // what already held and must keep holding
  it('keeps a description the document gives itself', () => {
    expect(pod(`=begin pod\n=TITLE X\n=DESCRIPTION Written by the author.\n\n${LONG}\n=end pod\n`)).toBe('Written by the author.')
  })

  it('reads a DESCRIPTION written after a SUBTITLE in an indented page, as a module page carries it', () => {
    const page = `\n    =begin pod :puburl("/mods/zef/X")\n    =TITLE X\n    =SUBTITLE The registry line\n    =DESCRIPTION The registry line\n    =end pod\n    `
    expect(describe1('virtual/src/X.podlite', page)).toBe('The registry line')
  })
})
