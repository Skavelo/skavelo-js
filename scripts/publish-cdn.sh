#!/usr/bin/env bash
# Uploads the widget bundle to Cloudflare R2, which serves it at cdn.skavelo.com.
#   skavelo.js            always the latest, cached for 5 minutes (what the install snippet uses)
#   <version>/skavelo.js  never changes, cached for a year (for anyone who wants to pin a version)
# Keep skavelo.js compatible with existing installs. A breaking change would go out as v2/skavelo.js.
# Needs wrangler logged in (npx wrangler login) and the bucket bound to the cdn.skavelo.com domain.
set -euo pipefail
cd "$(dirname "$0")/.."

BUCKET="${R2_CDN_BUCKET:-skavelo-cdn}"
VERSION="$(node -p "require('./package.json').version")"
FILE="dist/skavelo.min.js"

pnpm build:release
put() {
  npx --yes wrangler r2 object put "$BUCKET/$1" --file "$FILE" --remote \
    --content-type "application/javascript; charset=utf-8" --cache-control "$2"
}
put "$VERSION/skavelo.js" "public, max-age=31536000, immutable"
put "skavelo.js" "public, max-age=300"
echo "Published $VERSION to $BUCKET"
