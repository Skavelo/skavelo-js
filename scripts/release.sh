#!/usr/bin/env bash
# Publishes one version everywhere, so npm and cdn.skavelo.com never drift apart:
#   1. checks the version in package.json isn't on npm or the CDN yet;
#   2. npm publish (builds and runs the package checks first; may ask for a one-time code);
#   3. publish-cdn.sh (uploads <version>/skavelo.js, then points the skavelo.js loader at it).
# If the npm step fails, nothing reaches the CDN. Raise the version in package.json before each release.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="$(node -p "require('./package.json').version")"
BUCKET="${R2_CDN_BUCKET:-skavelo-cdn}"

if npm view "@skavelo/sdk@$VERSION" version >/dev/null 2>&1; then
  echo "@skavelo/sdk $VERSION is already on npm. Raise the version in package.json first." >&2
  exit 1
fi
if npx --yes wrangler r2 object get "$BUCKET/$VERSION/skavelo.js" --remote --pipe >/dev/null 2>&1; then
  echo "$VERSION is already on the CDN but not on npm. Publish it to npm with: npm publish --access public" >&2
  exit 1
fi

echo "Releasing $VERSION to npm, then the CDN."
npm publish --access public
bash scripts/publish-cdn.sh
echo "Released $VERSION: npm and cdn.skavelo.com are both on $VERSION."
