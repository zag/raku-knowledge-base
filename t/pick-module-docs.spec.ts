import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'

const script = path.join(__dirname, '..', 'bin', 'pick-module-docs.mjs')

const pick = (files: string[]) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pick-'))
  const module = path.join(root, 'zef', 'Sample')
  for (const file of files) {
    const full = path.join(module, file)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    const text = file.endsWith('.rakumod')
      ? `=begin pod\n=head1 ${file}\nFirst line of ${file} documentation.\nSecond line of ${file} documentation.\nThird line of ${file} documentation.\n=end pod\n`
      : `# ${file}\n\nText of ${file}.\n`
    fs.writeFileSync(full, text)
  }
  const run = spawnSync('node', [script, root], { encoding: 'utf8' })
  expect(run.status).toBe(0)
  return run.stdout
    .split('\0')
    .filter(Boolean)
    .map(file => path.relative(module, file).split(path.sep).join('/'))
    .sort()
}

describe('module files taken for pages', () => {
  it('leaves out fixture directories, a README among them, and keeps a spec directory', () => {
    const taken = pick([
      'README.md',
      'docs/usage.md',
      'spec/01-grammar.md',
      'openspec/plan.md',
      'specs/fixtures/posts/hello.md',
      'resources/fixtures/moduleA/README.md',
      'resources/test_things/multi.pod6',
      't/fixtures/README.md',
      't/README.md',
      't/sample.md',
      'resources/fixtures/Sample.rakumod',
      'lib/Sample.rakumod',
    ])
    expect(taken).toEqual([
      'README.md',
      'docs/usage.md',
      'lib/Sample.rakumod',
      'openspec/plan.md',
      'spec/01-grammar.md',
      't/README.md',
    ])
  })
})
