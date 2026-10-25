// Checks that what cdn.skavelo.com serves is exactly what this repo builds for the current version.
// Every customer's site runs this file, so a change nobody published is the first sign of a
// compromised Cloudflare account or bucket. Run after each publish, and on a schedule:
//   pnpm build:release && pnpm check:cdn
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const base = process.env.SKAVELO_CDN_URL ?? 'https://cdn.skavelo.com';
const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const sri = (buf) => `sha384-${createHash('sha384').update(buf).digest('base64')}`;

const files = [
  ['skavelo.js', 'dist/skavelo.js'],
  [`${version}/skavelo.js`, 'dist/skavelo.min.js'],
];
let failed = false;
for (const [remote, local] of files) {
  const want = sri(readFileSync(new URL(`../${local}`, import.meta.url)));
  const res = await fetch(`${base}/${remote}`, { cache: 'no-store' });
  const got = res.ok ? sri(Buffer.from(await res.arrayBuffer())) : `HTTP ${res.status}`;
  const ok = got === want;
  failed ||= !ok;
  console.log(`${ok ? 'ok  ' : 'DIFF'} ${remote}\n     built   ${want}\n     served  ${got}`);
}
if (failed) {
  console.error('\nThe CDN serves something this build did not produce. If no release just went out, treat it as an incident: check the bucket and the Cloudflare audit log.');
  process.exit(1);
}
