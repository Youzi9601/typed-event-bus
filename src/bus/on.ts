import type { EventBus } from '../bus.js';
import { newListenerEvent } from '../constants.js';
import { createSubscription } from '../subscription.js';
import type { EventDefinition, EventPayload, Listener, Subscription } from '../types.js';
import type { BusContext, ListenerEntry } from './context.js';
import { createBucket } from './context.js';
import { emitMetaEvent } from './utils.js';

/**
 * Best-effort check for whether a listener is async.
 *
 * This is a performance cache, NOT a correctness guarantee: it lets the
 * emitter skip an `isThenable` runtime check on the hot path for the common
 * case. It may return `false` for async-detection heuristics that fail on
 * cross-realm (Worker/iframe) or minified listeners — that is safe because the
 * emitter always falls through to `isThenable` at runtime (see runListeners).
 * If this returns `true` for a sync listener, emitAsync still handles it via
 * the thenable check. Treat any single check here as advisory.
 *
 * @param listener - Listener function
 * @returns `true` if the listener looks async, `false` otherwise
 */
function isAsyncListener(listener: Listener<unknown>): boolean {
  // Async functions have constructor.name === 'AsyncFunction'
  // But vitest mock functions wrap async functions, so check multiple ways
  if (listener.constructor.name === 'AsyncFunction') {
    return true;
  }
  // Check toStringTag (more reliable for cross-realm)
  if (Object.prototype.toString.call(listener) === '[object AsyncFunction]') {
    return true;
  }
  // Fallback: check if function source contains 'async' (for non-minified code)
  // This is heuristic and may not work in production builds
  try {
    const fnStr = listener.toString();
    if (fnStr.startsWith('async ') || fnStr.startsWith('async\n') || fnStr.startsWith('async\r')) {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Shared subscription registration for on / once / prependListener /
 * prependOnceListener. Emits the `newListener` meta event before adding,
 * warns when maxListeners is exceeded, and returns the created Subscription.
 *
 * @param ctx BusContext
 * @param bus EventBus instance (for subscription)
 * @param event EventDefinition object
 * @param listener handler function
 * @param once whether the listener auto-unsubscribes after first emission
 * @param options options: signal (AbortSignal)
 * @param prepend whether to register at the front of the listener order
 * @returns Subscription object
 */
export function subscribe(
  ctx: BusContext,
  bus: EventBus,
  event: EventDefinition<string, unknown>,
  listener: Listener<unknown>,
  once: boolean,
  options?: { signal?: AbortSignal },
  prepend = false
): Subscription {
  const eventName = event.name;
  const entry: ListenerEntry<unknown> = { listener, once, isAsync: isAsyncListener(listener) };

  let bucket = ctx.listeners.get(eventName);
  if (!bucket) {
    bucket = createBucket();
    ctx.listeners.set(eventName, bucket);
  }

  emitMetaEvent(ctx, newListenerEvent, listener);

  // The newListener meta event may have mutated the listener set (e.g. via
  // removeAllListeners or another prependListener). Re-fetch the current bucket
  // so the new entry is not added to an orphaned set that is no longer in
  // the map. Mirrors Node, which re-reads `_events` after emitting
  // 'newListener'.
  bucket = ctx.listeners.get(eventName);
  if (!bucket) {
    bucket = createBucket();
    ctx.listeners.set(eventName, bucket);
  }

  if (bucket.set.size >= ctx.options.maxListeners) {
    console.warn(
      `[typed-event-bus] MaxListenersExceededWarning: ${bucket.set.size + 1} listeners for "${eventName}". Use bus.options.maxListeners to increase limit.`
    );
  }

  // Debug-only duplicate registration guard (Node semantics: duplicates are
  // separate entries and off() removes the last — a duplicate usually means a
  // leaked listener retaining its closure). Zero cost when debug is off.
  if (ctx.options.debug) {
    const dup = [...bucket.set].some(e => e.listener === listener);
    if (dup) {
      console.warn(`[typed-event-bus] Duplicate listener "${eventName}" (leak)`);
    }
  }

  if (prepend) {
    bucket.set = new Set([entry, ...bucket.set]);
  } else {
    bucket.set.add(entry);
  }

  // Invalidate resolved cache on mutation
  bucket.resolved = null;

  const sub = createSubscription(bus, eventName, entry.listener, options?.signal);
  entry.subscription = sub;
  return sub;
}

/**
 * Subscribe to event (sync/async listeners supported).
 *
 * @param ctx BusContext
 * @param bus EventBus instance (for subscription)
 * @param event EventDefinition object
 * @param listener handler function, payload type auto-inferred
 * @param options options: signal (AbortSignal)
 * @returns Subscription object, call unsubscribe() to cancel
 */
export function on<TEvent extends EventDefinition<string, unknown>>(
  ctx: BusContext,
  bus: EventBus,
  event: TEvent,
  listener: Listener<EventPayload<TEvent>>,
  options?: { signal?: AbortSignal }
): Subscription {
  return subscribe(ctx, bus, event, listener as Listener<unknown>, false, options);
}

/**
 * Subscribe at the front of the listener order (Node's prependListener).
 *
 * @param ctx BusContext
 * @param bus EventBus instance (for subscription)
 * @param event EventDefinition object
 * @param listener handler function, payload type auto-inferred
 * @param options options: signal (AbortSignal)
 * @returns Subscription object, call unsubscribe() to cancel
 */
export function prependListener<TEvent extends EventDefinition<string, unknown>>(
  ctx: BusContext,
  bus: EventBus,
  event: TEvent,
  listener: Listener<EventPayload<TEvent>>,
  options?: { signal?: AbortSignal }
): Subscription {
  return subscribe(ctx, bus, event, listener as Listener<unknown>, false, options, true);
}

/**
 * Subscribe at the front of the listener order, executed only once
 * (Node's prependOnceListener).
 *
 * @param ctx BusContext
 * @param bus EventBus instance (for subscription)
 * @param event EventDefinition object
 * @param listener handler function, payload type auto-inferred
 * @param options options: signal (AbortSignal)
 * @returns Subscription object
 */
export function prependOnceListener<TEvent extends EventDefinition<string, unknown>>(
  ctx: BusContext,
  bus: EventBus,
  event: TEvent,
  listener: Listener<EventPayload<TEvent>>,
  options?: { signal?: AbortSignal }
): Subscription {
  return subscribe(ctx, bus, event, listener as Listener<unknown>, true, options, true);
}
