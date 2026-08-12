import type { EventBus } from '../bus.js';
import { createSubscription } from '../subscription.js';
import type { EventDefinition, EventPayload, Listener, Subscription } from '../types.js';
import type { BusContext } from './context.js';

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
  const eventName = event.name;
  const entry: { listener: Listener<unknown>; once: boolean } = {
    listener: listener as Listener<unknown>,
    once: false,
  };

  let listeners = ctx.listeners.get(eventName);
  if (!listeners) {
    listeners = new Set();
    ctx.listeners.set(eventName, listeners);
  }

  if (listeners.size >= ctx.options.maxListeners) {
    console.warn(
      `[typed-event-bus] MaxListenersExceededWarning: ${listeners.size + 1} listeners for "${eventName}". Use bus.options.maxListeners to increase limit.`
    );
  }

  listeners.add(entry as { listener: Listener<unknown>; once: boolean });

  return createSubscription(bus, eventName, entry.listener as Listener<unknown>, options?.signal);
}
