# Contributing Guide

Thanks for your interest in contributing to `typed-event-bus`! This guide will help you get started.

## Before You Begin, Please Read

- [Code of Conduct](CODE_OF_CONDUCT.md)

## Development Environment Setup

### Requirements

- Node.js >= 20.0.0 (recommended: 22 LTS)
- pnpm >= 9.0.0
- TypeScript >= 5.0.0

### Install and Start

```bash
# Clone the project
git clone https://github.com/Youzi9601/typed-event-bus.git
cd typed-event-bus

# Install dependencies
pnpm install

# Dev mode (watch mode)
pnpm dev

# Run tests
pnpm test

# Type check
pnpm test:types

# Code lint and format
pnpm lint
pnpm format

# Build
pnpm build
```

## Project Structure

```
src/
├── bus.ts                  # createEventBus factory function (main entry)
├── constants.ts            # internal metadata keys + meta event definitions (newListenerEvent, removeListenerEvent)
├── bus/
│   ├── context.ts          # BusContext - internal state (listeners, middlewares, options, registry)
│   ├── emit.ts             # sync emit (fire-and-forget)
│   ├── emit-async.ts       # async emit (await all, aggregates MultiError)
│   ├── on.ts               # subscribe (sync/async/prepend), newListener meta event
│   ├── on-all.ts           # wildcard with correlation narrowing
│   ├── once.ts             # subscribe once
│   ├── off.ts              # unsubscribe single (lastIndexOf semantics, removeListener meta event)
│   └── utils.ts            # runListeners, emitMetaEvent, listenerCount, eventNames, rawListeners, removeAllListeners, use
├── define.ts               # defineEvent (builder chain), defineEvents, type guards
├── subscription.ts         # EventSubscription class, createSubscription
├── types.ts                # Core type definitions
├── middleware.ts           # Middleware types and execution logic
├── errors.ts               # MultiError, defaultErrorHandler
└── index.ts                # Public API exports

tests/
├── runtime/        # Vitest runtime tests
└── types/          # Vitest type tests (*.test-d.ts)

bench/              # Benchmark tests
scripts/            # CI helper scripts
```

## Contribution Workflow

### 1. Find or Create an Issue

- All changes should correspond to an Issue
- Bug reports use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.yml)
- Feature suggestions use the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.yml)

### 2. Create a Branch

```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

Branch naming convention:
- `feat/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Refactoring
- `test/` - Test additions
- `chore/` - Miscellaneous maintenance

### 3. Develop and Test

**Core principles:**
- **Types first**: Write type tests first (`tests/types/*.test-d.ts`), then implement runtime
- **Zero dependencies**: Core package `dependencies` must remain empty
- **Bundle size**: After every change verify `pnpm build && node scripts/check-budget.js` ≤ 3072 bytes (CI gate, checks both `dist/index.js` and `dist/index.cjs`)

**Required checks:**
```bash
pnpm lint           # Biome lint + format
pnpm test:types     # Type tests 100% pass
pnpm test           # Runtime tests pass (coverage target > 95%, manual check via pnpm exec vitest run --coverage)
pnpm build          # Build success
```

### 4. Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Type reference:**

| Type | Purpose |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation update |
| `refactor` | Refactor (no functional changes) |
| `test` | Test addition/modification |
| `perf` | Performance optimization |
| `chore` | Build process, dependency updates, etc. |
| `ci` | CI/CD changes |

**Example:**
```
feat(bus): add emitAsync for async listener support

- Add emitAsync method that awaits all async listeners
- MultiError collects all listener errors
- Update type tests for async emission

Closes #42
```

### 5. Open a Pull Request

- PR title follows Conventional Commits
- Fill out the [PR template](.github/PULL_REQUEST_TEMPLATE.md)
- Ensure all CI checks pass
- Wait for maintainer review

## Development Standards

### Type Design Principles

1. **Define Once, Use Everywhere** — EventDefinition is the single source of truth
2. **Type inference over type annotations** — Users should not need to manually annotate generics
3. **Consistency over flexibility** — Don't simultaneously provide string API and typed handle API
4. **Explicit over implicit** — Async behavior, error handling, and lifecycle must all be explicit

### Code Style

- Formatted automatically by Biome (`pnpm format`)
- Strict mode: `noExplicitAny: error`, `noUnusedVariables: error`
- Single quotes, semicolons, trailing commas (es5)
- Prefer `const`, avoid `any`

### Testing Strategy

| Test Type | Location | Command | Requirement |
|-----------|----------|---------|-------------|
| Runtime | `tests/runtime/*.test.ts` | `pnpm test` | Coverage > 95% (manual check) |
| Type-level | `tests/types/*.test-d.ts` | `pnpm test:types` | 100% pass |
| Benchmark | `bench/*.bench.ts` | `pnpm bench` | No regression |

**Type test pattern (Vitest `expectTypeOf`):**
```typescript
// tests/types/emit.test-d.ts
import { expectTypeOf } from 'vitest'
import { defineEvent, createEventBus } from '../src'

const userCreated = defineEvent("user.created").payload<{ id: string }>()
const bus = createEventBus(userCreated)

bus.emit(userCreated, { id: "123" })  // ✅
// @ts-expect-error
bus.emit(userCreated, { id: 123 })    // ❌ Compile error
```

## Release Process

Maintainers only:

```bash
# 1. Create a changeset (records the change)
pnpm changeset

# 2. Consume changesets (bump version, generate CHANGELOG)
pnpm version

# 3. Commit, push, then create a version tag
git tag v<new-version> && git push origin v<new-version>
```

Pushing a `v*` tag triggers the Release workflow (`.github/workflows/release.yml`), which runs `pnpm check` and publishes to npm with provenance (`npm publish --provenance`).

## Getting Help

- Check [existing Issues](https://github.com/Youzi9601/typed-event-bus/issues)
- Open a [Question Issue](.github/ISSUE_TEMPLATE/question.yml)

---

*Thanks again for your contribution!*