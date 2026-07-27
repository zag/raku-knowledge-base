import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { loadCorpus, search, getPage, listSections } from './corpus.mjs'

const SITE = 'https://raku-knowledge-base.podlite.org'

const textResult = text => ({ content: [{ type: 'text', text }] })

export const createServer = (corpus = loadCorpus()) => {
  const server = new McpServer({ name: 'raku-kb', version: '0.1.0' })

  server.registerTool(
    'raku_kb_search',
    {
      title: 'Search the Raku Knowledge Base',
      description:
        'Full-text search across the Raku Knowledge Base (docs, modules, examples). Returns matching pages with url, title, section, and a snippet.',
      inputSchema: {
        query: z.string().describe('Search terms'),
        limit: z.number().int().min(1).max(50).optional().describe('Max results (default 10)'),
      },
    },
    async ({ query, limit }) => {
      const hits = search(corpus, query, limit ?? 10)
      const body = hits.map(h => ({ ...h, url: SITE + h.url }))
      return textResult(JSON.stringify({ count: body.length, results: body }, null, 2))
    },
  )

  server.registerTool(
    'raku_kb_page',
    {
      title: 'Get a Raku Knowledge Base page',
      description:
        'Return the text of one page by its url or path (e.g. "/doc/type/grammar"). Long pages are truncated; fetch the url for the full content.',
      inputSchema: {
        url: z.string().describe('Page url or path'),
      },
    },
    async ({ url }) => {
      const page = getPage(corpus, url)
      if (!page) return textResult(JSON.stringify({ error: 'page not found', url }))
      return textResult(JSON.stringify({ ...page, url: SITE + page.url }, null, 2))
    },
  )

  server.registerTool(
    'raku_kb_sections',
    {
      title: 'List Raku Knowledge Base sections',
      description: 'List the top-level sections of the knowledge base with page counts and a landing url each.',
      inputSchema: {},
    },
    async () => {
      const sections = listSections(corpus).map(s => ({ ...s, url: SITE + s.url }))
      return textResult(JSON.stringify({ sections }, null, 2))
    },
  )

  return server
}
