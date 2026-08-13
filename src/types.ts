/**
 * Core type definitions for typed-event-bus
 *
 * Design principles:
 * - Define Once, Use Everywhere: EventDefinition is the single source of truth
 * - Branded object for runtime serializability + compile-time safety
 * - No string-based APIs, all type-safe through EventDefinition references
 */

import { PREFIX_KEY } from './constants.js';
import type { ErrorHandler } from './errors.js';

/**
 * EventDefinition is the single source of truth for an event.
 * Runtime: { name: string } — serializable, safe for cross-process transport
 * Compile-time: carries payload type info via __brand discrimination
 */
export interface EventDefinition<TName extends string, _TPayload> {
  /** Unique symbol for compile-time discrimination, not present at runtime */
  readonly __brand: unique symbol;
  /** Event name, accessible at runtime, serializable */
  readonly name: TName;
}

/**
 * Extract event name from EventDefinition
 */
export type EventName<T> = T extends EventDefinition<infer N extends string, unknown> ? N : never;

/**
 * Extract payload type from EventDefinition
 */
export type EventPayload<T> = T extends EventDefinition<string, infer P> ? P : never;

/**
 * Namespace runtime structure
 * Excludes __prefix key; values are EventDefinitions
 */
export type EventNamespace<
  TPrefix extends string,
  TDefs extends Record<string, EventDefinition<string, unknown>>,
> = {
  /** Namespace prefix, e.g. "user" */
  readonly [PREFIX_KEY]: TPrefix;
} & {
  readonly [K in keyof TDefs as Exclude<K, typeof PREFIX_KEY>]: TDefs[K];
};

/**
 * Discriminated union of all events from a namespace (including nested namespaces)
 * This is the key to wildcard correlation narrowing
 */
export type EventsOf<TNamespace extends { readonly [PREFIX_KEY]: string }> = {
  [K in keyof TNamespace]: K extends typeof PREFIX_KEY
    ? never
    : TNamespace[K] extends EventDefinition<string, unknown>
      ? {
          event: EventName<TNamespace[K]>;
          payload: EventPayload<TNamespace[K]>;
        }
      : TNamespace[K] extends { readonly [PREFIX_KEY]: string }
        ? EventsOf<TNamespace[K]>
        : never;
}[keyof TNamespace];

/**
 * Union of all event names from a namespace (including nested namespaces)
 */
export type EventNamesOf<TNamespace extends { readonly [PREFIX_KEY]: string }> = {
  [K in keyof TNamespace]: K extends typeof PREFIX_KEY
    ? never
    : TNamespace[K] extends EventDefinition<string, unknown>
      ? EventName<TNamespace[K]>
      : TNamespace[K] extends { readonly [PREFIX_KEY]: string }
        ? EventNamesOf<TNamespace[K]>
        : never;
}[keyof TNamespace];

/**
 * Event registry: single EventDefinition, single namespace, or multi-namespace merge
 */
export type EventRegistry =
  | EventDefinition<string, unknown>
  | ({ readonly [PREFIX_KEY]: string } & Record<string, unknown>)
  | Record<string, { readonly [PREFIX_KEY]: string } & Record<string, unknown>>;

/**
 * Discriminated union of all events from a registry.
 * Supports single EventDefinition, single namespace (with nesting),
 * or Record<string, EventNamespace> merges.
 */
export type AllEventsOf<TRegistry extends EventRegistry> =
  TRegistry extends EventDefinition<string, unknown>
    ? {
        event: EventName<TRegistry>;
        payload: EventPayload<TRegistry>;
      }
    : TRegistry extends { readonly [PREFIX_KEY]: string }
      ? EventsOf<TRegistry>
      : TRegistry extends Record<string, { readonly [PREFIX_KEY]: string }>
        ? {
            [K in keyof TRegistry]: EventsOf<TRegistry[K]>;
          }[keyof TRegistry]
        : never;

/**
 * Union of all event names from a registry.
 * Supports single EventDefinition, single namespace (with nesting),
 * or Record<string, EventNamespace> merges.
 */
export type AllEventNamesOf<TRegistry extends EventRegistry> =
  TRegistry extends EventDefinition<string, unknown>
    ? EventName<TRegistry>
    : TRegistry extends { readonly [PREFIX_KEY]: string }
      ? EventNamesOf<TRegistry>
      : TRegistry extends Record<string, { readonly [PREFIX_KEY]: string }>
        ? {
            [K in keyof TRegistry]: EventNamesOf<TRegistry[K]>;
          }[keyof TRegistry]
        : never;

/**
 * Sync listener handler
 */
export type SyncListener<TPayload> = (payload: TPayload) => void;

/**
 * Async listener handler
 */
export type AsyncListener<TPayload> = (payload: TPayload) => Promise<void>;

/**
 * Listener type union
 */
export type Listener<TPayload> = SyncListener<TPayload> | AsyncListener<TPayload>;

/**
 * Wildcard handler receives discriminated object
 * This is the only viable design for correlation narrowing
 */
export type WildcardHandler<TEvent extends { event: string; payload: unknown }> = (
  e: TEvent
) => void;

/**
 * Subscription interface
 */
export interface Subscription {
  /** Unsubscribe */
  unsubscribe(): void;
  /** Optional AbortSignal integration */
  readonly signal?: AbortSignal;
  /** Whether subscription has been cancelled */
  readonly unsubscribed: boolean;
}

/**
 * Error handler hook signature
 * Single source of truth: defined in errors.ts, re-exported here.
 */
export type { ErrorHandler };

/**
 * Middleware function signature
 * Supports both sync and async middleware
 */
export type Middleware = <TEvent extends EventDefinition<string, unknown>>(
  event: TEvent,
  payload: EventPayload<TEvent>,
  next: () => Promise<void>
) => void | Promise<void>;

/**
 * createEventBus options
 */
export interface BusOptions<_TRegistry extends EventRegistry = EventRegistry> {
  /** Error handler hook, defaults to console.error */
  onError?: ErrorHandler;
  /** Max listeners warning threshold (P1 feature) */
  maxListeners?: number;
  /** Debug mode (P1 feature) */
  debug?: boolean;
}

/**
 * Extract payload type from EventDefinition (type-level only)
 */
export type PayloadOf<T> = T extends EventDefinition<string, infer P> ? P : never;

/**
 * Extract event name from EventDefinition (type-level only)
 */
export type NameOf<T> = T extends EventDefinition<infer N extends string, unknown> ? N : never;
