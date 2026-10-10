import { moduleFileTitle } from '../src'

const meta = (provides: Record<string, string>) => ({ provides })

describe('the title of a module file page', () => {
  it('names a README by its module', () => {
    expect(moduleFileTitle('work_mods/zef/Tinky/Tinky-0.1.5/README.md', undefined)).toBe('Tinky — README')
  })

  it('names code by the package its module provides from that path', () => {
    const m = meta({ 'BSON::ObjectId': 'lib/BSON/ObjectId.rakumod' })
    expect(moduleFileTitle('work_mods/zef/BSON/lib/BSON/ObjectId.rakumod', undefined, m)).toBe('BSON::ObjectId')
  })

  it('reads a version directory before lib', () => {
    const m = meta({ 'CSS::PageBox': 'lib/CSS/PageBox.rakumod' })
    expect(moduleFileTitle('work_mods/zef/CSS::Properties/CSS-Properties-0.10.9/lib/CSS/PageBox.rakumod', '', m)).toBe(
      'CSS::Properties — CSS::PageBox',
    )
  })

  it('keeps the module in front of a package that does not start with its name', () => {
    const m = meta({ 'HTTP::Message::P6W': 'lib/HTTP/Message/P6W.pm6' })
    expect(moduleFileTitle('work_mods/all/Crust/lib/HTTP/Message/P6W.pm6', undefined, m)).toBe('Crust — HTTP::Message::P6W')
  })

  it('compares the start by whole parts and without case', () => {
    expect(moduleFileTitle('work_mods/zef/Net::Osc/lib/Net/OSC/X.rakumod', undefined, meta({ 'Net::OSC::X': 'lib/Net/OSC/X.rakumod' }))).toBe(
      'Net::OSC::X',
    )
    expect(moduleFileTitle('work_mods/zef/Net/lib/Network.rakumod', undefined, meta({ Network: 'lib/Network.rakumod' }))).toBe(
      'Net — Network',
    )
  })

  it('takes the adverbs off a provided name', () => {
    expect(moduleFileTitle('work_mods/zef/RKDS/lib/RKDS.rakumod', undefined, meta({ 'RKDS:api<2>': 'lib/RKDS.rakumod' }))).toBe('RKDS')
  })

  it('names code by its path when several packages claim it', () => {
    const m = meta({ 'A::Channel': 'lib/A/Channel.rakumod', 'A::Channel::ButReal': 'lib/A/Channel.rakumod' })
    expect(moduleFileTitle('work_mods/all/A/lib/A/Channel.rakumod', undefined, m)).toBe('A — lib/A/Channel.rakumod')
  })

  it('names code by its path when no package claims it', () => {
    expect(moduleFileTitle('work_mods/all/Crust/lib/Crust/Handler.pod', undefined, meta({}))).toBe('Crust — lib/Crust/Handler.pod')
    expect(moduleFileTitle('work_mods/all/Crust/lib/Crust/Handler.pod', undefined)).toBe('Crust — lib/Crust/Handler.pod')
  })

  it('treats Markdown under lib as any other file', () => {
    expect(moduleFileTitle('work_mods/zef/X/lib/X/notes.md', undefined, meta({ X: 'lib/X/notes.md' }))).toBe('X — notes')
  })

  it("keeps the author's own title", () => {
    expect(moduleFileTitle('work_mods/all/Documentable/docs/Language/cli.pod6', 'Command line interface')).toBe('Command line interface')
  })

  it('replaces an own title that is only the file name again', () => {
    expect(moduleFileTitle('work_mods/zef/X/doc/CHANGELOG.rakudoc', 'Changelog')).toBe('X — CHANGELOG')
    expect(moduleFileTitle('work_mods/zef/X/doc/CHANGELOG.rakudoc', '  CHANGELOG ')).toBe('X — CHANGELOG')
  })

  it('treats a title of spaces as none', () => {
    expect(moduleFileTitle('work_mods/zef/X/README.md', '  \n ')).toBe('X — README')
  })

  it('takes only the last extension off', () => {
    expect(moduleFileTitle('work_mods/zef/MUGS/MUGS-0.1.4/docs/announce/v0.1.3.md', undefined)).toBe('MUGS — v0.1.3')
  })
})
