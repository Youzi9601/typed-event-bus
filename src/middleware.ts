import type { EventDefinition, EventPayload, Middleware } from './types.js';

/**
 * Execute middleware chain.
 * Express/Koa-like middleware pattern.
 * Supports both sync and async middleware.
 *
 * @typeParam TEvent - EventDefinition type
 * @param middlewares - Array of middleware functions to execute in order
 * @param event - EventDefinition object
 * @param payload - Event payload
 * @param finalHandler - Final handler to call after all middleware complete
 */
export function executeMiddleware<TEvent extends EventDefinition<string, unknown>>(
  middlewares: Middleware[],
  event: TEvent,
  payload: EventPayload<TEvent>,
  finalHandler: () => void | Promise<void>
): void {
  let index = 0;

  function next(): void | Promise<void> {
    if (index >= middlewares.length) {
      return finalHandler();
    }

    const middleware = middlewares[index++];
    try {
      const result = middleware?.(event, payload, next);
      if (result !== undefined) {
        if (result && typeof result === 'object' && 'then' in result) {
          return (result as Promise<void>).then(() => next());
        }
      }
    } catch (_error) {
      return finalHandler();
    }
  }

  next();
}

/**
 * Logging middleware factory.
 * Creates middleware that logs each event to provided logger function.
 *
 * @param logger - Function receiving (eventName, payload) for each event
 * @returns Middleware function
 *
 * @example
 * const loggingMiddleware = createLoggingMiddleware((name, payload) => {
 *   console.log(`[${new Date().toISOString()}] ${name}`, payload)
 * })
 * bus.use(loggingMiddleware)
 */
export function createLoggingMiddleware(
  logger: (eventName: string, payload: unknown) => void = (_name, _payload) => {}
): Middleware {
  return (event, payload, next) => {
    logger(event.name, payload);
    next();
  };
}

/**
 * Timing middleware factory.
 * Creates middleware that measures event handler execution time.
 *
 * @param onTiming - Function receiving (eventName, durationMs) after each event
 * @returns Middleware function
 *
 * @example
 * const timingMiddleware = createTimingMiddleware((name, ms) => {
 *   metrics.histogram("event.duration", ms, { event: name })
 * })
 * bus.use(timingMiddleware)
 */
export function createTimingMiddleware(
  onTiming: (eventName: string, durationMs: number) => void = (_name, _ms) => {}
): Middleware {
  return (event, _payload, next) => {
    const start = performance.now();
    next();
    const duration = performance.now() - start;
    onTiming(event.name, duration);
  };
}

/**
 * Metrics middleware factory (for custom metrics collection).
 * Creates middleware that records payload size for each event.
 *
 * @param record - Function receiving (eventName, payloadSize) for each event
 * @returns Middleware function
 *
 * @example
 * const metricsMiddleware = createMetricsMiddleware((name, size) => {
 *   metrics.counter("event.payload.size", 1, { event: name, size })
 * })
 * bus.use(metricsMiddleware)
 */
export function createMetricsMiddleware(
  record: (eventName: string, payloadSize: number) => void
): Middleware {
  return (event, payload, next) => {
    const size = JSON.stringify(payload).length;
    record(event.name, size);
    next();
  };
}
