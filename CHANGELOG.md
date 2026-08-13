# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project structure and configuration
- Core type definitions (EventDefinition, EventNamespace)
- defineEvent, defineEvents API
- createEventBus with registry merging
- emit / emitAsync (sync/async emission)
- on / once / onAll (subscription APIs)
- Subscription lifecycle (unsubscribe, signal)
- Error handling (onError hook, AggregateError)
- Middleware support (bus.use)
- Comprehensive type tests (vitest expectTypeOf)
- Runtime tests (vitest)
- CI/CD pipeline (GitHub Actions)
- Benchmark infrastructure

### Changed
- N/A

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- N/A

---

## [0.1.2] - 2026-08-13

### Security
- Fixed 2 critical CVEs in vitest (CVE-2025-24964, CVE-2026-47429) by upgrading vitest 2.1.4 → 4.1.10
- Fixed 1 high CVE in vite (CVE-2026-53571) and 1 medium CVE (CVE-2026-53632) by upgrading vite 5.4.21 → 8.2.1

### Changed
- Upgraded TypeScript 5.6.3 → 7.0.2 (removed deprecated `downlevelIteration` option)
- Upgraded @biomejs/biome 1.9.4 → 2.5.8 (migrated config to v2 schema via `biome migrate`)
- Upgraded vitest 2.1.4 → 4.1.10
- Upgraded vite 5.4.21 → 8.2.1
- Upgraded @types/node 22.9.0 → 26.2.0
- Upgraded tsup 8.3.5 → 8.5.1
- Upgraded @changesets/cli 2.27.11 → 3.0.0
- Upgraded esbuild 0.24.2 → 0.28.2
- Upgraded @vitest/coverage-v8 2.1.4 → 4.1.10
- Build process: switched from tsup's internal `rollup-plugin-dts` to standalone `tsc --emitDeclarationOnly` for `.d.ts` generation (tsup's bundled dts plugin incompatible with TS 7.x)
- Biome config: updated `noConsole` rule to allow log/debug/warn/error/info, fixed ignore patterns for v2
- Source code: `Object.prototype.hasOwnProperty.call` → `Object.hasOwn`, import reordering via Biome organizeImports

### Fixed
- Fixed unsafe optional chaining in tests/runtime/error.test.ts
- Fixed TypeScript 7.x compatibility (removed `downlevelIteration`, added `declarationDir`)

---

## [0.1.0] - TBD 2026/08/11

### Added
- First public release

---

## Template for future releases

## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes in existing functionality

### Deprecated
- Soon-to-be removed features

### Removed
- Removed features

### Fixed
- Bug fixes

### Security
- Security improvements