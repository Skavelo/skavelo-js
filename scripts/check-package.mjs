// Runs before every publish. Fails if the npm package would contain things that don't belong in it
// (raw TypeScript other than type declarations, tests, the playground or build scripts), or if a
// file it points to is missing. 0.1.0 shipped with both of these broken:
// - the CommonJS builds need a package.json saying "type": "commonjs", or Node reads them as ES
//   modules and require() fails;
// - the React builds must import the SDK as "@skavelo/sdk", never by a relative path.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { encoding: 'utf8' }));
const files = pack.files.map((f) => f.path);

const forbidden = files.filter((f) =>
  (/\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts'))
  || /(^|\/)(src|test|tests|playground|scripts)\//.test(f)
  || /\.(test|spec)\./.test(f),
);

const minified = files
  .filter((f) => f.endsWith('.js'))
  .filter((f) => {
    const code = readFileSync(f, 'utf8');
    // Minified files have long lines and no leftover comments apart from the /*! notice.
    return /\/\/ |\/\*\*/.test(code.replace(/\/\*![\s\S]*?\*\//g, ''));
  });

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

// Every file package.json's exports point to must be in the package.
const targets = [];
const collect = (v) => (typeof v === 'string' ? targets.push(v.replace(/^\.\//, '')) : Object.values(v).forEach(collect));
collect(pkg.exports);
const missing = targets.filter((t) => !files.includes(t));

const cjsDirs = [...new Set(files.filter((f) => /(^|\/)cjs\/[^/]+\.js$/.test(f)).map((f) => f.slice(0, f.lastIndexOf('/'))))];
const unmarked = cjsDirs.filter((d) => {
  try {
    return JSON.parse(readFileSync(`${d}/package.json`, 'utf8')).type !== 'commonjs';
  } catch {
    return true;
  }
});

const relativeSdk = files
  .filter((f) => f.startsWith('packages/react/') && /\.(js|d\.ts)$/.test(f))
  .filter((f) => /["'](\.{1,2}\/)+(@skavelo\/sdk|src\/)/.test(readFileSync(f, 'utf8')));

const problems = [
  ...missing.map((t) => `exports points to ${t}, which isn't in the package`),
  ...unmarked.map((d) => `${d} has no package.json with "type": "commonjs", so require() would fail`),
  ...relativeSdk.map((f) => `${f} imports the SDK by a relative path; it must import "@skavelo/sdk"`),
  ...forbidden.map((f) => `would publish ${f}`),
  ...minified.slice(0, 5).map((f) => `not minified (comments left in): ${f}; build with npm run build:release`),
  ...(pkg.license !== 'Elastic-2.0' ? [`license is ${pkg.license}; it should be Elastic-2.0`] : []),
  ...(!files.includes('LICENSE.md') ? ['LICENSE.md is missing from the package'] : []),
];

if (problems.length) {
  console.error(`\nPackage check failed:\n  ${problems.join('\n  ')}\n`);
  process.exit(1);
}
console.log(`Package check passed: ${files.length} files.`);
