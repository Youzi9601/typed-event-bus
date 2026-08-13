import { defineConfig } from 'tsup'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
const version = pkg.version

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: true,
  platform: 'neutral',
  target: 'ES2022',
  outDir: 'dist',
  bundle: true,
  external: [],
  noExternal: [],
  esbuildOptions(options) {
    options.banner = {
      js: `/*! typed-event-bus v${version} | MIT License */`
    }
    // Keep console.debug / console.warn / console.error in the build
    // (debug mode and maxListeners warnings must survive minification).
    options.pure = ['console.log', 'console.info']
    // Shorten internal (underscore-prefixed) class members in the minified
    // output. Runtime behavior is unchanged — this only renames private
    // fields (subscription.ts) whose names are irrelevant to consumers.
    options.mangleProps = /^_/
  }
})