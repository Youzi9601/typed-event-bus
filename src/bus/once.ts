import type { EventBus } from '../bus.js';
import type { EventDefinition, EventPayload, Listener, Subscription } from '../types.js';
import type { BusContext } from './context.js';
import { subscribe } from './on.js';

/**
 * Subscribe to event, executed only once.
 *
 * @param ctx BusContext
 * @param bus EventBus instance (for subscription)
 * @param event EventDefinition object
 * @param listener handler function, payload type auto-inferred
 * @param options options: signal (AbortSignal)
 * @returns Subscription object
 */
export function once<TEvent extends EventDefinition<string, unknown>>(
  ctx: BusContext,
  bus: EventBus,
  event: TEvent,
  listener: Listener<EventPayload<TEvent>>,
  options?: { signal?: AbortSignal }
): Subscription {
  return subscribe(ctx, bus, event, listener as Listener<unknown>, true, options);
}
