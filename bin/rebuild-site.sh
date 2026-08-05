#!/bin/bash
# Full site rebuild: refresh data -> build plugin -> export static zip -> publish.
# Usage:
#   ./bin/rebuild-site.sh              full run, publishes to the cloud sites folder
#   ./bin/rebuild-site.sh --fast       skip data refresh (docs/examples/mods)
#   ./bin/rebuild-site.sh --no-publish build zip, do not copy to sites folder
set -eu
cd "$(dirname "$0")/.."

FAST=0
PUBLISH=1
for a in "$@"; do
  case "$a" in
    --fast) FAST=1 ;;
    --no-publish) PUBLISH=0 ;;
  esac
done

SITES_DIR="$HOME/Sync/cloud/sites/raku-kb"
START=$(date +%s)

if [ "$FAST" = 0 ]; then
  echo "[1/5] docs"
  if [ -d work_doc/.git ]; then git -C work_doc reset --hard -q && git -C work_doc pull -q; else rm -rf work_doc; git clone -q --depth 1 https://github.com/Raku/doc work_doc; fi
  node ./bin/parsesrc.mjs 'work_doc/**/*.rakudoc' > ./built/docs-tree.json 2>/dev/null

  echo "[2/5] examples"
  if [ -d work_examples/.git ]; then git -C work_examples reset --hard -q && git -C work_examples pull -q; else rm -rf work_examples; git clone -q --depth 1 https://github.com/Raku/examples.git work_examples; fi
  node ./bin/parsesrc.mjs 'work_examples/categories/**/*.{pod6,md,rakudoc,rakumod,raku,pm6,pl,pm,p6,pod}' > ./built/examples-tree.json 2>/dev/null

  echo "[3/5] modules"
  ./bin/refresh-mods.sh
else
  echo "[1-3/5] data refresh skipped (--fast)"
fi

echo "[4/5] site export (local podlite-web)"
# Container flow is blocked while package.json carries portal: resolutions
# (host paths do not exist inside docker) — local checkout keeps them valid.
PW="${PODLITE_WEB_DIR:-$HOME/Work/projects/podlite-web}"
if [ ! -d "$PW" ]; then git clone -q https://github.com/podlite/podlite-web "$PW"; fi
REPO="$(pwd -P)"
rm -f index.zip.tmp
# The site must live inside podlite-web as pub/ (the docker flow mounts it there):
# css-modules and loaders only apply within the project root. A symlink keeps the
# portal: resolutions valid. Expanded `yarn export` pipeline: attach rewrites the
# workspace list, so the lockfile must be refreshed before any further yarn command.
(
  cd "$PW"
  # pub is the mount point for the site being built; the demo dir lives in git
  if [ -L pub ]; then
    rm -f pub
  elif [ -d pub ]; then
    [ -d pub.demo ] || cp -R pub pub.demo
    rm -rf pub
  fi
  ln -sfn "$REPO" pub
  yarn install
  yarn attach_path pub
  yarn install
  yarn clean
  mkdir -p built public/assets
  yarn publisher --preset everything -s 'https://raku-knowledge-base.podlite.org' -d ./pub
  yarn build
  yarn makeindex
)
node ./bin/build-kb-index.mjs "$PW/out" mcp-server/kb-index.json

(cd "$PW/out" && zip -qr "$REPO/index.zip.tmp" .)
SIZE=$(wc -c < index.zip.tmp | tr -d ' ')
if [ "$SIZE" -lt 1000000 ]; then
  echo "export too small ($SIZE bytes) — not publishing"; exit 1
fi
mv index.zip.tmp index.zip

echo "[5/5] publish"
if [ "$PUBLISH" = 1 ]; then
  cp index.zip "$SITES_DIR/index.zip"
  DEST="$SITES_DIR/index.zip"
else
  DEST="(skipped)"
fi

TOOK=$(( $(date +%s) - START ))
LINE="$(date +%Y-%m-%dT%H:%M) zip=$(du -h index.zip | cut -f1 | tr -d ' ') took=${TOOK}s publish=$DEST"
echo "$LINE" >> rebuild.log
echo "done: $LINE"
