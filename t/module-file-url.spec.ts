import { keepAddress, moduleFileUrl, realAddresses } from '../src'

describe('module file address', () => {
  it('turns backslashes from a windows archive into forward slashes', () => {
    expect(moduleFileUrl('work_mods/zef/Statistics/dist/docs\\index.md')).toBe(
      '/mods/zef/Statistics/dist/docs/index.md',
    )
    expect(moduleFileUrl('work_mods/zef/Statistics/README.md')).toBe('/mods/zef/Statistics/README.md')
  })

  it('keeps a backslash file when no real path takes its address', () => {
    const items = [{ file: 'work_mods/zef/A/docs\\index.md', publishUrl: '/mods/zef/A/docs/index.md' }]
    expect(items.filter(item => keepAddress(item.file, item.publishUrl, realAddresses(items)))).toEqual(items)
  })

  it('gives the address to the real path when both exist', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    const real = { file: 'work_mods/zef/A/docs/index.md', publishUrl: '/mods/zef/A/docs/index.md' }
    const packed = { file: 'work_mods/zef/A/docs\\index.md', publishUrl: '/mods/zef/A/docs/index.md' }
    const items = [packed, real]
    expect(items.filter(item => keepAddress(item.file, item.publishUrl, realAddresses(items)))).toEqual([real])
    expect(log).toHaveBeenCalledWith(
      '[modPlugin] skipped work_mods/zef/A/docs\\index.md: its address belongs to a file of the same path',
    )
    log.mockRestore()
  })
})
