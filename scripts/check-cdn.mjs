// Checks that what cdn.skavelo.com serves is exactly what this repo builds for the current version.
// Every customer's site runs this file, so a change nobody published is the first sign of a
// compromised Cloudflare account or bucket. Run after each publish, and on a schedule:
//   pnpm build:release && pnpm check:cdn
// CDN_WAIT_SECONDS=0 skips the wait, for a scheduled check long after a release.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const base = process.env.SKAVELO_CDN_URL ?? 'https://cdn.skavelo.com';
const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const sri = (buf) => `sha384-${createHash('sha384').update(buf).digest('base64')}`;

const files = [
  ['skavelo.js', 'dist/skavelo.js'],
  [`${version}/skavelo.js`, 'dist/skavelo.min.js'],
];
// The loader at the bare address is cached for up to 5 minutes, so right after a release it can
// still be the previous one. Only that file is checked again, every 30 seconds for up to 6 minutes;
// the versioned file never changes once published, so a difference there fails at once.
const WAIT_MS = Number(process.env.CDN_WAIT_SECONDS ?? 360) * 1000;
const fingerprint = async (remote) => {
  const res = await fetch(`${base}/${remote}`, { cache: 'no-store' });
  return res.ok ? sri(Buffer.from(await res.arrayBuffer())) : `HTTP ${res.status}`;
};
let failed = false;
for (const [remote, local] of files) {
  const want = sri(readFileSync(new URL(`../${local}`, import.meta.url)));
  let got = await fingerprint(remote);
  const deadline = Date.now() + (remote === 'skavelo.js' ? WAIT_MS : 0);
  while (got !== want && Date.now() < deadline) {
    console.log(`wait ${remote} still differs, likely the cache; checking again in 30 seconds`);
    await new Promise((r) => setTimeout(r, 30_000));
    got = await fingerprint(remote);
  }
  const ok = got === want;
  failed ||= !ok;
  console.log(`${ok ? 'ok  ' : 'DIFF'} ${remote}\n     built   ${want}\n     served  ${got}`);
}
if (failed) {
  console.error('\nThe CDN serves something this build did not produce. If no release just went out, treat it as an incident: check the bucket and the Cloudflare audit log.');
  process.exit(1);
}
