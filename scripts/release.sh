#!/bin/bash
set -euo pipefail

# raku-knowledge-base code release
# Usage: ./scripts/release.sh [patch|minor|major] [--dry-run]
#
# Forked from podlite-web/scripts/release.sh. A code release here marks a version
# and moves the changelog; it ships no artefact. The site archive belongs to the
# dated data release, which the delivery on the host picks up on its own.

REPO=zag/raku-knowledge-base
BRANCH=main

LEVEL=patch
DRY_RUN=""
for arg in "$@"; do
  case "$arg" in
    patch|minor|major) LEVEL="$arg" ;;
    --dry-run) DRY_RUN="--dry-run" ;;
    *) echo "ERROR: unknown argument $arg"; exit 1 ;;
  esac
done
[[ -n "$DRY_RUN" ]] && echo "=== DRY RUN ==="

echo "→ Checking prerequisites..."
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: working tree has uncommitted changes. Commit or stash first."
  exit 1
fi
if [[ "$(git rev-parse --abbrev-ref HEAD)" != "$BRANCH" ]]; then
  echo "ERROR: not on $BRANCH."
  exit 1
fi
if ! command -v gh &> /dev/null; then
  echo "ERROR: gh CLI not found. Install: brew install gh"
  exit 1
fi
# the corporate account has no write access here, and the failure comes late
WHO=$(gh api user --jq .login 2>/dev/null || echo "")
if [[ "$WHO" != "zag" ]]; then
  echo "ERROR: gh is signed in as '${WHO:-nobody}', not zag. Run: gh auth switch --user zag"
  exit 1
fi

echo "→ Checking changelog..."
HAS_UPDATES=$(node scripts/extract-changelog.mjs --update --dry-run 2>&1 | grep -c "Would update" || true)
if [[ "$HAS_UPDATES" == "0" ]]; then
  echo "ERROR: no Upcoming changelog entries. Write the changelog first."
  exit 1
fi

CURRENT=$(node -e "console.log(require('./package.json').version)")
if [[ -n "$DRY_RUN" ]]; then
  echo ""
  echo "would bump $CURRENT by $LEVEL, move Upcoming into the new section,"
  echo "commit, tag, push to $BRANCH, and create the release on $REPO"
  exit 0
fi

# tests run before anything is written: a failure here used to leave the version
# bumped and the changelog moved, and that had to be undone by hand
echo "→ Running tests..."
yarn test

echo "→ Bumping version ($LEVEL)..."
npm version "$LEVEL" --no-git-tag-version

echo "→ Updating changelog..."
node scripts/extract-changelog.mjs --update

TAG="v$(node -e "console.log(require('./package.json').version)")"

echo "→ Committing $TAG..."
git add -A
git commit -m "release: ${TAG}"
git tag "$TAG"
git push origin "$BRANCH"
git push origin "$TAG"

echo "Tag ${TAG} pushed. The release workflow builds the notes and publishes it."
echo "Watch: gh run list --repo ${REPO}"
