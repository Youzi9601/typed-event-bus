/**
 * Runtime tests for error handling
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventBus, defineEvent, MultiError } from '../../src/index';

describe('error handling', () => {
  let bus: ReturnType<typeof createEventBus>;
  const userCreated = defineEvent('user.created').payload<{ id: string; name: string }>();

  beforeEach(() => {
    bus = createEventBus(userCreated);
  });

  it('calls onError when listener throws', () => {
    const onError = vi.fn();
    const errorBus = createEventBus(userCreated, { onError });

    const listener = vi.fn(() => {
      throw new Error('Test error');
    });
    errorBus.on(userCreated, listener);

    errorBus.emit(userCreated, { id: '1', name: 'Alice' });

    expect(onError).toHaveBeenCalledOnce();
    const firstCall = onError.mock.calls[0];
    expect(firstCall).toBeDefined();
    const error = firstCall?.[0];
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe('Test error');
    expect(firstCall?.[1].name).toBe('user.created');
    expect(firstCall?.[2]).toEqual({ id: '1', name: 'Alice' });
  });

  it('continues other listeners after error', () => {
    const onError = vi.fn();
    const errorBus = createEventBus(userCreated, { onError });

    const errorListener = vi.fn(() => {
      throw new Error('Error');
    });
    const successListener = vi.fn();
    errorBus.on(userCreated, errorListener);
    errorBus.on(userCreated, successListener);

    errorBus.emit(userCreated, { id: '1', name: 'Alice' });

    expect(errorListener).toHaveBeenCalledOnce();
    expect(successListener).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledOnce();
  });

  it('uses defaultErrorHandler when onError not provided', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const defaultBus = createEventBus(userCreated);

    const listener = vi.fn(() => {
      throw new Error('Default handler test');
    });
    defaultBus.on(userCreated, listener);

    defaultBus.emit(userCreated, { id: '1', name: 'Alice' });

    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('[typed-event-bus]'),
      expect.any(Error)
    );

    consoleError.mockRestore();
  });

  it('emitAsync throws MultiError for async listener errors', async () => {
    const asyncListener = vi.fn(async () => {
      throw new Error('Async error');
    });
    bus.on(userCreated, asyncListener);

    await expect(bus.emitAsync(userCreated, { id: '1', name: 'Alice' })).rejects.toThrow(
      'MultiError'
    );
  });

  it('MultiError contains all errors', async () => {
    const listener1 = vi.fn(async () => {
      throw new Error('Error 1');
    });
    const listener2 = vi.fn(async () => {
      throw new Error('Error 2');
    });
    bus.on(userCreated, listener1);
    bus.on(userCreated, listener2);

    try {
      await bus.emitAsync(userCreated, { id: '1', name: 'Alice' });
    } catch (e) {
      expect(e).toBeInstanceOf(MultiError);
      if (e instanceof MultiError) {
        expect(e.errors).toHaveLength(2);
        expect(e.errors[0]).toBeInstanceOf(Error);
        expect(e.errors[1]).toBeInstanceOf(Error);
      }
    }
  });

  it('MultiError includes sync listener errors', async () => {
    const syncListener = vi.fn(() => {
      throw new Error('Sync error');
    });
    const asyncListener = vi.fn(async () => {
      throw new Error('Async error');
    });
    bus.on(userCreated, syncListener);
    bus.on(userCreated, asyncListener);

    try {
      await bus.emitAsync(userCreated, { id: '1', name: 'Alice' });
    } catch (e) {
      if (e instanceof MultiError) {
        expect(e.errors).toHaveLength(2);
      }
    }
  });

  it('MultiError message includes error count', async () => {
    const listener1 = vi.fn(async () => {
      throw new Error('Error 1');
    });
    const listener2 = vi.fn(async () => {
      throw new Error('Error 2');
    });
    bus.on(userCreated, listener1);
    bus.on(userCreated, listener2);

    try {
      await bus.emitAsync(userCreated, { id: '1', name: 'Alice' });
    } catch (e) {
      if (e instanceof Error) {
        expect(e.message).toContain('2 errors');
      }
    }
  });

  it('onError still called for each error in emitAsync', async () => {
    const onError = vi.fn();
    const errorBus = createEventBus(userCreated, { onError });

    const listener1 = vi.fn(async () => {
      throw new Error('Error 1');
    });
    const listener2 = vi.fn(async () => {
      throw new Error('Error 2');
    });
    errorBus.on(userCreated, listener1);
    errorBus.on(userCreated, listener2);

    try {
      await errorBus.emitAsync(userCreated, { id: '1', name: 'Alice' });
    } catch (_e) {
      // onError called for each error
    }

    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('once listener removed after error', () => {
    const onError = vi.fn();
    const errorBus = createEventBus(userCreated, { onError });

    const onceListener = vi.fn(() => {
      throw new Error('Once error');
    });
    errorBus.once(userCreated, onceListener);

    errorBus.emit(userCreated, { id: '1', name: 'Alice' });
    errorBus.emit(userCreated, { id: '2', name: 'Bob' });

    expect(onceListener).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledOnce();
  });

  it('calls onError when listener returns rejected Promise (regular function)', () => {
    const onError = vi.fn();
    const errorBus = createEventBus(userCreated, { onError });

    // Regular (non-async) function that returns a rejected Promise. The async
    // detection cache marks it non-async, so the isThenable fallback must still
    // catch the rejection — regression test for the `isAsync ?? isThenable`
    // short-circuit bug that let this escape as an unhandled rejection
    // instead of routing to onError.
    function rejectingListener(): Promise<void> {
      return Promise.reject(new Error('Rejected promise'));
    }
    errorBus.on(userCreated, rejectingListener);

    expect(() => errorBus.emit(userCreated, { id: '1', name: 'Alice' })).not.toThrow();

    // Give the rejection handler a tick to fire
    return new Promise<void>(resolve => {
      setTimeout(() => {
        expect(onError).toHaveBeenCalledOnce();
        const error = onError.mock.calls[0]?.[0];
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Rejected promise');
        resolve();
      }, 20);
    });
  });
});

describe('MultiError class', () => {
  it('creates MultiError with errors array', () => {
    const errors = [new Error('Error 1'), new Error('Error 2')];
    const agg = new MultiError(errors);

    expect(agg).toBeInstanceOf(Error);
    expect(agg.name).toBe('MultiError');
    expect(agg.errors).toBe(errors);
    expect(agg.message).toBe('MultiError: 2 errors occurred during async emission');
  });

  it('accepts custom message', () => {
    const errors = [new Error('Error 1')];
    const agg = new MultiError(errors, 'Custom message');

    expect(agg.message).toBe('Custom message');
  });

  it('singular error message', () => {
    const errors = [new Error('Error 1')];
    const agg = new MultiError(errors);

    expect(agg.message).toBe('MultiError: 1 error occurred during async emission');
  });
});
