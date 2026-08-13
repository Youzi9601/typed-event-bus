import { removeListenerEvent } from '../constants.js';
import type { EventDefinition, Listener } from '../types.js';
import type { BusContext, ListenerEntry } from './context.js';
import { emitMetaEvent } from './utils.js';

/**
 * Remove specific listener.
 * Usually called via Subscription.unsubscribe().
 * Follows Node EventEmitter semantics: removes the most recently registered
 * instance of the listener (lastIndexOf), and emits the `removeListener`
 * meta event.
 *
 * @param ctx BusContext
 * @param event EventDefinition object or event name string
 * @param listener handler function to remove
 * @returns Whether listener was found and removed
 */
export function off(
  ctx: BusContext,
  event: EventDefinition<string, unknown> | string,
  listener: Listener<unknown>
): boolean {
  const eventName = typeof event === 'string' ? event : event.name;
  const listeners = ctx.listeners.get(eventName);

  if (!listeners) return false;

  // Remove the most recently registered instance, matching Node's lastIndexOf.
  let match: ListenerEntry<unknown> | undefined;
  for (const entry of listeners) {
    if (entry.listener === listener) {
      match = entry;
    }
  }

  if (!match) return false;

  listeners.delete(match);
  match.subscription?.markUnsubscribed();
  emitMetaEvent(ctx, removeListenerEvent, listener);
  // Only drop the map entry if it is still the same (now empty) set — a
  // removeListener meta listener may have re-registered listeners (e.g. via
  // prependListener, which swaps the set), and those must survive.
  if (listeners.size === 0 && ctx.listeners.get(eventName) === listeners) {
    ctx.listeners.delete(eventName);
  }
  return true;
}
