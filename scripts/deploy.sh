#!/usr/bin/env bash
#
# One-command deploy for Household Hub.
#
# Rebuilds from scratch and publishes the ENTIRE dist/ folder to the gh-pages
# branch (what GitHub Pages serves). Because it always ships the whole build,
# the service worker (sw.js) can never fall out of sync with index.html/assets
# again -- that mismatch is what froze the installed PWA on an old version.
#
# Usage:  npm run deploy
#
set -euo pipefail

# Run from the repo root regardless of where the script is called from.
cd "$(dirname "$0")/.."

echo "==> Building (tsc + vite)..."
npm run build

SHA="$(git rev-parse --short HEAD)"
ORIGIN="$(git remote get-url origin)"

echo "==> Publishing full dist/ to gh-pages (deploy $SHA)..."
cd dist
touch .nojekyll                 # tell GitHub Pages not to run Jekyll
rm -rf .git                     # dist is gitignored; start a throwaway repo
git init -q
git add -A
git commit -q -m "Deploy $SHA"
git push -f "$ORIGIN" HEAD:gh-pages
rm -rf .git

echo "==> Done. Live at https://blakekenzid-afk.github.io/household-hub/"
echo "    (installed PWAs self-heal within a launch or two once the new sw.js is picked up.)"
