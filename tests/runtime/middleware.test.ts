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

  it('built-in timing middleware', () => {
    const timing = vi.fn();
    const timingMw = createTimingMiddleware(timing);
    const listener = vi.fn();

    bus.use(timingMw);
    bus.on(userCreated, listener);

    bus.emit(userCreated, { id: '1', name: 'Alice' });

    expect(timing).toHaveBeenCalledOnce();
    const firstCall = timing.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(firstCall?.[0]).toBe('user.created');
    expect(typeof firstCall?.[1]).toBe('number');
    expect(listener).toHaveBeenCalledOnce();
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
