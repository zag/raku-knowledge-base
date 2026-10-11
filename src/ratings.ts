import { PodliteWebPlugin, publishRecord } from '@podlite/publisher'
import { processFile } from '@podlite/publisher/lib/node-utils'
import * as fs from 'fs'
import * as path from 'path'

type Registry = 'zef' | 'all'

type MeasurementPage = {
  module: string | null
  codeBlocks: number
  usesModule: boolean
  hasOutputBlock: boolean
}

type MeasurementRecord = {
  date: string
  declarations: Record<string, unknown>
  pages: MeasurementPage[]
}

type MissingModule = {
  name: string
  registry: Registry
}

export type ExampleRating = {
  date: string
  modules: number
  withCode: number
  withUse: number
  withOutput: number
  undocumented: number
  missing: MissingModule[]
}

type SelectedRecord = {
  fileName: string
  record: MeasurementRecord
}

type ExampleRatingOptions = {
  rootdir?: string
  projectRoot?: string
}

type RatingListItem = {
  name: string
  url: string | null
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const isDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

const isPublishableName = (name: string): boolean => Boolean(name) && !/[\u0000-\u001f"]/.test(name)

const isMeasurementPage = (value: unknown): value is MeasurementPage => {
  if (!isObject(value)) return false
  return (
    (typeof value.module === 'string' || value.module === null) &&
    typeof value.codeBlocks === 'number' &&
    Number.isInteger(value.codeBlocks) &&
    value.codeBlocks >= 0 &&
    typeof value.usesModule === 'boolean' &&
    typeof value.hasOutputBlock === 'boolean'
  )
}

const isMeasurementRecord = (value: unknown, date: string): value is MeasurementRecord => {
  if (!isObject(value) || value.date !== date) return false
  const declarations = value.declarations
  const pages = value.pages
  if (!isObject(declarations) || !Array.isArray(pages) || pages.length === 0) return false
  if (!pages.every(isMeasurementPage)) return false
  const measurementPages: MeasurementPage[] = pages.filter(isMeasurementPage)
  const declared = rateableModuleNames(declarations, measurementPages)
  return declared.some(({ name, registry }) => measurementPages.some(page => page.module === `${registry}:${name}`))
}

const registryName = (key: string): { registry: Registry; name: string } | null => {
  const separator = key.indexOf(':')
  if (separator < 0) return null
  const registry = key.slice(0, separator)
  const name = key.slice(separator + 1)
  if ((registry !== 'zef' && registry !== 'all') || !isPublishableName(name)) return null
  return { registry, name }
}

const rateableModuleNames = (declarations: Record<string, unknown>, pages: MeasurementPage[]): MissingModule[] => {
  const names = new Map<string, Set<Registry>>()
  const pagesWithModules = new Set(pages.flatMap(page => (page.module === null ? [] : [page.module])))
  for (const key of Object.keys(declarations)) {
    const parsed = registryName(key)
    if (!parsed) continue
    const registries = names.get(parsed.name) || new Set<Registry>()
    registries.add(parsed.registry)
    names.set(parsed.name, registries)
  }
  return [...names].map(([name, registries]) => {
    const registry =
      registries.has('zef') && pagesWithModules.has(`zef:${name}`)
        ? 'zef'
        : registries.has('all') && pagesWithModules.has(`all:${name}`)
          ? 'all'
          : registries.has('zef')
            ? 'zef'
            : 'all'
    return { name, registry }
  })
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error))

const isMissingPathError = (error: unknown): boolean =>
  isObject(error) && (error.code === 'ENOENT' || error.code === 'ENOTDIR')

export const newestRecord = (dir: string): SelectedRecord | null => {
  let files: string[]
  try {
    files = fs
      .readdirSync(dir)
      .filter(file => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
      .sort()
      .reverse()
  } catch (error) {
    if (!isMissingPathError(error)) throw error
    console.log('[codeExamples] no usable corpus record')
    return null
  }

  for (const fileName of files) {
    const date = fileName.slice(0, -5)
    if (!isDate(date)) {
      console.log(`[codeExamples] record ${fileName} is unusable: filename is not a date`)
      continue
    }

    try {
      const value: unknown = JSON.parse(fs.readFileSync(path.join(dir, fileName), 'utf8'))
      if (isMeasurementRecord(value, date)) return { fileName, record: value }
      console.log(`[codeExamples] record ${fileName} is unusable: invalid measurement shape`)
    } catch (error) {
      console.log(`[codeExamples] record ${fileName} is unusable: ${errorText(error)}`)
    }
  }

  console.log('[codeExamples] no usable corpus record')
  return null
}

export const rateExamples = (record: MeasurementRecord): ExampleRating => {
  const pages = new Map<string, MeasurementPage[]>()
  for (const page of record.pages) {
    if (page.module === null) continue
    const existing = pages.get(page.module) || []
    existing.push(page)
    pages.set(page.module, existing)
  }

  const declared = rateableModuleNames(record.declarations, record.pages)
  const modulePages = declared.flatMap(({ name, registry }) => {
    const found = pages.get(`${registry}:${name}`)
    return found ? [{ name, registry, pages: found }] : []
  })
  const withCode = modulePages.filter(module => module.pages.some(page => page.codeBlocks > 0)).length
  const withUse = modulePages.filter(module => module.pages.some(page => page.usesModule)).length
  const withOutput = modulePages.filter(module => module.pages.some(page => page.hasOutputBlock)).length
  const missing = modulePages
    .filter(module => !module.pages.some(page => page.codeBlocks > 0))
    .map(({ name, registry }) => ({ name, registry }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))

  return {
    date: record.date,
    modules: modulePages.length,
    withCode,
    withUse,
    withOutput,
    undocumented: declared.filter(({ name, registry }) => !pages.has(`${registry}:${name}`)).length,
    missing,
  }
}

const isModuleInfo = (value: unknown): value is { meta: { name: string }; url: string } => {
  if (!isObject(value) || !isObject(value.meta)) return false
  return typeof value.meta.name === 'string' && typeof value.url === 'string'
}

const modulePageUrls = (records: publishRecord[]): Map<string, string> => {
  const urls = new Map<string, string>()
  for (const record of records) {
    const pluginsData: unknown = record.pluginsData
    if (!isObject(pluginsData) || !isModuleInfo(pluginsData.moduleInfo)) continue
    const { name } = pluginsData.moduleInfo.meta
    if (!urls.has(name)) urls.set(name, pluginsData.moduleInfo.url)
  }
  return urls
}

const pageItems = (rating: ExampleRating, urls: Map<string, string>): RatingListItem[] =>
  rating.missing.map(({ name }) => ({ name, url: urls.get(name) || null }))

const corpusDate = (projectRoot: string): string | null => {
  const file = path.join(projectRoot, 'corpus-manifest.json')
  let text: string
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch (error) {
    if (isMissingPathError(error)) return null
    throw error
  }

  try {
    const value: unknown = JSON.parse(text)
    if (isObject(value) && isDate(value.date)) return value.date
    console.log('[codeExamples] corpus date unavailable: invalid corpus-manifest.json')
    return null
  } catch (error) {
    console.log(`[codeExamples] corpus date unavailable: ${errorText(error)}`)
    return null
  }
}

const percentage = (count: number, total: number): string => ((count / total) * 100).toFixed(1)

const pageText = (rating: ExampleRating | null, dataDate: string | null, items: RatingListItem[]): string => {
  const description =
    '=DESCRIPTION Which modules have a code block in their documentation, counted from the newest measurement.'
  const header = `=begin pod :puburl("/mods/code-examples")
=TITLE Code blocks in module documentation
${description}
`

  if (!rating) {
    return `${header}
This build has no measurement, so the page shows no numbers.
${dataDate ? `\nSite data date: ${dataDate}.\n` : ''}

=end pod
`
  }

  const listJson = JSON.stringify(items)
  const mismatch =
    dataDate && dataDate !== rating.date
      ? `\nSite data date: ${dataDate}. The numbers on this page come from the measurement.\n`
      : ''
  return `${header}
Measurement date: ${rating.date}.
${mismatch}
The measurement recorded documentation files for ${rating.modules} modules. At least one file had a code block for ${rating.withCode} modules (${percentage(rating.withCode, rating.modules)}%). A code block had a C<use> line for ${rating.withUse} modules (${percentage(rating.withUse, rating.modules)}%). A file had an output block for ${rating.withOutput} modules (${percentage(rating.withOutput, rating.modules)}%). The ecosystem registries listed ${rating.undocumented} more modules with no documentation files in this measurement.

A code block is counted as written. Nothing here was run. A block of shell commands counts too.

The measurement and the data used to build this site may differ in date and in which files they include.

=head2 Modules with documentation and no code block yet
In this measurement, these modules had documentation files but no code block.
If you know one of them, a short example is a welcome contribution.

=useReact {ModulesWithoutCode} from 'raku-knowledge/components'
=begin React :component<ModulesWithoutCode>
=begin data
${listJson}
=end data
=end React

=end pod
`
}

const projectRootFor = (options: ExampleRatingOptions): string => {
  if (options.projectRoot) return options.projectRoot
  if (typeof __dirname !== 'undefined') return path.join(__dirname, '..')
  throw new Error('projectRoot is required when __dirname is unavailable')
}

export const exampleRatingPlugin = (options: ExampleRatingOptions): PodliteWebPlugin => {
  const projectRoot = projectRootFor(options)
  const recordsDir = path.join(projectRoot, 'snapshots', 'corpus')
  const onProcess = (records: publishRecord[]) => {
    const selected = newestRecord(recordsDir)
    const dataDate = corpusDate(projectRoot)
    const rating = selected ? rateExamples(selected.record) : null
    const urls = modulePageUrls(records)

    if (selected) {
      if (dataDate && dataDate !== selected.record.date) {
        console.log(`[codeExamples] record ${selected.record.date} is not the corpus date ${dataDate}`)
      } else {
        console.log(`[codeExamples] record ${selected.fileName}, corpus ${dataDate || 'unknown'}`)
      }
    }

    const page = processFile(
      'virtual/ratings/code-examples.podlite',
      pageText(rating, dataDate, rating ? pageItems(rating, urls) : []),
      'text/podlite',
    )
    return [...records, page]
  }
  const onExit = context => context
  return [onProcess, onExit]
}
