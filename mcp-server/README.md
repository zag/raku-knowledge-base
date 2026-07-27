# raku-kb-mcp

MCP server that exposes the [Raku Knowledge Base](https://raku-knowledge-base.podlite.org) to AI agents and editors: search the corpus, fetch a page, list sections.

## Connect

The server reads a prebuilt search index (`kb-index.json`, see below), so point it at one before connecting.

Claude Code:

```sh
claude mcp add raku-kb -- node /path/to/raku-knowledge/mcp-server/bin/raku-kb-mcp.mjs
```

Or in an MCP client config:

```json
{
  "mcpServers": {
    "raku-kb": {
      "command": "node",
      "args": ["/path/to/raku-knowledge/mcp-server/bin/raku-kb-mcp.mjs"]
    }
  }
}
```

## Tools

| Tool | Input | Output |
|------|-------|--------|
| `raku_kb_search` | `query`, `limit?` | matching pages: `url`, `title`, `section`, `snippet` |
| `raku_kb_page` | `url` (path or full url) | page `text` (+ `truncated` for long pages) |
| `raku_kb_sections` | — | top-level sections with page counts and a landing url |

## Index

The tools serve `kb-index.json` — a lean `{url, title, section, text}` record per page, generated from the built site:

```sh
node ../bin/build-kb-index.mjs <out-dir> ./kb-index.json
```

`../bin/rebuild-site.sh` produces it as part of a full rebuild. Override the path with `RAKU_KB_INDEX`.

## Docker

```sh
docker build -t raku-kb-mcp .
docker run -i --rm raku-kb-mcp
```

The image bundles `kb-index.json`, so build it after the index exists.

## License

Artistic-2.0 (matching the knowledge base).
