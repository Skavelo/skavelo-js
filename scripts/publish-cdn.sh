#!/usr/bin/env bash
# Publishes the widget to Cloudflare R2, which serves it at cdn.skavelo.com.
#   <version>/skavelo.js  the widget itself. Never changes once published, so browsers keep it for
#                         a year. Each publish needs a new version in package.json.
#   skavelo.js            the 1 KB loader the install snippet uses. It loads <version>/skavelo.js,
#                         so a new release reaches every site within minutes. Cached for 5 minutes,
#                         and served from the browser's copy while it checks for a new one.
# Keep the loader and the widget compatible with existing installs. A breaking change would go out
# as v2/skavelo.js.
# Needs wrangler logged in (npx wrangler login) and the bucket bound to the cdn.skavelo.com domain.
set -euo pipefail
cd "$(dirname "$0")/.."

BUCKET="${R2_CDN_BUCKET:-skavelo-cdn}"
VERSION="$(node -p "require('./package.json').version")"

# A published version is cached for a year; replacing it would leave browsers with mixed copies.
if npx --yes wrangler r2 object get "$BUCKET/$VERSION/skavelo.js" --remote --pipe >/dev/null 2>&1; then
  echo "Version $VERSION is already published. Raise the version in package.json, then publish again." >&2
  exit 1
fi

pnpm build:release
put() {
  npx --yes wrangler r2 object put "$BUCKET/$1" --file "$2" --remote \
    --content-type "application/javascript; charset=utf-8" --cache-control "$3"
}
# The widget first, so the loader never points to a version that isn't there yet.
put "$VERSION/skavelo.js" "dist/skavelo.min.js" "public, max-age=31536000, immutable"
put "skavelo.js" "dist/skavelo.js" "public, max-age=300, stale-while-revalidate=86400"
echo "Published $VERSION to $BUCKET: skavelo.js now loads $VERSION/skavelo.js"
# For customers who pin a version: the integrity value for <script integrity="..."> on $VERSION.
echo "Integrity for $VERSION/skavelo.js: sha384-$(openssl dgst -sha384 -binary dist/skavelo.min.js | openssl base64 -A)"
# Confirms the CDN now serves exactly these files.
node scripts/check-cdn.mjs || true
