/**
 * Core type definitions for typed-event-bus
 *
 * Design principles:
 * - Define Once, Use Everywhere: EventDefinition is the single source of truth
 * - Branded object for runtime serializability + compile-time safety
 * - No string-based APIs, all type-safe through EventDefinition references
 */

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
 * Single event definition input within a namespace
 */
export interface EventDefinitionInput<TPayload> {
  /** Payload type (type-level only) */
  _payload?: TPayload;
}

/**
 * Namespace definition input structure
 * Uses const assertion to preserve literal key names
 */
export type EventNamespaceInput<
  TPrefix extends string,
  TDefs extends Record<string, EventDefinitionInput<unknown>>,
> = {
  [K in keyof TDefs]: EventDefinitionInput<TDefs[K]['_payload']>;
} & { __prefix: TPrefix };

/**
 * Namespace runtime structure
 * Excludes __prefix key; index signature allows __prefix as string
 */
export type EventNamespace<
  TPrefix extends string,
  TDefs extends Record<string, EventDefinition<string, unknown>>,
> = {
  /** Namespace prefix, e.g. "user" */
  readonly __prefix: TPrefix;
} & {
  readonly [K in keyof TDefs as Exclude<K, '__prefix'>]: TDefs[K];
} & Record<string, EventDefinition<string, unknown>>;

/**
 * Discriminated union of all events from a namespace
 * This is the key to wildcard correlation narrowing
 */
export type EventsOf<TNamespace extends { readonly __prefix: string }> = {
  [K in keyof TNamespace]: K extends '__prefix'
    ? never
    : TNamespace[K] extends EventDefinition<string, unknown>
      ? {
          event: EventName<TNamespace[K]>;
          payload: EventPayload<TNamespace[K]>;
        }
      : never;
}[keyof TNamespace];

/**
 * Union of all event names from a namespace
 */
export type EventNamesOf<TNamespace extends { readonly __prefix: string }> = {
  [K in keyof TNamespace]: K extends '__prefix'
    ? never
    : TNamespace[K] extends EventDefinition<string, unknown>
      ? EventName<TNamespace[K]>
      : never;
}[keyof TNamespace];

/**
 * Event registry: namespace name -> EventNamespace
 * Also supports single EventDefinition as input
 * Also supports DefineEventsOutput (Record with __prefix)
 */
export type EventRegistry =
  | Record<
      string,
      { readonly __prefix: string } & Record<string, EventDefinition<string, unknown> | string>
    >
  | EventDefinition<string, unknown>;

/**
 * Discriminated union of all events from a registry
 * Supports Record<string, EventNamespace> or single EventDefinition
 */
export type AllEventsOf<TRegistry extends EventRegistry> = TRegistry extends Record<
  string,
  EventNamespace<string, Record<string, EventDefinition<string, unknown>>>
>
  ? {
      [K in keyof TRegistry]: EventsOf<TRegistry[K]>;
    }[keyof TRegistry]
  : TRegistry extends EventDefinition<string, unknown>
    ? {
        event: EventName<TRegistry>;
        payload: EventPayload<TRegistry>;
      }
    : never;

/**
 * Union of all event names from a registry
 * Supports Record<string, EventNamespace> or single EventDefinition
 */
export type AllEventNamesOf<TRegistry extends EventRegistry> = TRegistry extends Record<
  string,
  EventNamespace<string, Record<string, EventDefinition<string, unknown>>>
>
  ? {
      [K in keyof TRegistry]: EventNamesOf<TRegistry[K]>;
    }[keyof TRegistry]
  : TRegistry extends EventDefinition<string, unknown>
    ? EventName<TRegistry>
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
 */
export type ErrorHandler = (
  error: unknown,
  event: EventDefinition<string, unknown>,
  payload: unknown
) => void;

/**
 * MultiError for emitAsync
 */
export class MultiError extends Error {
  override readonly name = 'MultiError';
  readonly errors: unknown[];

  constructor(errors: unknown[], message?: string) {
    super(
      message ??
        `MultiError: ${errors.length} error${errors.length === 1 ? '' : 's'} occurred during async emission`
    );
    this.errors = errors;
    Object.setPrototypeOf(this, MultiError.prototype);
  }
}

/**
 * Middleware function signature
 * Supports both sync and async middleware
 */
export type Middleware = <TEvent extends EventDefinition<string, unknown>>(
  event: TEvent,
  payload: EventPayload<TEvent>,
  next: () => void | Promise<void>
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
