import { MultiError } from '../errors.js';
import { executeMiddleware } from '../middleware.js';
import type { EventDefinition, EventPayload } from '../types.js';
import type { BusContext } from './context.js';

/**
 * Emit event and await all async listeners.
 * Collects all exceptions and throws as MultiError.
 *
 * @param ctx BusContext
 * @param event EventDefinition object
 * @param payload type auto-inferred from EventDefinition
 * @throws MultiError when any listener throws
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
    for (const entry of listeners) {
      const listener = entry.listener;

      let result: unknown;
      try {
        result = listener(payload);
      } catch (error) {
        errors.push(error);
        ctx.options.onError(error, event, payload);
        if (entry.once) {
          listeners.delete(entry);
        }
        continue;
      }

      const isAsync = result instanceof Promise;

      if (isAsync) {
        try {
          await result;
        } catch (error) {
          errors.push(error);
          ctx.options.onError(error, event, payload);
        }
      }

      if (entry.once) {
        listeners.delete(entry);
      }
    }

    if (listeners.size === 0) {
      ctx.listeners.delete(eventName);
    }
  };

  if (ctx.middlewares.length > 0) {
    await executeMiddleware(ctx.middlewares, event, payload, executeHandlers);
  } else {
    await executeHandlers();
  }

  if (errors.length > 0) {
    throw new MultiError(errors);
  }
}
