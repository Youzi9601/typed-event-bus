import { executeMiddleware } from '../middleware.js';
import type { EventDefinition, EventPayload } from '../types.js';
import type { BusContext } from './context.js';
import { runListeners } from './utils.js';

/**
 * Emit event (sync, fire-and-forget).
 * Catches each listener exception, calls onError, continues remaining listeners.
 * Listeners are snapshotted at emission start (Node EventEmitter semantics):
 * listeners registered during the emit are not invoked in the current emit;
 * listeners removed during the emit are still invoked in the current emit.
 *
 * @param ctx BusContext
 * @param event EventDefinition object
 * @param payload type auto-inferred from EventDefinition
 * @returns `true` if listeners were registered for the event, `false` otherwise
 */
export function emit<TEvent extends EventDefinition<string, unknown>>(
  ctx: BusContext,
  event: TEvent,
  payload: EventPayload<TEvent>
): boolean {
  const eventName = event.name;
  const listeners = ctx.listeners.get(eventName);

  if (!listeners?.size) {
    if (ctx.options.debug) {
      console.debug(`[typed-event-bus] No listeners for "${eventName}"`);
    }
    return false;
  }

  if (ctx.middlewares.length > 0) {
    executeMiddleware(ctx.middlewares, event, payload, () =>
      runListeners(ctx, event, listeners, payload)
    ).catch(error => {
      ctx.options.onError(error, event, payload);
    });
  } else {
    runListeners(ctx, event, listeners, payload);
  }

  return true;
}
