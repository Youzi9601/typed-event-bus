/**
 * Internal metadata keys shared across runtime and type-level code.
 * Single source of truth — change here instead of editing string literals.
 */

import type { EventDefinition, Listener } from './types.js';

/** Runtime property carrying a namespace's full path (e.g. "user.profile") */
export const PREFIX_KEY = '__prefix' as const;

/** Runtime property carrying the brand symbol (phantom, non-enumerable) */
export const BRAND_KEY = '__brand' as const;

/** Meta event emitted before a listener is registered (Node EventEmitter parity) */
export const newListenerEvent = {
  name: 'newListener',
} as EventDefinition<'newListener', Listener<unknown>>;

/** Meta event emitted after a listener is removed (Node EventEmitter parity) */
export const removeListenerEvent = {
  name: 'removeListener',
} as EventDefinition<'removeListener', Listener<unknown>>;
