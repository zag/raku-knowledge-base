import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'

const SITE = 'https://raku-knowledge-base.podlite.org'
const LINE = `Sitemap: ${SITE}/sitemap.xml`
const script = path.join(__dirname, '..', 'bin', 'robots-sitemap.mjs')
const run = (dir: string) => spawnSync('node', [script, dir, SITE], { encoding: 'utf8' })
const site = (robots?: string, map = true) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'robots-'))
  if (map) fs.writeFileSync(path.join(dir, 'sitemap.xml'), '<urlset/>')
  if (robots !== undefined) fs.writeFileSync(path.join(dir, 'robots.txt'), robots)
  return dir
}
const robots = (dir: string) => fs.readFileSync(path.join(dir, 'robots.txt'), 'utf8')

describe('the Sitemap line of robots.txt', () => {
  it('adds the line to the file the engine ships', () => {
    const dir = site('User-agent: *\nAllow: /\n')
    expect(run(dir).status).toBe(0)
    expect(robots(dir)).toBe(`User-agent: *\nAllow: /\n${LINE}\n`)
  })

  it('adds it once when run again', () => {
    const dir = site('User-agent: *\nAllow: /\n')
    run(dir)
    expect(run(dir).status).toBe(0)
    expect(robots(dir).split(LINE).length - 1).toBe(1)
  })

  it('leaves a file that already names this map as it is', () => {
    const text = `User-agent: *\n${LINE}\nAllow: /\n`
    const dir = site(text)
    expect(run(dir).status).toBe(0)
    expect(robots(dir)).toBe(text)
  })

  it('refuses a file that names another map', () => {
    const dir = site('User-agent: *\nSitemap: https://elsewhere.example/sitemap.xml\n')
    expect(run(dir).status).not.toBe(0)
  })

  it('refuses another map next to this one', () => {
    const dir = site(`${LINE}\nSitemap: https://elsewhere.example/sitemap.xml\n`)
    expect(run(dir).status).not.toBe(0)
  })

  it('refuses to name a map the build did not write', () => {
    const dir = site('User-agent: *\n', false)
    expect(run(dir).status).not.toBe(0)
    expect(robots(dir)).toBe('User-agent: *\n')
  })

  it('keeps the CRLF line endings of a file written with them', () => {
    const dir = site('User-agent: *\r\nAllow: /\r\n')
    run(dir)
    expect(robots(dir)).toBe(`User-agent: *\r\nAllow: /\r\n${LINE}\r\n`)
  })

  it('ends the line of a file without a final newline before adding its own', () => {
    const dir = site('User-agent: *')
    run(dir)
    expect(robots(dir)).toBe(`User-agent: *\n${LINE}\n`)
  })
})
