import { defineConfig } from 'tsup'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
const version = pkg.version

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
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
    options.pure = ['console.log', 'console.debug', 'console.warn', 'console.info']
  }
})