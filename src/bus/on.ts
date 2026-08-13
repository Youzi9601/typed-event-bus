import type { EventBus } from '../bus.js';
import { newListenerEvent } from '../constants.js';
import { createSubscription } from '../subscription.js';
import type { EventDefinition, EventPayload, Listener, Subscription } from '../types.js';
import type { BusContext, ListenerEntry } from './context.js';
import { emitMetaEvent } from './utils.js';

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
  const entry: ListenerEntry<unknown> = { listener, once };

  let listeners = ctx.listeners.get(eventName);
  if (!listeners) {
    listeners = new Set();
    ctx.listeners.set(eventName, listeners);
  }

  emitMetaEvent(ctx, newListenerEvent, listener);

  // The newListener meta event may have mutated the listener set (e.g. via
  // removeAllListeners or another prependListener). Re-fetch the current set
  // so the new entry is not added to an orphaned set that is no longer in
  // the map. Mirrors Node, which re-reads `_events` after emitting
  // 'newListener'.
  listeners = ctx.listeners.get(eventName);
  if (!listeners) {
    listeners = new Set();
    ctx.listeners.set(eventName, listeners);
  }

  if (listeners.size >= ctx.options.maxListeners) {
    console.warn(
      `[typed-event-bus] MaxListenersExceededWarning: ${listeners.size + 1} listeners for "${eventName}". Use bus.options.maxListeners to increase limit.`
    );
  }

  if (prepend) {
    ctx.listeners.set(eventName, new Set([entry, ...listeners]));
  } else {
    listeners.add(entry);
  }

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
