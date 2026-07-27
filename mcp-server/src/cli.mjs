import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createServer } from './index.mjs'

createServer()
  .connect(new StdioServerTransport())
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
