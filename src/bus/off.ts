import type { EventDefinition, Listener } from '../types.js';
import type { BusContext } from './context.js';

/**
 * Remove specific listener.
 * Usually called via Subscription.unsubscribe().
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

  for (const entry of listeners) {
    if (entry.listener === listener) {
      listeners.delete(entry);
      if (listeners.size === 0) {
        ctx.listeners.delete(eventName);
      }
      return true;
    }
  }

  return false;
}
