import { createBusContext, type NormalizedRegistry } from './bus/context.js';
import { emit } from './bus/emit.js';
import { emitAsync } from './bus/emit-async.js';
import { off } from './bus/off.js';
import {
  on as onImpl,
  prependListener as prependListenerImpl,
  prependOnceListener as prependOnceListenerImpl,
} from './bus/on.js';
import { onAll as onAllImpl } from './bus/on-all.js';
import { once as onceImpl } from './bus/once.js';
import { eventNames, listenerCount, rawListeners, removeAllListeners, use } from './bus/utils.js';
import { BRAND_KEY, PREFIX_KEY } from './constants.js';
import type {
  BusOptions,
  EventDefinition,
  EventPayload,
  EventRegistry,
  EventsOf,
  Listener,
  Middleware,
  Subscription,
  WildcardHandler,
} from './types.js';

/**
 * Create event bus.
 * Supports single EventDefinition, single namespace, or multi-namespace merge.
 *
 * @param registry - Single EventDefinition, EventNamespace, or multi-namespace object
 * @param options - Bus configuration options
 * @returns EventBus instance with public API
 *
 * @example
 * // Single EventDefinition
 * const bus = createEventBus(userCreated)
 *
 * @example
 * // Single namespace
 * const bus = createEventBus(userEvents)
 *
 * @example
 * // Multi-namespace merge
 * const bus = createEventBus({
 *   user: userEvents,
 *   order: orderEvents,
 * })
 */
export function createEventBus<TRegistry extends EventRegistry = EventRegistry>(
  registry:
    | EventRegistry
    | EventDefinition<string, unknown>
    | ({ readonly [PREFIX_KEY]: string } & Record<string, unknown>)
    | Record<string, { readonly [PREFIX_KEY]: string } & Record<string, unknown>>,
  options?: BusOptions<TRegistry>
) {
  let normalizedRegistry: EventRegistry;

  const hasPrefix = Object.hasOwn(registry, PREFIX_KEY);
  const hasBrand = Object.hasOwn(registry, BRAND_KEY);

  if (hasPrefix) {
    normalizedRegistry = { default: registry } as EventRegistry;
  } else if (hasBrand) {
    const def = registry as EventDefinition<string, unknown>;
    normalizedRegistry = {
      default: {
        [PREFIX_KEY]: 'default',
        [def.name.split('.').pop() || 'event']: def,
      },
    } as EventRegistry;
  } else {
    normalizedRegistry = registry as EventRegistry;
  }

  const ctx = createBusContext(normalizedRegistry as NormalizedRegistry, options);

  const bus = {
    /**
     * Emit event synchronously (fire-and-forget).
     * Catches each listener exception, calls onError, continues remaining listeners.
     *
     * @typeParam TEvent - EventDefinition type, payload inferred automatically
     * @param event - EventDefinition object created by defineEvent or defineEvents
     * @param payload - Event payload, type strictly checked against EventDefinition
     * @returns `true` if listeners were registered for the event, `false` otherwise
     *
     * @example
     * const userCreated = defineEvent("user.created").payload<{ id: string; name: string }>()
     * bus.emit(userCreated, { id: "123", name: "Alice" }) // ✅ Type-checked
     * bus.emit(userCreated, { id: 123 }) // ❌ Compile error: id should be string
     */
    emit: <TEvent extends EventDefinition<string, unknown>>(
      event: TEvent,
      payload: EventPayload<TEvent>
    ): boolean => emit(ctx, event, payload),

    /**
     * Emit event asynchronously and await all async listeners.
     * Collects all exceptions (sync and async) and throws as MultiError.
     * Use when you need to ensure all async handlers complete before continuing.
     *
     * @typeParam TEvent - EventDefinition type, payload inferred automatically
     * @param event - EventDefinition object created by defineEvent or defineEvents
     * @param payload - Event payload, type strictly checked against EventDefinition
     * @returns Promise that resolves when all listeners complete
     * @throws {MultiError} When any listener or middleware throws, containing all collected errors
     *
     * @example
     * await bus.emitAsync(userCreated, { id: "123", name: "Alice" })
     * // All async listeners awaited, errors aggregated
     */
    emitAsync: async <TEvent extends EventDefinition<string, unknown>>(
      event: TEvent,
      payload: EventPayload<TEvent>
    ): Promise<void> => emitAsync(ctx, event, payload),

    /**
     * Subscribe to event (supports both sync and async listeners).
     * Returns Subscription object with unsubscribe() as primary API.
     *
     * @typeParam TEvent - EventDefinition type, payload inferred automatically
     * @param event - EventDefinition object created by defineEvent or defineEvents
     * @param listener - Handler function, payload type auto-inferred from EventDefinition
     * @param options - Optional: { signal?: AbortSignal } for external cancellation
     * @returns Subscription object - call unsubscribe() to cancel
     *
     * @example
     * const sub = bus.on(userCreated, (payload) => {
     *   console.log(payload.id, payload.name) // Fully typed
     * })
     * sub.unsubscribe() // Cancel subscription
     *
     * @example
     * // With AbortSignal for external cancellation
     * const controller = new AbortController()
     * bus.on(userCreated, handler, { signal: controller.signal })
     * controller.abort() // Cancels subscription
     */
    on: <TEvent extends EventDefinition<string, unknown>>(
      event: TEvent,
      listener: Listener<EventPayload<TEvent>>,
      options?: { signal?: AbortSignal }
    ): Subscription => onImpl(ctx, bus, event, listener, options),

    /**
     * Subscribe to event, executed only once then automatically unsubscribes.
     * Returns Subscription object with unsubscribe() for manual early cancellation.
     *
     * @typeParam TEvent - EventDefinition type, payload inferred automatically
     * @param event - EventDefinition object created by defineEvent or defineEvents
     * @param listener - Handler function, payload type auto-inferred from EventDefinition
     * @param options - Optional: { signal?: AbortSignal } for external cancellation
     * @returns Subscription object
     *
     * @example
     * bus.once(userCreated, (payload) => {
     *   console.log("First user created:", payload.id)
     * })
     * // Automatically unsubscribes after first emission
     */
    once: <TEvent extends EventDefinition<string, unknown>>(
      event: TEvent,
      listener: Listener<EventPayload<TEvent>>,
      options?: { signal?: AbortSignal }
    ): Subscription => onceImpl(ctx, bus, event, listener, options),

    /**
     * Subscribe at the front of the listener order (Node's prependListener).
     *
     * @typeParam TEvent - EventDefinition type, payload inferred automatically
     * @param event - EventDefinition object created by defineEvent or defineEvents
     * @param listener - Handler function, payload type auto-inferred from EventDefinition
     * @param options - Optional: { signal?: AbortSignal } for external cancellation
     * @returns Subscription object
     */
    prependListener: <TEvent extends EventDefinition<string, unknown>>(
      event: TEvent,
      listener: Listener<EventPayload<TEvent>>,
      options?: { signal?: AbortSignal }
    ): Subscription => prependListenerImpl(ctx, bus, event, listener, options),

    /**
     * Subscribe at the front of the listener order, executed only once
     * (Node's prependOnceListener).
     *
     * @typeParam TEvent - EventDefinition type, payload inferred automatically
     * @param event - EventDefinition object created by defineEvent or defineEvents
     * @param listener - Handler function, payload type auto-inferred from EventDefinition
     * @param options - Optional: { signal?: AbortSignal } for external cancellation
     * @returns Subscription object
     */
    prependOnceListener: <TEvent extends EventDefinition<string, unknown>>(
      event: TEvent,
      listener: Listener<EventPayload<TEvent>>,
      options?: { signal?: AbortSignal }
    ): Subscription => prependOnceListenerImpl(ctx, bus, event, listener, options),

    /**
     * Subscribe to all events in a namespace with correlation narrowing.
     * Handler receives discriminated object { event, payload } enabling TypeScript
     * to narrow payload type based on event name.
     *
     * @typeParam TNamespace - Namespace type with __prefix (from defineEvents)
     * @param namespace - Namespace object from defineEvents
     * @param handler - Handler receiving { event: string, payload: unknown }
     * @param options - Optional: { signal?: AbortSignal } for external cancellation
     * @returns Subscription object - unsubscribes from all events in namespace
     *
     * @example
     * const userEvents = defineEvents("user", {
     *   created: defineEvent("created").payload<{ id: string; name: string }>(),
     *   deleted: defineEvent("deleted").payload<{ id: string }>(),
     * })
     *
     * bus.onAll(userEvents, ({ event, payload }) => {
     *   if (event === "user.created") {
     *     payload.id // string ✅ narrowed
     *     payload.name // string ✅ narrowed
     *   }
     *   if (event === "user.deleted") {
     *     payload.id // string ✅ narrowed
     *   }
     * })
     */
    onAll: <TNamespace extends { readonly [PREFIX_KEY]: string }>(
      namespace: TNamespace,
      handler: WildcardHandler<EventsOf<TNamespace>>,
      options?: { signal?: AbortSignal }
    ): Subscription => onAllImpl(ctx, bus, namespace, handler, options),

    /**
     * Remove specific listener from event.
     * Usually called via Subscription.unsubscribe() rather than directly.
     *
     * @param event - EventDefinition object or event name string
     * @param listener - Handler function to remove (must be same reference)
     * @returns `true` if listener was found and removed, `false` otherwise
     *
     * @example
     * const handler = (payload) => console.log(payload)
     * bus.on(userCreated, handler)
     * bus.off(userCreated, handler) // true
     * bus.off(userCreated, handler) // false (already removed)
     */
    off: (event: EventDefinition<string, unknown> | string, listener: Listener<unknown>): boolean =>
      off(ctx, event, listener),

    /**
     * Register middleware function.
     * Middleware executes in FIFO order, can modify flow via next().
     *
     * @param middleware - Middleware function receiving (event, payload, next)
     *
     * @example
     * bus.use((event, payload, next) => {
     *   console.log(`[${new Date().toISOString()}] ${event.name}`, payload)
     *   next()
     * })
     *
     * @example
     * // Async middleware
     * bus.use(async (event, payload, next) => {
     *   await metrics.record(event.name, payload)
     *   next()
     * })
     */
    use: (middleware: Middleware): void => use(ctx, middleware),

    /**
     * Get number of listeners registered for an event.
     *
     * @param event - EventDefinition object
     * @returns Number of listeners (0 if none)
     */
    listenerCount: (event: EventDefinition<string, unknown>): number => listenerCount(ctx, event),

    /**
     * Get all registered listeners for an event, in registration order.
     *
     * Unlike Node's rawListeners, once listeners are returned as the original
     * listener function — Node wraps once listeners in an internal wrapper.
     *
     * @param event - EventDefinition object
     * @returns Array of listener functions
     */
    rawListeners: (event: EventDefinition<string, unknown>): Listener<unknown>[] =>
      rawListeners(ctx, event),

    /**
     * Get all registered event names.
     *
     * @returns Array of event name strings
     */
    eventNames: (): string[] => eventNames(ctx),

    /**
     * Remove all listeners for specific event or all events.
     *
     * @param event - Optional EventDefinition to remove specific event listeners.
     *                If omitted, removes all listeners for all events.
     *
     * @example
     * bus.removeAllListeners(userCreated) // Remove only userCreated listeners
     * bus.removeAllListeners() // Remove all listeners
     */
    removeAllListeners: (event?: EventDefinition<string, unknown>): void =>
      removeAllListeners(ctx, event),

    /**
     * Read-only access to bus options (with defaults applied).
     * @returns Required<BusOptions> with all defaults resolved
     */
    get options(): Readonly<Required<BusOptions<NormalizedRegistry>>> {
      return ctx.options;
    },

    /**
     * Read-only access to normalized registry.
     * @returns Registry object with all namespaces and event definitions
     */
    get registry(): NormalizedRegistry {
      return ctx.registry;
    },
  };

  return bus;
}

/**
 * EventBus type returned by createEventBus.
 * Provides type-safe event emission, subscription, and management.
 */
export type EventBus<TRegistry extends EventRegistry = EventRegistry> = ReturnType<
  typeof createEventBus<TRegistry>
>;
