import type { EventDefinition, EventPayload, Middleware } from './types.js';

export function isThenable(value: unknown): value is Promise<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

/**
 * Execute middleware chain.
 * Express/Koa-like middleware pattern.
 * Supports both sync and async middleware.
 *
 * Each middleware is invoked exactly once, and its `next` gate can only be
 * opened once (subsequent calls are ignored). The returned promise resolves
 * only after the whole chain — including the final handler and every async
 * middleware — has completed, so callers (e.g. emitAsync) can await it.
 *
 * Error behavior: if a middleware throws (synchronously or via a rejected
 * promise), the chain is stopped and the returned promise rejects. The error
 * cannot be intercepted by upstream middleware via `try/catch` around
 * `next()` — the chain is aborted regardless.
 *
 * `next()` should be called during the middleware's own execution (synchronously
 * or within its returned promise). If a middleware schedules `next()` after its
 * work has settled (e.g. via setTimeout), the late chain still runs — after the
 * returned promise has resolved — and errors in such late segments are
 * suppressed instead of surfacing as unhandled rejections.
 *
 * @typeParam TEvent - EventDefinition type
 * @param middlewares - Array of middleware functions to execute in order
 * @param event - EventDefinition object
 * @param payload - Event payload
 * @param finalHandler - Final handler to call after all middleware complete
 * @returns Promise that resolves when the chain and final handler complete
 */
export function executeMiddleware<TEvent extends EventDefinition<string, unknown>>(
  middlewares: Middleware[],
  event: TEvent,
  payload: EventPayload<TEvent>,
  finalHandler: () => void | Promise<void>
): Promise<void> {
  let chain: Promise<void> = Promise.resolve();
  const advanced = new Set<number>();

  function dispatch(position: number): Promise<void> {
    if (advanced.has(position)) {
      return chain;
    }
    advanced.add(position);

    let result: unknown;
    try {
      result =
        position >= middlewares.length
          ? finalHandler()
          : middlewares[position]?.(event, payload, () => dispatch(position + 1));
    } catch (error) {
      chain = chain.then(() => Promise.reject(error));
      void chain.catch(() => {});
      return chain;
    }

    if (isThenable(result)) {
      chain = chain.then(() => result as Promise<void>);
    }

    // Safety net: a middleware may call next() after its own work has
    // settled (e.g. via setTimeout). Such late chain segments may reject
    // after the returned promise has already resolved; attach a no-op
    // rejection handler so they never surface as unhandled rejections.
    void chain.catch(() => {});

    return chain;
  }

  dispatch(0);

  // `chain` may keep growing while async middleware (or a late next() call)
  // opens more gates after we started awaiting. Re-read it after every
  // settlement until it stops changing, so the returned promise only
  // resolves once the whole chain (and the final handler) has completed.
  return (async () => {
    let previous: Promise<void> | undefined;
    let current = chain;
    while (current !== previous) {
      previous = current;
      await current;
      current = chain;
    }
  })();
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
    // next() always returns a promise (the chain); report when the chain
    // settles, whether it resolves or rejects.
    next().then(
      () => {
        onTiming(event.name, performance.now() - start);
      },
      () => {
        onTiming(event.name, performance.now() - start);
      }
    );
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
    const size = safePayloadSize(payload);
    record(event.name, size);
    next();
  };
}

/**
 * Best-effort payload size estimation.
 * Falls back to key count when JSON.stringify cannot serialize the payload
 * (circular references, BigInt), so metrics never break the event chain.
 */
function safePayloadSize(payload: unknown): number {
  try {
    return JSON.stringify(payload).length;
  } catch {
    try {
      return Object.keys(payload as object).length;
    } catch {
      return 0;
    }
  }
}
