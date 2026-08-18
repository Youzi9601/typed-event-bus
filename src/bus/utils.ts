import { removeListenerEvent } from '../constants.js';
import { isThenable } from '../middleware.js';
import type { EventDefinition, Listener } from '../types.js';
import type { BusContext, ListenerBucket, ListenerEntry } from './context.js';

/**
 * Build or retrieve the resolved listener array for fast emit iteration.
 * Lazily builds on first use; caches until the bucket is mutated (set to null).
 */
export function getResolved(bucket: ListenerBucket): ListenerEntry<unknown>[] {
  if (bucket.resolved) return bucket.resolved;
  bucket.resolved = [...bucket.set];
  return bucket.resolved;
}

/**
 * Invoke all listeners in the set with snapshot semantics (Node EventEmitter):
 * listeners registered during the emit are not invoked in the current emit;
 * listeners removed during the emit are still invoked. Once listeners are
 * removed before invocation. Listener errors (sync and async) route to onError.
 *
 * @param ctx BusContext
 * @param event EventDefinition object (used for onError and map cleanup)
 * @param bucket the live listener bucket
 * @param payload event payload
 */
export function runListeners(
  ctx: BusContext,
  event: EventDefinition<string, unknown>,
  bucket: ListenerBucket,
  payload: unknown
): void {
  const snapshot = getResolved(bucket);

  for (const entry of snapshot) {
    if (entry.once) {
      // Remove the exact once entry from the map's current set — bus.off
      // would remove the most recently registered instance (Node lastIndexOf
      // semantics), and the captured set may be stale if a prependListener
      // swapped the set during this emit.
      entry.subscription?.markUnsubscribed();
      bucket.set.delete(entry);
      emitMetaEvent(ctx, removeListenerEvent, entry.listener);

      // Invalidate cache on mutation (once auto-removal)
      bucket.resolved = null;
    }

    let result: unknown;
    try {
      result = entry.listener(payload);
    } catch (error) {
      ctx.options.onError(error, event, payload);
      continue;
    }

    // `entry.isAsync` is a best-effort cache; fall through to `isThenable`
    // for listeners declared as regular functions that return a Promise.
    // `isAsync ?? isThenable` would be wrong here: `false ?? x = false`
    // short-circuits the fallback and lets a rejected Promise escape as an
    // unhandled rejection. Use `||` so the runtime check always runs.
    if (entry.isAsync || isThenable(result)) {
      (result as Promise<unknown>).then(
        () => {},
        error => {
          ctx.options.onError(error, event, payload);
        }
      );
    }
  }

  // Only drop the map entry if it is still the same (now empty) bucket —
  // a listener may have registered new listeners during emission,
  // which must not be removed.
  if (bucket.set.size === 0 && ctx.listeners.get(event.name) === bucket) {
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
  const bucket = ctx.listeners.get(event.name);
  if (!bucket?.set.size) return;
  runListeners(ctx, event, bucket, payload);
}

/**
 * Get listener count for an event.
 *
 * @param ctx BusContext
 * @param event EventDefinition object
 * @returns number of listeners
 */
export function listenerCount(ctx: BusContext, event: EventDefinition<string, unknown>): number {
  const bucket = ctx.listeners.get(event.name);
  return bucket?.set.size ?? 0;
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
  const bucket = ctx.listeners.get(event.name);
  return bucket ? Array.from(bucket.set, entry => entry.listener) : [];
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
    const bucket = ctx.listeners.get(eventName);
    if (!bucket) continue;

    for (const entry of [...bucket.set].reverse()) {
      // Node semantics: the listener is removed before the meta event fires,
      // so a removed listener never observes its own removal.
      entry.subscription?.markUnsubscribed();
      bucket.set.delete(entry);
      emitMetaEvent(ctx, removeListenerEvent, entry.listener);
    }
    // Keep the map entry if the same set received new listeners while the
    // removeListener meta events were firing (re-registration must survive).
    if (bucket.set.size === 0 && ctx.listeners.get(eventName) === bucket) {
      ctx.listeners.delete(eventName);
    } else {
      // Invalidate resolved cache on mutation
      bucket.resolved = null;
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
