import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'

// A count alone misleads: a block used 2704 times may live in one module.
// Every tally therefore carries how many files and how many modules it touched.
const bump = (table, key, file, module) => {
  const cell = table[key] || (table[key] = { n: 0, files: new Set(), modules: new Set() })
  cell.n++
  cell.files.add(file)
  if (module) cell.modules.add(module)
  return cell
}

const settle = table =>
  Object.fromEntries(
    Object.entries(table)
      .map(([key, cell]) => [
        key,
        { n: cell.n, files: cell.files.size, modules: cell.modules.size, ...(cell.values && { values: cell.values }) },
      ])
      .sort((a, b) => b[1].n - a[1].n),
  )

// work_mods/<registry>/<module>/... — anything else has no module to speak of
const moduleOf = file => {
  const parts = String(file || '').split('/')
  return parts[0] === 'work_mods' && parts.length > 2 ? `${parts[1]}:${parts[2]}` : null
}

const textOf = node => {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (node && typeof node === 'object') {
    if (typeof node.value === 'string') return node.value
    return textOf(node.content)
  }
  return ''
}

// the parser writes block config two ways: a list of {name, value} descriptors,
// and a plain hash. Both appear in the same corpus.
const attrEntries = config => {
  if (Array.isArray(config)) return config.filter(e => e && e.name).map(e => [e.name, e.value])
  if (config && typeof config === 'object') return Object.entries(config)
  return []
}

const linkTarget = node => {
  const meta = node.meta
  if (typeof meta === 'string' && meta) return meta
  if (meta && typeof meta === 'object' && typeof meta.value === 'string') return meta.value
  return textOf(node.content)
}

export function makeCollector({ selectionRulePath } = {}) {
  const blocks = {}
  const codes = {}
  const attrs = {}
  const pages = []
  const errors = []

  const walk = (node, file, module, page) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const child of node) walk(child, file, module, page)
      return
    }
    const { type, name } = node
    if (type === 'fcode' && name) {
      bump(codes, name, file, module)
      if (name === 'L') page.links.push(linkTarget(node))
    } else if (name && name !== 'root') {
      bump(blocks, name, file, module)
      if (name === 'head') page.headings.push(node.level ?? 1)
      if (name === 'code') {
        const line = node.location?.start?.line
        if (line && (page.firstCodeLine === null || line < page.firstCodeLine)) page.firstCodeLine = line
        page.codeBlocks++
        if (/^\s*use\s+\S/m.test(textOf(node.content))) page.usesModule = true
      }
      // an example that shows what it prints reads differently from one that does not
      if (name === 'output') page.hasOutputBlock = true
    }
    for (const [key, value] of attrEntries(node.config)) {
      const cell = bump(attrs, key, file, module)
      if (typeof value === 'string') {
        cell.values = cell.values || {}
        cell.values[value] = (cell.values[value] || 0) + 1
      }
    }
    walk(node.content, file, module, page)
    // link targets carry their own nodes, and codes inside them count too
    if (node.meta && typeof node.meta === 'object') walk(node.meta, file, module, page)
  }

  return {
    add(record) {
      const file = record?.file
      if (!file || !record.node) return
      const module = moduleOf(file)
      const page = { file, module, headings: [], codeBlocks: 0, firstCodeLine: null, usesModule: false, hasOutputBlock: false, links: [] }
      walk(record.node, file, module, page)
      walk(record.description, file, module, page)
      pages.push(page)
    },
    fail(file, reason) {
      errors.push({ file, reason: String(reason && reason.message ? reason.message : reason || 'unknown') })
    },
    report(extra = {}) {
      return {
        conditions: {
          host: os.hostname(),
          selectionRule: selectionRulePath ? fingerprint(selectionRulePath) : null,
          readmeOverlap: Number(process.env.RAKU_KB_README_OVERLAP ?? 0.4),
          minPodLines: Number(process.env.RAKU_KB_MIN_POD_LINES ?? 4),
          ...extra,
        },
        totals: { pages: pages.length, errors: errors.length },
        census: { blocks: settle(blocks), codes: settle(codes), attrs: settle(attrs) },
        pages,
        errors,
      }
    },
  }
}

function fingerprint(file) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16)
  } catch {
    return null
  }
}

export function writeReport(destination, report) {
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.writeFileSync(destination, JSON.stringify(report))
}
