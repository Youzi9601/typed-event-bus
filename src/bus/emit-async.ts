import { removeListenerEvent } from '../constants.js';
import { MultiError } from '../errors.js';
import { executeMiddleware, isThenable } from '../middleware.js';
import type { EventDefinition, EventPayload } from '../types.js';
import type { BusContext } from './context.js';
import { emitMetaEvent } from './utils.js';

/**
 * Emit event and await all async listeners.
 * Collects all exceptions and throws as MultiError.
 * Listeners are snapshotted at emission start (Node EventEmitter semantics):
 * listeners registered during the emit are not invoked in the current emit;
 * listeners removed during the emit are still invoked in the current emit.
 *
 * @param ctx BusContext
 * @param event EventDefinition object
 * @param payload type auto-inferred from EventDefinition
 * @throws MultiError when any listener or middleware throws
 */
export async function emitAsync<TEvent extends EventDefinition<string, unknown>>(
  ctx: BusContext,
  event: TEvent,
  payload: EventPayload<TEvent>
): Promise<void> {
  const eventName = event.name;
  const listeners = ctx.listeners.get(eventName);

  if (!listeners || listeners.size === 0) {
    if (ctx.options.debug) {
      console.debug(`[typed-event-bus] No listeners for "${eventName}"`);
    }
    return;
  }

  const errors: unknown[] = [];

  const executeHandlers = async () => {
    // Snapshot the listener set at emission start (Node EventEmitter
    // semantics): listeners registered during this emit are not invoked in
    // the current emit; listeners removed during this emit are still invoked.
    const snapshot = [...listeners];
    for (const entry of snapshot) {
      if (entry.once) {
        // Remove the exact once entry from the map's current set — bus.off
        // would remove the most recently registered instance (Node lastIndexOf
        // semantics), and the captured set may be stale if a prependListener
        // swapped the set during this emit.
        entry.subscription?.markUnsubscribed();
        ctx.listeners.get(eventName)?.delete(entry);
        emitMetaEvent(ctx, removeListenerEvent, entry.listener);
      }

      let result: unknown;
      try {
        result = entry.listener(payload);
      } catch (error) {
        errors.push(error);
        ctx.options.onError(error, event, payload);
        continue;
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

    // Only drop the map entry if it is still the same (now empty) set —
    // a listener may have registered new listeners during emission,
    // which must not be removed.
    if (listeners.size === 0 && ctx.listeners.get(eventName) === listeners) {
      ctx.listeners.delete(eventName);
    }
  };

  if (ctx.middlewares.length > 0) {
    try {
      await executeMiddleware(ctx.middlewares, event, payload, executeHandlers);
    } catch (error) {
      errors.push(error);
      ctx.options.onError(error, event, payload);
    }
  } else {
    await executeHandlers();
  }

  if (errors.length > 0) {
    throw new MultiError(errors);
  }
}
