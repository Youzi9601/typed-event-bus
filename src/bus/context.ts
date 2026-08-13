/**
 * Bus Context - Internal state interface for factory function pattern
 * Define Once, Use Everywhere
 */

import { defaultErrorHandler } from '../errors.js';
import type { BusOptions, EventDefinition, Listener, Middleware } from '../types.js';

// ============================================================================
// Internal Types
// ============================================================================

type ListenerEntry<TPayload> = {
  listener: Listener<TPayload>;
  once: boolean;
};

type ListenerMap = Map<string, Set<ListenerEntry<unknown>>>;

// Normalized registry type (always Record form after createEventBus normalization)
export type NormalizedRegistry = Record<
  string,
  { readonly __prefix: string } & Record<string, EventDefinition<string, unknown> | string>
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
