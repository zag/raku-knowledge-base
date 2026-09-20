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

## Offline bundle

Each release ships `raku-kb-mcp-offline.tar.gz` — the server plus a prebuilt index, no
site build required. The commands for it, together with what to check afterwards, live
on the knowledge base itself:

**[Connect this knowledge base to your AI assistant](https://raku-knowledge-base.podlite.org/mcp)**

That page is the single source for the bundle route; this file keeps the checkout route
above and the internals below, so the two do not drift apart.

The bundled index is a snapshot taken when the release was cut. To refresh it against a newer corpus, rebuild the site and regenerate the index as described below.

## Tools

Three: `raku_kb_search`, `raku_kb_page`, `raku_kb_sections`. What each takes and
returns is listed on
[Connect this knowledge base to your AI assistant](https://raku-knowledge-base.podlite.org/mcp),
which is the single source for both the bundle route and the tool signatures.

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
