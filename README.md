# typed-event-bus

**Define Once, Use Everywhere** — Type-safe event bus with zero duplicate declarations.

[![npm version](https://img.shields.io/npm/v/@youzi9601/typed-event-bus.svg)](https://www.npmjs.com/package/@youzi9601/typed-event-bus)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0.0+-blue.svg)](https://www.typescriptlang.org/)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@youzi9601/typed-event-bus)](https://bundlephobia.com/package/@youzi9601/typed-event-bus)

---

## Why typed-event-bus?

In TypeScript projects, event names are usually raw strings and payload types are separate interfaces. The connection between them only exists in the developer's mind:

```typescript
// Traditional approach: strings + any, error-prone during refactoring
bus.emit('user.created', { id: '123', name: 'Alice' })
bus.on('user.created', (payload) => {
  // payload is implicitly any, IDE cannot autocomplete, refactor errors go unnoticed
})
```

**typed-event-bus solves this:**

```typescript
// Define once → inferred everywhere automatically
const userCreated = defineEvent('user.created').payload<{ id: string; name: string }>()

bus.emit(userCreated, { id: '123', name: 'Alice' })  // ✅ Type-checked
bus.emit(userCreated, { id: 123 })                    // ❌ Compile error: id should be string

bus.on(userCreated, (payload) => {
  payload.id    // string ✅ IDE autocomplete
  payload.name  // string ✅
})
```

**Key advantages:**
- ✅ **Zero duplicate declarations** — EventDefinition is the single source of truth
- ✅ **Compile-time payload checking** — tsserver red squigglies in real time
- ✅ **Native IDE support** — Autocomplete, Rename Symbol, Go to Definition
- ✅ **Wildcard correlation narrowing** — `onAll(namespace, ({ event, payload }) => { ... })` correctly narrows types
- ✅ **Explicit sync/async separation** — `emit` (fire-and-forget) / `emitAsync` (await all)
- ✅ **< 3 KB gzipped** — zero dependencies, extremely lightweight
- ✅ **Transport agnostic** — Browser / Node / Worker / Electron / Deno / Bun / Edge compatible

---

## Installation

```bash
pnpm add @youzi9601/typed-event-bus
# or
npm install @youzi9601/typed-event-bus
# or
yarn add @youzi9601/typed-event-bus
```

**Peer Dependency:** `typescript >= 5.0.0`

---

## Quick Start

```typescript
import { defineEvent, defineEvents, createEventBus } from '@youzi9601/typed-event-bus'

// 1. Define events (single or namespace)
const userCreated = defineEvent('user.created').payload<{ id: string; name: string }>()

const userEvents = defineEvents('user', {
  created: defineEvent('created').payload<{ id: string; name: string }>(),
  deleted: defineEvent('deleted').payload<{ id: string }>(),
  updated: defineEvent('updated').payload<{ id: string; name: string; version: number }>(),
})

// 2. Create Event Bus
const bus = createEventBus(userEvents)

// 3. Emit event (sync fire-and-forget)
bus.emit(userEvents.created, { id: '123', name: 'Alice' })

// 4. Subscribe (payload fully type-inferred)
bus.on(userEvents.created, (payload) => {
  console.log(payload.id, payload.name)  // Type-safe
})

// 5. Wildcard subscription (correlation narrowing)
bus.onAll(userEvents, ({ event, payload }) => {
  if (event === 'user.created') {
    payload.id  // string ✅ auto-narrowed
  }
  if (event === 'user.deleted') {
    payload.id  // string ✅
  }
})

// 6. Async emission (await all async listeners)
await bus.emitAsync(userEvents.created, { id: '123', name: 'Alice' })

// 7. Unsubscribe
const sub = bus.on(userEvents.created, (payload) => {
  console.log(payload.id, payload.name)
})
sub.unsubscribe()
```

---

## API Overview

### Event Definition

| Function | Description |
|----------|-------------|
| `defineEvent(name).payload<T>()` | Create a single event definition (builder chain) |
| `defineEvents(prefix, definitions)` | Create a namespace with auto-prefixed names |

### Event Bus Creation

| Function | Description |
|----------|-------------|
| `createEventBus(registry, options?)` | Create bus, supports single or merged namespaces |

### Emit

| Method | Behavior |
|--------|----------|
| `bus.emit(event, payload)` | Sync fire-and-forget, catches exceptions → `onError` → continues |
| `bus.emitAsync(event, payload, options?)` | Async, awaits all async listeners **in parallel** (Promise.all), aggregates exceptions as `MultiError`. Pass `{ sequential: true }` to execute in registration order (Node strict order) |

### Subscribe

| Method | Description |
|--------|-------------|
| `bus.on(event, listener, options?)` | Subscribe, returns `Subscription` |
| `bus.once(event, listener, options?)` | Subscribe once |
| `bus.prependListener(event, listener, options?)` | Subscribe at the front of the listener order (Node parity) |
| `bus.prependOnceListener(event, listener, options?)` | Subscribe once, at the front of the listener order (Node parity) |
| `bus.onAll(namespace, handler, options?)` | Namespace wildcard, handler receives `{ event, payload }` |

### Meta Events (Node parity)

`newListener` fires before a listener is registered, `removeListener` after it is removed — including `once` auto-removal and `removeAllListeners`. Subscribe with the built-in definitions:

```typescript
import { newListenerEvent, removeListenerEvent } from '@youzi9601/typed-event-bus'

bus.on(newListenerEvent, listener => { /* listener being registered */ })
bus.on(removeListenerEvent, listener => { /* listener being removed */ })
```

Meta events run with the same listener semantics as `emit` (snapshot, `once` auto-removal, errors → `onError`) but do not run middleware.

### Subscription

```typescript
const sub = bus.on(event, handler)
sub.unsubscribe()        // Primary API
sub.signal               // Optional AbortSignal
sub.unsubscribed         // Whether subscription has been cancelled
```

### Other

| API | Description |
|-----|-------------|
| `bus.use(middleware)` | Register middleware |
| `bus.listenerCount(event)` | Get listener count |
| `bus.eventNames()` | Get all registered event names |
| `bus.rawListeners(event)` | Get listener functions in registration order (once listeners returned unwrapped, unlike Node) |
| `bus.removeAllListeners(event?)` | Remove all listeners |
| `bus.off(event, listener)` | Remove a specific listener (removes the last matching registration, Node parity) |

### Bus Options

| Option | Description |
|--------|-------------|
| `maxListeners` | Warn via `console.warn` when a single event exceeds this many listeners (Node parity) |
| `debug` | Log subscribe/unsubscribe/emit activity to `console.debug` |

---

## Advanced Usage

### Multi-Namespace Merge (Cross-module Decoupling)

```typescript
// src/user/events.ts
export const userEvents = defineEvents('user', { ... })

// src/order/events.ts
export const orderEvents = defineEvents('order', { ... })

// src/main.ts
import { userEvents } from './user/events'
import { orderEvents } from './order/events'

const bus = createEventBus({
  user: userEvents,
  order: orderEvents,
})
```

### Error Handling

```typescript
const bus = createEventBus(userEvents, {
  onError: (error, event, payload) => {
    // Custom error handling (defaults to console.error)
    sentry.captureException(error, { extra: { event: event.name, payload } })
  }
})
```

### Middleware

```typescript
// Built-in middleware factories
bus.use(createLoggingMiddleware())
bus.use(createTimingMiddleware())
bus.use(createMetricsMiddleware((name, size) => metrics.record(name, size)))

// Custom middleware
bus.use((event, payload, next) => {
  console.log(`[emit] ${event.name}`, payload)
  next()
})
```

### Electron / Worker Cross-Process

```typescript
// Core package has zero dependencies, use with @typed-event-bus/adapter-*
// (adapters are separate packages, published after 1.0)
```

---

## Development Guide

```bash
# Install dependencies
pnpm install

# Dev mode (watch)
pnpm dev

# Single build
pnpm build

# Testing
pnpm test              # runtime tests
pnpm test:types        # type tests (vitest expectTypeOf)
pnpm test:watch        # watch mode

# Code quality
pnpm lint              # biome check
pnpm lint:fix          # biome check --write
pnpm format            # biome format --write

# Benchmarking
pnpm bench
node scripts/check-budget.js   # pure Node (zlib), works on any platform

# Full check (CI equivalent)
pnpm check
```

---

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
├── errors.ts               # MultiError, defaultErrorHandler
├── middleware.ts           # executeMiddleware, createLogging/Timing/MetricsMiddleware
├── subscription.ts         # EventSubscription class, createSubscription
├── types.ts                # Core types: EventDefinition, EventNamespace, EventsOf, WildcardHandler, Subscription, ErrorHandler, Middleware, BusOptions, PayloadOf, NameOf
└── index.ts                # Public API exports (barrel file)

tests/
├── runtime/        # Vitest runtime tests
└── types/          # Vitest type tests (*.test-d.ts)

bench/              # Benchmark tests
scripts/            # CI helper scripts
```

---

## Contributing

Contributions welcome! Please read:
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Contributing Guide](CONTRIBUTING.md)

---

## License

[MIT License](LICENSE) © 2026 [Youzi9601](https://github.com/Youzi9601)

---

## Related Links

- [GitHub Repository](https://github.com/Youzi9601/typed-event-bus)
- [Issue Tracker](https://github.com/Youzi9601/typed-event-bus/issues)
- [Discussions](https://github.com/Youzi9601/typed-event-bus/discussions)