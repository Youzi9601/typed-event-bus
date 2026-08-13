/**
 * Type tests for Middleware
 * These verify compile-time type inference
 */

import { expectTypeOf } from 'vitest';
import type { Middleware } from '../../src/index.js';

// next() always returns a Promise, so it can be awaited or returned directly
const nextReturnsPromise: Middleware = (_event, _payload, next) => {
  expectTypeOf(next).toEqualTypeOf<() => Promise<void>>();
  return next();
};

// sync middleware may ignore next's returned promise
const syncMiddleware: Middleware = (_event, _payload, next) => {
  next();
};

expectTypeOf(nextReturnsPromise).toEqualTypeOf<Middleware>();
expectTypeOf(syncMiddleware).toEqualTypeOf<Middleware>();
