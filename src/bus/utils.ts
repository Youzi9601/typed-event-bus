import type { EventDefinition } from '../types.js';
import type { BusContext } from './context.js';

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
 * Remove all listeners.
 *
 * @param ctx BusContext
 * @param event optional EventDefinition to remove specific event listeners
 */
export function removeAllListeners(
  ctx: BusContext,
  event?: EventDefinition<string, unknown>
): void {
  if (event) {
    ctx.listeners.delete(event.name);
  } else {
    ctx.listeners.clear();
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
