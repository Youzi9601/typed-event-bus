import { executeMiddleware } from '../middleware.js';
import type { EventDefinition, EventPayload } from '../types.js';
import type { BusContext } from './context.js';

/**
 * Emit event (sync, fire-and-forget).
 * Catches each listener exception, calls onError, continues remaining listeners.
 *
 * @param ctx BusContext
 * @param event EventDefinition object
 * @param payload type auto-inferred from EventDefinition
 * @returns Whether any listener was called
 */
export function emit<TEvent extends EventDefinition<string, unknown>>(
  ctx: BusContext,
  event: TEvent,
  payload: EventPayload<TEvent>
): boolean {
  const eventName = event.name;
  const listeners = ctx.listeners.get(eventName);

  if (!listeners || listeners.size === 0) {
    if (ctx.options.debug) {
      console.debug(`[typed-event-bus] No listeners for "${eventName}"`);
    }
    return false;
  }

  const executeHandlers = () => {
    for (const entry of listeners) {
      const listener = entry.listener;

      let result: unknown;
      try {
        result = listener(payload);
      } catch (error) {
        ctx.options.onError(error, event, payload);
        if (ctx.options.debug) {
          console.debug(`[typed-event-bus] Listener error handled for "${eventName}"`);
        }
        if (entry.once) {
          listeners.delete(entry);
          if (listeners.size === 0) {
            ctx.listeners.delete(eventName);
          }
        }
        continue;
      }

      const isAsync = result instanceof Promise;

      if (isAsync) {
        (result as Promise<unknown>).then(
          () => {},
          error => {
            ctx.options.onError(error, event, payload);
            if (ctx.options.debug) {
              console.debug(`[typed-event-bus] Listener error handled for "${eventName}"`);
            }
          }
        );
      }

      if (entry.once) {
        if (isAsync) {
          Promise.resolve(result).then(() => {
            listeners.delete(entry);
            if (listeners.size === 0) {
              ctx.listeners.delete(eventName);
            }
          });
        } else {
          listeners.delete(entry);
          if (listeners.size === 0) {
            ctx.listeners.delete(eventName);
          }
        }
      }
    }
  };

  if (ctx.middlewares.length > 0) {
    executeMiddleware(ctx.middlewares, event, payload, executeHandlers);
  } else {
    executeHandlers();
  }

  return true;
}
