// Runs before every publish. Fails if the npm package would contain things that don't belong in it:
// raw TypeScript (other than type declarations), tests, the playground or build scripts.
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
const problems = [
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
