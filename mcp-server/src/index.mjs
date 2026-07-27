import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { loadCorpus, search } from './corpus.mjs'

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

  return server
}
