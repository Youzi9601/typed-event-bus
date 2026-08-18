import { removeListenerEvent } from '../constants.js';
import { MultiError } from '../errors.js';
import { executeMiddleware, isThenable } from '../middleware.js';
import type { EventDefinition, EventPayload } from '../types.js';
import type { BusContext, ListenerEntry } from './context.js';
import { emitMetaEvent, getResolved } from './utils.js';

/** Options for emitAsync execution mode */
export interface EmitAsyncOptions {
  /** Execute async listeners sequentially (Node strict order), default: false (parallel) */
  sequential?: boolean;
}

/**
 * Emit event and await all async listeners.
 * By default, async listeners are executed in parallel (Promise.all) for performance.
 * Pass { sequential: true } to execute them in registration order (Node strict order).
 * Collects all exceptions and throws as MultiError.
 * Listeners are snapshotted at emission start (Node EventEmitter semantics):
 * listeners registered during the emit are not invoked in the current emit;
 * listeners removed during the emit are still invoked in the current emit.
 *
 * @param ctx BusContext
 * @param event EventDefinition object
 * @param payload type auto-inferred from EventDefinition
 * @param options Execution options: { sequential?: boolean }
 * @throws MultiError when any listener or middleware throws
 */
export async function emitAsync<TEvent extends EventDefinition<string, unknown>>(
  ctx: BusContext,
  event: TEvent,
  payload: EventPayload<TEvent>,
  options: EmitAsyncOptions = {}
): Promise<void> {
  const eventName = event.name;
  const bucket = ctx.listeners.get(eventName);

  if (!bucket || bucket.set.size === 0) {
    if (ctx.options.debug) {
      console.debug(`[typed-event-bus] No listeners for "${eventName}"`);
    }
    return;
  }

  // bucket is guaranteed non-null/non-empty from here
  const b = bucket;

  const errors: unknown[] = [];

  // Snapshot the listener set at emission start (Node EventEmitter
  // semantics): listeners registered during this emit are not invoked in
  // the current emit; listeners removed during this emit are still invoked.
  const snapshot = getResolved(b);

  // Helper to execute a single entry and collect errors
  async function executeEntry(entry: ListenerEntry<unknown>): Promise<void> {
    if (entry.once) {
      entry.subscription?.markUnsubscribed?.();
      b.set.delete(entry);
      emitMetaEvent(ctx, removeListenerEvent, entry.listener);

      // Invalidate cache on mutation (once auto-removal)
      b.resolved = null;
    }

    let result: unknown;
    try {
      result = entry.listener(payload);
    } catch (error) {
      errors.push(error);
      ctx.options.onError(error, event, payload);
      return;
    }

    if (isThenable(result)) {
      try {
        await result;
      } catch (error) {
        errors.push(error);
        ctx.options.onError(error, event, payload);
      }
    }
  }

  // Execute all listeners according to mode (sequential/parallel)
  async function executeAllListeners(): Promise<void> {
    if (options.sequential) {
      // Sequential execution (Node strict order): await each async listener
      for (const entry of snapshot) {
        await executeEntry(entry);
      }
    } else {
      // Parallel execution (default): trigger all, await all
      await Promise.all(snapshot.map(entry => executeEntry(entry)));
    }

    // Only drop the map entry if it is still the same (now empty) set —
    // a listener may have registered new listeners during emission,
    // which must not be removed.
    if (b.set.size === 0 && ctx.listeners.get(eventName) === b) {
      ctx.listeners.delete(eventName);
    }
  }

  if (ctx.middlewares.length > 0) {
    // Middleware chain wraps the entire listener execution
    try {
      await executeMiddleware(ctx.middlewares, event, payload, executeAllListeners);
    } catch (error) {
      errors.push(error);
      ctx.options.onError(error, event, payload);
    }
  } else {
    await executeAllListeners();
  }

  if (errors.length > 0) {
    throw new MultiError(errors);
  }
}
