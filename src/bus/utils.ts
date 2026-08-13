import { removeListenerEvent } from '../constants.js';
import { isThenable } from '../middleware.js';
import type { EventDefinition, Listener } from '../types.js';
import type { BusContext, ListenerEntry } from './context.js';

/**
 * Invoke all listeners in the set with snapshot semantics (Node EventEmitter):
 * listeners registered during the emit are not invoked in the current emit;
 * listeners removed during the emit are still invoked. Once listeners are
 * removed before invocation. Listener errors (sync and async) route to onError.
 *
 * @param ctx BusContext
 * @param event EventDefinition object (used for onError and map cleanup)
 * @param listeners the live listener set
 * @param payload event payload
 */
export function runListeners(
  ctx: BusContext,
  event: EventDefinition<string, unknown>,
  listeners: Set<ListenerEntry<unknown>>,
  payload: unknown
): void {
  const snapshot = [...listeners];

  for (const entry of snapshot) {
    if (entry.once) {
      // Remove the exact once entry from the map's current set — bus.off
      // would remove the most recently registered instance (Node lastIndexOf
      // semantics), and the captured set may be stale if a prependListener
      // swapped the set during this emit.
      entry.subscription?.markUnsubscribed();
      ctx.listeners.get(event.name)?.delete(entry);
      emitMetaEvent(ctx, removeListenerEvent, entry.listener);
    }

    let result: unknown;
    try {
      result = entry.listener(payload);
    } catch (error) {
      ctx.options.onError(error, event, payload);
      continue;
    }

    if (isThenable(result)) {
      (result as Promise<unknown>).then(
        () => {},
        error => {
          ctx.options.onError(error, event, payload);
        }
      );
    }
  }

  // Only drop the map entry if it is still the same (now empty) set —
  // a listener may have registered new listeners during emission,
  // which must not be removed.
  if (listeners.size === 0 && ctx.listeners.get(event.name) === listeners) {
    ctx.listeners.delete(event.name);
  }
}

/**
 * Emit an internal meta event (newListener / removeListener) to listeners
 * subscribed under those names. Follows the same listener semantics as emit
 * (snapshot iteration, once auto-removal, error containment via onError),
 * but does not run middleware.
 *
 * @param ctx BusContext
 * @param event meta event definition ('newListener' | 'removeListener')
 * @param payload the listener being registered / removed
 */
export function emitMetaEvent(
  ctx: BusContext,
  event: EventDefinition<string, unknown>,
  payload: Listener<unknown>
): void {
  const listeners = ctx.listeners.get(event.name);
  if (!listeners?.size) return;
  runListeners(ctx, event, listeners, payload);
}

/**
 * Get listener count for an event.
 *
 * @param ctx BusContext
 * @param event EventDefinition object
 * @returns number of listeners
 */
export function listenerCount(ctx: BusContext, event: EventDefinition<string, unknown>): number {
  const listeners = ctx.listeners.get(event.name);
  return listeners?.size ?? 0;
}

/**
 * Get all registered event names.
 *
 * @param ctx BusContext
 * @returns array of event names
 */
export function eventNames(ctx: BusContext): string[] {
  return Array.from(ctx.listeners.keys());
}

/**
 * Get all registered listeners for an event, in registration order.
 * Follows Node's rawListeners: returns the plain listener functions.
 *
 * @param ctx BusContext
 * @param event EventDefinition object
 * @returns array of listener functions
 */
export function rawListeners(
  ctx: BusContext,
  event: EventDefinition<string, unknown>
): Listener<unknown>[] {
  const listeners = ctx.listeners.get(event.name);
  return listeners ? Array.from(listeners, entry => entry.listener) : [];
}

/**
 * Remove all listeners.
 * Emits the `removeListener` meta event for each removed listener
 * (Node semantics, in reverse registration order).
 *
 * @param ctx BusContext
 * @param event optional EventDefinition to remove specific event listeners
 */
export function removeAllListeners(
  ctx: BusContext,
  event?: EventDefinition<string, unknown>
): void {
  const names = event ? [event.name] : Array.from(ctx.listeners.keys());

  for (const eventName of names) {
    const listeners = ctx.listeners.get(eventName);
    if (!listeners) continue;

    for (const entry of [...listeners].reverse()) {
      // Node semantics: the listener is removed before the meta event fires,
      // so a removed listener never observes its own removal.
      entry.subscription?.markUnsubscribed();
      listeners.delete(entry);
      emitMetaEvent(ctx, removeListenerEvent, entry.listener);
    }
    // Keep the map entry if the same set received new listeners while the
    // removeListener meta events were firing (re-registration must survive).
    if (listeners.size === 0 && ctx.listeners.get(eventName) === listeners) {
      ctx.listeners.delete(eventName);
    }
  }
}

/**
 * Add middleware.
 * Execution order: FIFO.
 *
 * @param ctx BusContext
 * @param middleware middleware function
 */
export function use(ctx: BusContext, middleware: import('../types.js').Middleware): void {
  ctx.middlewares.push(middleware);
}
