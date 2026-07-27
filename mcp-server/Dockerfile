FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY bin ./bin
COPY kb-index.json ./kb-index.json

ENTRYPOINT ["node", "bin/raku-kb-mcp.mjs"]
