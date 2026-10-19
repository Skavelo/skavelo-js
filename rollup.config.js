import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import dts from 'rollup-plugin-dts';
import terser from '@rollup/plugin-terser';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const isProduction = process.env.NODE_ENV === 'production';

const externalDeps = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
];
const isExternal = (id) =>
  externalDeps.some((dep) => id === dep || id.startsWith(dep + '/'));

const basePlugins = [
  resolve({ browser: true, preferBuiltins: false }),
  commonjs(),
];

const ts = (outDir) =>
  typescript({ tsconfig: './tsconfig.json', declaration: false, declarationMap: false, outDir });

// Release builds are minified and keep only the /*! notice; development builds stay readable.
const minify = () => terser({ compress: { drop_debugger: true }, format: { comments: /^!/ } });
const minPlugin = isProduction ? minify() : null;

// The source is public under the Elastic License, so the npm builds ship linked source maps for
// debugging. The CDN bundle's map stays unlinked, so visitors' browsers don't fetch it.
const sourcemap = true;
const banner = `/*! Skavelo SDK v${pkg.version} | (c) ${new Date().getFullYear()} Skavelo | Elastic License 2.0 */`;

// The React wrapper imports the SDK by relative path while developing; in the build it points at the
// published @skavelo/sdk instead of bundling a second copy of it.
const sdkImport = /(^|\/)src\/(index|types)(\.ts)?$/;
// The SDK itself is external by its package name, which sdkAsPackage resolves its source files to.
const reactExternal = (id) => isExternal(id) || id === '@skavelo/sdk';
const sdkAsPackage = () => ({
  name: 'sdk-as-package',
  resolveId: (source) => (sdkImport.test(source) ? { id: '@skavelo/sdk', external: true } : null),
});

// The package is "type": "module", so Node would read the CommonJS builds as ES modules and fail on
// require(). A package.json in each cjs folder tells Node they're CommonJS.
const commonjsMarker = () => ({
  name: 'commonjs-marker',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'package.json', source: '{ "type": "commonjs" }\n' });
  },
});

/** @type {import('rollup').RollupOptions[]} */
export default [
  // ESM build (tree-shakable)
  {
    input: 'src/index.ts',
    output: {
      dir: 'dist/esm',
      format: 'es',
      sourcemap,
      banner,
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: '[name].js',
    },
    external: isExternal,
    plugins: [
      ...basePlugins,
      ts('dist/esm'),
      ...(minPlugin ? [minPlugin] : []),
    ],
  },
  // CJS build
  {
    input: 'src/index.ts',
    output: {
      dir: 'dist/cjs',
      format: 'cjs',
      sourcemap,
      banner,
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: '[name].js',
      exports: 'named',
    },
    external: isExternal,
    plugins: [
      commonjsMarker(),
      ...basePlugins,
      ts('dist/cjs'),
      ...(minPlugin ? [minPlugin] : []),
    ],
  },
  // The script-tag loader, published as skavelo.js. It loads the widget from its versioned address
  // (published as <version>/skavelo.js); while developing, from skavelo.min.js next to it.
  {
    input: 'src/loader.ts',
    output: { file: 'dist/skavelo.js', format: 'iife', banner },
    plugins: [
      {
        name: 'bundle-path',
        transform: (code, id) =>
          id.endsWith('src/loader.ts')
            ? code.replace(/__SK_BUNDLE__/g, JSON.stringify(isProduction ? `${pkg.version}/skavelo.js` : 'skavelo.min.js'))
            : null,
      },
      ts('dist'),
      minify(),
    ],
  },
  // IIFE bundle for CDN script tag usage
  {
    input: 'src/cdn.ts',
    output: {
      file: 'dist/skavelo.min.js',
      format: 'iife',
      name: 'Skavelo',
      exports: 'default',
      sourcemap: 'hidden',
      banner,
    },
    plugins: [
      ...basePlugins,
      ts('dist'),
      minify(),
    ],
  },
  // Type declarations
  {
    input: 'src/index.ts',
    output: [
      { dir: 'dist/types', preserveModules: true, preserveModulesRoot: 'src' },
      { dir: 'dist/cjs', preserveModules: true, preserveModulesRoot: 'src' },
    ],
    external: isExternal,
    plugins: [dts({ compilerOptions: { outDir: 'dist/types' } })],
  },

  // ─── React package ─────────────────────────────────────────────────────────

  // React ESM
  {
    input: 'packages/react/src/index.tsx',
    output: {
      dir: 'packages/react/dist/esm',
      format: 'es',
      sourcemap,
      banner,
      preserveModules: true,
      preserveModulesRoot: 'packages/react/src',
      entryFileNames: '[name].js',
    },
    external: reactExternal,
    plugins: [
      sdkAsPackage(),
      ...basePlugins,
      ts('packages/react/dist/esm'),
      ...(minPlugin ? [minPlugin] : []),
    ],
  },
  // React CJS
  {
    input: 'packages/react/src/index.tsx',
    output: {
      dir: 'packages/react/dist/cjs',
      format: 'cjs',
      sourcemap,
      banner,
      preserveModules: true,
      preserveModulesRoot: 'packages/react/src',
      entryFileNames: '[name].js',
      exports: 'named',
    },
    external: reactExternal,
    plugins: [
      sdkAsPackage(),
      commonjsMarker(),
      ...basePlugins,
      ts('packages/react/dist/cjs'),
      ...(minPlugin ? [minPlugin] : []),
    ],
  },
  // React type declarations
  {
    input: 'packages/react/src/index.tsx',
    output: [
      { dir: 'packages/react/dist/types', preserveModules: true, preserveModulesRoot: 'packages/react/src' },
      { dir: 'packages/react/dist/cjs', preserveModules: true, preserveModulesRoot: 'packages/react/src' },
    ],
    external: reactExternal,
    plugins: [sdkAsPackage(), dts({ compilerOptions: { outDir: 'packages/react/dist/types' } })],
  },
];
