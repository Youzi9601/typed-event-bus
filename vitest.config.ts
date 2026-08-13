import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), 'src')

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/runtime/**/*.test.ts'],
    typecheck: {
      include: ['tests/types/**/*.test-d.ts'],
      tsconfig: './tsconfig.json'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'tests/**', 'bench/**', 'scripts/**']
    },
    benchmark: {
      include: ['bench/**/*.bench.ts']
    }
  },
  resolve: {
    alias: {
      '@': srcDir
    },
    extensions: ['.ts', '.js', '.json']
  }
})