/**
 * Runtime tests for emit / emitAsync
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventBus, defineEvent } from '../../src/index';

describe('emit', () => {
  let bus: ReturnType<typeof createEventBus>;
  const userCreated = defineEvent('user.created').payload<{ id: string; name: string }>();

  beforeEach(() => {
    bus = createEventBus(userCreated);
  });

  it('emits event and calls listener', () => {
    const listener = vi.fn();
    bus.on(userCreated, listener);

    bus.emit(userCreated, {
      id: '1',
      name: 'Alice',
    });

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({ id: '1', name: 'Alice' });
  });

  it('returns true when listeners exist', () => {
    const listener = vi.fn();
    bus.on(userCreated, listener);

    const result = bus.emit(userCreated, {
      id: '1',
      name: 'Alice',
    });

    expect(result).toBe(true);
  });

  it('returns false when no listeners', () => {
    const result = bus.emit(userCreated, {
      id: '1',
      name: 'Alice',
    });
    expect(result).toBe(false);
  });

  it('calls multiple listeners', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    bus.on(userCreated, listener1);
    bus.on(userCreated, listener2);

    bus.emit(userCreated, {
      id: '1',
      name: 'Alice',
    });

    expect(listener1).toHaveBeenCalledOnce();
    expect(listener2).toHaveBeenCalledOnce();
  });

  it('continues calling other listeners when one throws', () => {
    const errorListener = vi.fn(() => {
      throw new Error('Listener error');
    });
    const successListener = vi.fn();
    bus.on(userCreated, errorListener);
    bus.on(userCreated, successListener);

    bus.emit(userCreated, {
      id: '1',
      name: 'Alice',
    });

    expect(errorListener).toHaveBeenCalledOnce();
    expect(successListener).toHaveBeenCalledOnce();
  });

  it('calls onError handler when listener throws', () => {
    const onError = vi.fn();
    const testEvent = defineEvent('test').payload<{ id: string }>();
    const errorBus = createEventBus(testEvent, { onError });
    const errorListener = vi.fn(() => {
      throw new Error('Test error');
    });
    errorBus.on(testEvent, errorListener);

    errorBus.emit(testEvent, { id: '1' });

    expect(onError).toHaveBeenCalledOnce();
    const firstCall = onError.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(firstCall?.[0]).toBeInstanceOf(Error);
    expect(firstCall?.[1].name).toBe('test');
    expect(firstCall?.[2]).toEqual({ id: '1' });
  });
});

describe('emitAsync', () => {
  const testEvent = defineEvent('async.test').payload<{ id: string }>();

  it('awaits async listeners', async () => {
    const asyncListener = vi.fn(async (payload: { id: string }) => {
      await new Promise(r => setTimeout(r, 10));
      return payload.id;
    });
    const bus = createEventBus(testEvent);
    bus.on(testEvent, asyncListener);

    await bus.emitAsync(testEvent, { id: '1' });

    expect(asyncListener).toHaveBeenCalledOnce();
  });

  it('throws MultiError when async listener throws', async () => {
    const asyncListener = vi.fn(async () => {
      throw new Error('Async error');
    });
    const bus = createEventBus(testEvent);
    bus.on(testEvent, asyncListener);

    await expect(bus.emitAsync(testEvent, { id: '1' })).rejects.toThrow('MultiError');
  });

  it('collects multiple errors in MultiError', async () => {
    const listener1 = vi.fn(async () => {
      throw new Error('Error 1');
    });
    const listener2 = vi.fn(async () => {
      throw new Error('Error 2');
    });
    const bus = createEventBus(testEvent);
    bus.on(testEvent, listener1);
    bus.on(testEvent, listener2);

    try {
      await bus.emitAsync(testEvent, { id: '1' });
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      if (e instanceof Error && 'errors' in e) {
        expect((e as { errors: unknown[] }).errors).toHaveLength(2);
      }
    }
  });

  it('also executes sync listeners', async () => {
    const syncListener = vi.fn();
    const asyncListener = vi.fn(async () => {});
    const bus = createEventBus(testEvent);
    bus.on(testEvent, syncListener);
    bus.on(testEvent, asyncListener);

    await bus.emitAsync(testEvent, { id: '1' });

    expect(syncListener).toHaveBeenCalledOnce();
    expect(asyncListener).toHaveBeenCalledOnce();
  });

  it('returns resolved promise when no listeners', async () => {
    const emptyBus = createEventBus(testEvent);
    await expect(emptyBus.emitAsync(testEvent, { id: '1' })).resolves.toBeUndefined();
  });
});
