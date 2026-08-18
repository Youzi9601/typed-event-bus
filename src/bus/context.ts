/**
 * Bus Context - Internal state interface for factory function pattern
 * Define Once, Use Everywhere
 */

import { PREFIX_KEY } from '../constants.js';
import { defaultErrorHandler } from '../errors.js';
import type { EventSubscription } from '../subscription.js';
import type { BusOptions, EventDefinition, Listener, Middleware } from '../types.js';

// ============================================================================
// Internal Types
// ============================================================================

export type ListenerEntry<TPayload> = {
  listener: Listener<TPayload>;
  once: boolean;
  /** Subscription returned to the caller — marked unsubscribed on auto-removal */
  subscription?: EventSubscription;
  /** Cached async detection — avoids isThenable check on every emit */
  isAsync?: boolean;
};

/**
 * Per-event listener storage:
 * - `set`: maintains uniqueness + O(1) add/remove (Node parity)
 * - `resolved`: snapshot array for fast emit iteration; null = dirty,
 *   rebuild lazily on next emit. Emptied whenever the set mutates.
 */
export type ListenerBucket = {
  set: Set<ListenerEntry<unknown>>;
  resolved: ListenerEntry<unknown>[] | null;
};

type ListenerMap = Map<string, ListenerBucket>;

// Normalized registry type (always Record form after createEventBus normalization)
export type NormalizedRegistry = Record<
  string,
  { readonly [PREFIX_KEY]: string } & Record<string, EventDefinition<string, unknown> | string>
>;

// ============================================================================
// BusContext Interface
// ============================================================================

/**
 * Internal context passed to all bus method implementations.
 * Contains all mutable state needed by the event bus.
 */
export interface BusContext {
  readonly listeners: ListenerMap;
  readonly middlewares: Middleware[];
  readonly options: Required<BusOptions<NormalizedRegistry>>;
  readonly registry: NormalizedRegistry;
}

/**
 * Creates a new BusContext from registry and options.
 */
export function createBusContext(
  registry: NormalizedRegistry,
  options: BusOptions<NormalizedRegistry> = {}
): BusContext {
  return {
    listeners: new Map(),
    middlewares: [],
    options: {
      onError: options.onError ?? defaultErrorHandler,
      maxListeners: options.maxListeners ?? 10,
      debug: options.debug ?? false,
    },
    registry,
  };
}

/** Create a fresh empty listener bucket. */
export function createBucket(): ListenerBucket {
  return { set: new Set(), resolved: null };
}
