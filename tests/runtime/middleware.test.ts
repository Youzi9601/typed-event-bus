/**
 * Runtime tests for middleware
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEventBus,
  createLoggingMiddleware,
  createMetricsMiddleware,
  createTimingMiddleware,
  defineEvent,
  defineEvents,
} from '../../src/index';

describe('middleware', () => {
  let bus: ReturnType<typeof createEventBus>;
  const userCreated = defineEvent('user.created').payload<{ id: string; name: string }>();

  beforeEach(() => {
    bus = createEventBus(userCreated);
  });

  it('executes middleware before listeners', () => {
    const middleware = vi.fn((_event, _payload, next) => {
      next();
    });
    const listener = vi.fn();

    bus.use(middleware);
    bus.on(userCreated, listener);

    bus.emit(userCreated, { id: '1', name: 'Alice' });

    expect(middleware).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledOnce();
    // middleware called before listener
    const mwOrder = middleware.mock.invocationCallOrder[0] ?? 0;
    const listenerOrder = listener.mock.invocationCallOrder[0] ?? 0;
    expect(mwOrder).toBeGreaterThan(0);
    expect(listenerOrder).toBeGreaterThan(0);
    expect(mwOrder).toBeLessThan(listenerOrder);
  });

  it('multiple middlewares execute in order', () => {
    const order: string[] = [];
    const mw1 = vi.fn((_event, _payload, next) => {
      order.push('mw1-start');
      next();
      order.push('mw1-end');
    });
    const mw2 = vi.fn((_event, _payload, next) => {
      order.push('mw2-start');
      next();
      order.push('mw2-end');
    });
    const listener = vi.fn(() => {
      order.push('listener');
    });

    bus.use(mw1);
    bus.use(mw2);
    bus.on(userCreated, listener);

    bus.emit(userCreated, { id: '1', name: 'Alice' });

    expect(order).toEqual(['mw1-start', 'mw2-start', 'listener', 'mw2-end', 'mw1-end']);
  });

  it('middleware can modify payload (by reference)', () => {
    // Use a mutable payload type
    const mutableEvent = defineEvent('test.mutable').payload<{
      id: string;
      name: string;
      modified?: boolean;
    }>();
    const mutableBus = createEventBus(mutableEvent);
    const middleware = vi.fn((_event, payload, next) => {
      (payload as { modified?: boolean }).modified = true;
      next();
    });
    const listener = vi.fn();

    mutableBus.use(middleware);
    mutableBus.on(mutableEvent, listener);

    const payload: { id: string; name: string; modified?: boolean } = { id: '1', name: 'Alice' };
    mutableBus.emit(mutableEvent, payload);

    expect(payload.modified).toBe(true);
    expect(listener).toHaveBeenCalledWith({ id: '1', name: 'Alice', modified: true });
  });

  it('middleware can skip listener by not calling next', () => {
    const middleware = vi.fn((_event, _payload, _next) => {
      // Don't call next, listener won't execute
    });
    const listener = vi.fn();

    bus.use(middleware);
    bus.on(userCreated, listener);

    bus.emit(userCreated, { id: '1', name: 'Alice' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('works with emitAsync', async () => {
    const middleware = vi.fn((_event, _payload, next) => {
      next();
    });
    const asyncListener = vi.fn(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    bus.use(middleware);
    bus.on(userCreated, asyncListener);

    await bus.emitAsync(userCreated, { id: '1', name: 'Alice' });

    expect(middleware).toHaveBeenCalledOnce();
    expect(asyncListener).toHaveBeenCalledOnce();
  });

  it('emitAsync awaits async middleware and calls listeners exactly once', async () => {
    const order: string[] = [];
    bus.use(async (_event, _payload, next) => {
      await new Promise(r => setTimeout(r, 10));
      order.push('m1');
      next();
    });
    bus.on(userCreated, async () => {
      order.push('l');
    });

    await bus.emitAsync(userCreated, { id: '1', name: 'Alice' });

    expect(order).toEqual(['m1', 'l']);
  });

  it('emitAsync resolves only after async middleware and async listeners complete', async () => {
    const order: string[] = [];
    bus.use(async (_event, _payload, next) => {
      await new Promise(r => setTimeout(r, 10));
      order.push('m1');
      next();
    });
    bus.on(userCreated, async () => {
      await new Promise(r => setTimeout(r, 10));
      order.push('l');
    });

    await bus.emitAsync(userCreated, { id: '1', name: 'Alice' });

    expect(order).toEqual(['m1', 'l']);
  });

  it('async middleware awaiting next() still runs listeners exactly once', async () => {
    const order: string[] = [];
    bus.use(async (_event, _payload, next) => {
      order.push('m1-start');
      await next();
      order.push('m1-end');
    });
    bus.on(userCreated, () => {
      order.push('l');
    });

    await bus.emitAsync(userCreated, { id: '1', name: 'Alice' });

    expect(order).toEqual(['m1-start', 'l', 'm1-end']);
  });

  it('multiple async middlewares run in order with emitAsync', async () => {
    const order: string[] = [];
    bus.use(async (_event, _payload, next) => {
      await new Promise(r => setTimeout(r, 5));
      order.push('mw1');
      next();
    });
    bus.use(async (_event, _payload, next) => {
      await new Promise(r => setTimeout(r, 5));
      order.push('mw2');
      next();
    });
    bus.on(userCreated, () => {
      order.push('l');
    });

    await bus.emitAsync(userCreated, { id: '1', name: 'Alice' });

    expect(order).toEqual(['mw1', 'mw2', 'l']);
  });

  it('sync emit does not double-invoke listeners with async middleware', async () => {
    const order: string[] = [];
    bus.use(async (_event, _payload, next) => {
      await new Promise(r => setTimeout(r, 5));
      order.push('m1');
      next();
    });
    bus.on(userCreated, () => {
      order.push('l');
    });

    bus.emit(userCreated, { id: '1', name: 'Alice' });

    expect(order).toEqual([]);
    await new Promise(r => setTimeout(r, 20));
    expect(order).toEqual(['m1', 'l']);
  });

  it('built-in logging middleware', () => {
    const logger = vi.fn();
    const loggingMw = createLoggingMiddleware(logger);
    const listener = vi.fn();

    bus.use(loggingMw);
    bus.on(userCreated, listener);

    bus.emit(userCreated, { id: '1', name: 'Alice' });

    expect(logger).toHaveBeenCalledWith('user.created', { id: '1', name: 'Alice' });
    expect(listener).toHaveBeenCalledOnce();
  });

  it('built-in timing middleware', async () => {
    const timing = vi.fn();
    const timingMw = createTimingMiddleware(timing);
    const listener = vi.fn();

    bus.use(timingMw);
    bus.on(userCreated, listener);

    bus.emit(userCreated, { id: '1', name: 'Alice' });
    await new Promise(r => setTimeout(r, 0));

    expect(timing).toHaveBeenCalledOnce();
    const firstCall = timing.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(firstCall?.[0]).toBe('user.created');
    expect(typeof firstCall?.[1]).toBe('number');
    expect(listener).toHaveBeenCalledOnce();
  });

  it('timing middleware measures async middleware duration', async () => {
    const timing = vi.fn();
    bus.use(createTimingMiddleware(timing));
    bus.use(async (_event, _payload, next) => {
      await new Promise(r => setTimeout(r, 20));
      next();
    });
    bus.on(userCreated, () => {});

    await bus.emitAsync(userCreated, { id: '1', name: 'Alice' });

    expect(timing).toHaveBeenCalledOnce();
    const duration = timing.mock.calls[0]?.[1] ?? 0;
    expect(duration).toBeGreaterThanOrEqual(10);
  });

  it('ignores duplicate next() calls from the same middleware', () => {
    const listener = vi.fn();
    bus.use((_event, _payload, next) => {
      next();
      next();
    });
    bus.on(userCreated, listener);

    bus.emit(userCreated, { id: '1', name: 'Alice' });

    expect(listener).toHaveBeenCalledOnce();
  });

  it('ignores duplicate next() calls from async middleware', async () => {
    const listener = vi.fn();
    bus.use(async (_event, _payload, next) => {
      next();
      next();
    });
    bus.on(userCreated, listener);

    await bus.emitAsync(userCreated, { id: '1', name: 'Alice' });

    expect(listener).toHaveBeenCalledOnce();
  });

  it('sync middleware throw stops chain and reports via onError (emit)', async () => {
    const onError = vi.fn();
    const errorBus = createEventBus(userCreated, { onError });
    errorBus.use((_event, _payload, _next) => {
      throw new Error('mw boom');
    });
    const listener = vi.fn();
    errorBus.on(userCreated, listener);

    errorBus.emit(userCreated, { id: '1', name: 'Alice' });
    await new Promise(r => setTimeout(r, 0));

    expect(onError).toHaveBeenCalledOnce();
    expect(listener).not.toHaveBeenCalled();
  });

  it('async middleware rejection aggregates into MultiError and reports via onError (emitAsync)', async () => {
    const onError = vi.fn();
    const errorBus = createEventBus(userCreated, { onError });
    errorBus.use(async (_event, _payload, _next) => {
      throw new Error('mw async boom');
    });
    errorBus.on(userCreated, vi.fn());

    await expect(errorBus.emitAsync(userCreated, { id: '1', name: 'Alice' })).rejects.toMatchObject(
      {
        name: 'MultiError',
        errors: [expect.objectContaining({ message: 'mw async boom' })],
      }
    );
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'mw async boom' }),
      userCreated,
      { id: '1', name: 'Alice' }
    );
  });

  it('sync middleware throw aggregates into MultiError (emitAsync)', async () => {
    const errorBus = createEventBus(userCreated);
    errorBus.use((_event, _payload, _next) => {
      throw new Error('mw sync boom');
    });
    errorBus.on(userCreated, vi.fn());

    await expect(errorBus.emitAsync(userCreated, { id: '1', name: 'Alice' })).rejects.toMatchObject(
      {
        name: 'MultiError',
        errors: [expect.objectContaining({ message: 'mw sync boom' })],
      }
    );
  });

  it('built-in metrics middleware', () => {
    const record = vi.fn();
    const metricsMw = createMetricsMiddleware(record);
    const listener = vi.fn();

    bus.use(metricsMw);
    bus.on(userCreated, listener);

    bus.emit(userCreated, { id: '1', name: 'Alice' });

    expect(record).toHaveBeenCalledWith('user.created', expect.any(Number));
    expect(listener).toHaveBeenCalledOnce();
  });

  it('metrics middleware survives circular payload without breaking the event chain', () => {
    const record = vi.fn();
    const metricsMw = createMetricsMiddleware(record);
    const listener = vi.fn();
    const anyPayloadEvent = defineEvent('test.any');

    const anyBus = createEventBus(anyPayloadEvent);
    anyBus.use(metricsMw);
    anyBus.on(anyPayloadEvent, listener);

    const circular: { id: string; self?: unknown } = { id: '1' };
    circular.self = circular;
    anyBus.emit(anyPayloadEvent, circular);

    expect(listener).toHaveBeenCalledOnce();
    expect(record).toHaveBeenCalledWith('test.any', expect.any(Number));
  });

  it('late next() from a timer still executes listeners (after emitAsync resolved)', async () => {
    const order: string[] = [];
    const lateBus = createEventBus(userCreated);
    lateBus.use((_event, _payload, next) => {
      setTimeout(() => next(), 5);
    });
    lateBus.on(userCreated, () => {
      order.push('l');
    });

    await lateBus.emitAsync(userCreated, { id: '1', name: 'Alice' });
    expect(order).toEqual([]);
    await new Promise(r => setTimeout(r, 20));
    expect(order).toEqual(['l']);
  });

  it('late next() errors do not become unhandled rejections', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (error: unknown) => {
      unhandled.push(error);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const lateBus = createEventBus(userCreated);
      lateBus.use((_event, _payload, next) => {
        setTimeout(() => next(), 5);
      });
      lateBus.use(async (_event, _payload, _next) => {
        throw new Error('late boom');
      });
      const listener = vi.fn();
      lateBus.on(userCreated, listener);

      await lateBus.emitAsync(userCreated, { id: '1', name: 'Alice' });
      await new Promise(r => setTimeout(r, 20));

      expect(listener).not.toHaveBeenCalled();
      expect(unhandled).toHaveLength(0);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});

describe('middleware with onAll', () => {
  it('middleware executes for wildcard handlers too', () => {
    const userEvents = defineEvents('user', {
      created: defineEvent('created').payload<{ id: string }>(),
      deleted: defineEvent('deleted').payload<{ id: string }>(),
    });
    const bus = createEventBus(userEvents);

    const middleware = vi.fn((_event, _payload, next) => {
      next();
    });
    const handler = vi.fn();

    bus.use(middleware);
    bus.onAll(userEvents, handler);

    bus.emit(userEvents.created, { id: '1' });

    expect(middleware).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledOnce();
  });
});
