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
const reactExternal = (id) => isExternal(id) || sdkImport.test(id);
const reactPaths = (id) => (sdkImport.test(id) ? '@skavelo/sdk' : id);

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
      ...basePlugins,
      ts('dist/cjs'),
      ...(minPlugin ? [minPlugin] : []),
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
    output: { dir: 'dist/types', preserveModules: true, preserveModulesRoot: 'src' },
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
      paths: reactPaths,
    },
    external: reactExternal,
    plugins: [
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
      paths: reactPaths,
    },
    external: reactExternal,
    plugins: [
      ...basePlugins,
      ts('packages/react/dist/cjs'),
      ...(minPlugin ? [minPlugin] : []),
    ],
  },
  // React type declarations
  {
    input: 'packages/react/src/index.tsx',
    output: {
      dir: 'packages/react/dist/types',
      preserveModules: true,
      preserveModulesRoot: 'packages/react/src',
      paths: reactPaths,
    },
    external: reactExternal,
    plugins: [dts({ compilerOptions: { outDir: 'packages/react/dist/types' } })],
  },
];
