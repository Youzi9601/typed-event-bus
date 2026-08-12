import { defineConfig } from 'vitest/config'

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
      '@': '/opt/data/workspace/projects/typed-event-bus/src'
    },
    extensions: ['.ts', '.js', '.json']
  },
  esbuild: {
    target: 'ES2022'
  }
})