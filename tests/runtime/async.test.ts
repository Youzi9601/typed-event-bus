/**
 * Runtime tests for async emission and listeners
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventBus, defineEvent } from '../../src/index';

describe('async listeners with emit (fire-and-forget)', () => {
  let bus: ReturnType<typeof createEventBus>;
  const userCreated = defineEvent('user.created').payload<{ id: string; name: string }>();

  beforeEach(() => {
    bus = createEventBus(userCreated);
  });

  it('does not await async listeners in emit', () => {
    const asyncListener = vi.fn(async () => {
      await new Promise(r => setTimeout(r, 50));
    });
    const syncListener = vi.fn();

    bus.on(userCreated, asyncListener);
    bus.on(userCreated, syncListener);

    const start = performance.now();
    bus.emit(userCreated, { id: '1', name: 'Alice' });
    const duration = performance.now() - start;

    // emit returns immediately, doesn't wait for async listener
    expect(duration).toBeLessThan(20);
    expect(syncListener).toHaveBeenCalledOnce();
    // asyncListener will be called but not awaited
  });

  it('handles async listener errors in emit via onError', async () => {
    const onError = vi.fn();
    const errorBus = createEventBus(userCreated, { onError });

    const asyncListener = vi.fn(async () => {
      throw new Error('Async error in emit');
    });
    errorBus.on(userCreated, asyncListener);

    errorBus.emit(userCreated, { id: '1', name: 'Alice' });

    // Wait for microtask queue to flush (async listener error handling)
    await Promise.resolve();

    // Error is caught and passed to onError
    expect(onError).toHaveBeenCalledOnce();
    const firstCall = onError.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(firstCall?.[0]).toBeInstanceOf(Error);
  });
});

describe('emitAsync', () => {
  let bus: ReturnType<typeof createEventBus>;
  const userCreated = defineEvent('user.created').payload<{ id: string; name: string }>();

  beforeEach(() => {
    bus = createEventBus(userCreated);
  });

  it('awaits all async listeners (parallel by default)', async () => {
    const results: number[] = [];
    const asyncListener1 = vi.fn(async () => {
      await new Promise(r => setTimeout(r, 30));
      results.push(1);
    });
    const asyncListener2 = vi.fn(async () => {
      await new Promise(r => setTimeout(r, 20));
      results.push(2);
    });

    bus.on(userCreated, asyncListener1);
    bus.on(userCreated, asyncListener2);

    await bus.emitAsync(userCreated, { id: '1', name: 'Alice' });

    // Parallel execution: completion order depends on timing, not registration order
    // Both should complete, order may vary
    expect(results.sort()).toEqual([1, 2]);
    expect(asyncListener1).toHaveBeenCalledOnce();
    expect(asyncListener2).toHaveBeenCalledOnce();
  });

  it('awaits all async listeners sequentially when { sequential: true }', async () => {
    const results: number[] = [];
    const asyncListener1 = vi.fn(async () => {
      await new Promise(r => setTimeout(r, 30));
      results.push(1);
    });
    const asyncListener2 = vi.fn(async () => {
      await new Promise(r => setTimeout(r, 20));
      results.push(2);
    });

    bus.on(userCreated, asyncListener1);
    bus.on(userCreated, asyncListener2);

    await bus.emitAsync(userCreated, { id: '1', name: 'Alice' }, { sequential: true });

    // Sequential execution: registration order preserved
    expect(results).toEqual([1, 2]);
    expect(asyncListener1).toHaveBeenCalledOnce();
    expect(asyncListener2).toHaveBeenCalledOnce();
  });

  it('executes sync listeners before async ones complete', async () => {
    const order: string[] = [];
    const syncListener = vi.fn(() => {
      order.push('sync');
    });
    const asyncListener = vi.fn(async () => {
      await new Promise(r => setTimeout(r, 10));
      order.push('async');
    });

    bus.on(userCreated, syncListener);
    bus.on(userCreated, asyncListener);

    await bus.emitAsync(userCreated, { id: '1', name: 'Alice' });

    expect(order).toEqual(['sync', 'async']);
  });

  it('throws MultiError with all errors', async () => {
    const listener1 = vi.fn(async () => {
      throw new Error('Error 1');
    });
    const listener2 = vi.fn(async () => {
      throw new Error('Error 2');
    });
    const listener3 = vi.fn(async () => {
      throw new Error('Error 3');
    });

    bus.on(userCreated, listener1);
    bus.on(userCreated, listener2);
    bus.on(userCreated, listener3);

    try {
      await bus.emitAsync(userCreated, { id: '1', name: 'Alice' });
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      if (e instanceof Error) {
        expect(e.name).toBe('MultiError');
        if ('errors' in e) {
          expect((e as { errors: unknown[] }).errors).toHaveLength(3);
        }
      }
    }
  });

  it('includes sync listener errors in MultiError', async () => {
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
      if (e instanceof Error && 'errors' in e) {
        expect((e as { errors: unknown[] }).errors).toHaveLength(2);
      }
    }
  });

  it('works with once listeners', async () => {
    const listener = vi.fn(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    bus.once(userCreated, listener);

    await bus.emitAsync(userCreated, { id: '1', name: 'Alice' });
    await bus.emitAsync(userCreated, { id: '2', name: 'Bob' });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('resolves immediately when no listeners', async () => {
    const emptyEvent = defineEvent('empty').payload<{ id: string }>();
    const emptyBus = createEventBus(emptyEvent);
    await expect(emptyBus.emitAsync(emptyEvent, { id: '1' })).resolves.toBeUndefined();
  });
});

describe('mixed sync/async listeners', () => {
  it('emitAsync waits for async, emit does not', async () => {
    const userCreated = defineEvent('user.created').payload<{ id: string }>();
    const bus = createEventBus(userCreated);

    const asyncListener = vi.fn(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    bus.on(userCreated, asyncListener);

    // emit returns immediately
    bus.emit(userCreated, { id: '1' });
    expect(asyncListener).toHaveBeenCalled();

    // emitAsync waits
    await bus.emitAsync(userCreated, { id: '2' });
    expect(asyncListener).toHaveBeenCalledTimes(2);
  });
});
