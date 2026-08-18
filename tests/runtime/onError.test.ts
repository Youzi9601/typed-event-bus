/**
 * Runtime tests for instance onError method
 */

import { describe, expect, it, vi } from 'vitest';
import { createEventBus, defaultErrorHandler, defineEvent } from '../../src/index.js';

describe('instance onError', () => {
  const testEvent = defineEvent('test.error').payload<{ id: string }>();

  it('returns previous handler when setting new one', () => {
    const bus = createEventBus(testEvent);
    const customHandler = vi.fn();

    const prev = bus.onError(customHandler);
    expect(prev).toBe(defaultErrorHandler);

    const prev2 = bus.onError(defaultErrorHandler);
    expect(prev2).toBe(customHandler);
  });

  it('calls custom error handler on listener error (sync emit)', () => {
    const bus = createEventBus(testEvent);
    const customHandler = vi.fn();

    bus.onError(customHandler);

    const errorListener = vi.fn(() => {
      throw new Error('Sync error');
    });
    bus.on(testEvent, errorListener);
    bus.emit(testEvent, { id: '1' });

    expect(customHandler).toHaveBeenCalledOnce();
    const calls = customHandler.mock.calls;
    const call = calls[0];
    expect(call).toBeDefined();
    if (call) {
      expect(call[0]).toBeInstanceOf(Error);
      expect(call[0].message).toBe('Sync error');
      expect(call[1].name).toBe('test.error');
      expect(call[2]).toEqual({ id: '1' });
    }
  });

  it('calls custom error handler on async listener error (emitAsync)', async () => {
    const bus = createEventBus(testEvent);
    const customHandler = vi.fn();

    bus.onError(customHandler);

    const asyncListener = vi.fn(async () => {
      throw new Error('Async error');
    });
    bus.on(testEvent, asyncListener);

    try {
      await bus.emitAsync(testEvent, { id: '1' });
    } catch {
      // MultiError expected
    }

    expect(customHandler).toHaveBeenCalledOnce();
    const calls = customHandler.mock.calls;
    const call = calls[0];
    expect(call).toBeDefined();
    if (call) {
      expect(call[0]).toBeInstanceOf(Error);
      expect(call[0].message).toBe('Async error');
    }
  });

  it('can restore default handler', () => {
    const bus = createEventBus(testEvent);
    const customHandler = vi.fn();

    bus.onError(customHandler);
    const restored = bus.onError(defaultErrorHandler);

    expect(restored).toBe(customHandler);
    expect(bus.options.onError).toBe(defaultErrorHandler);
  });

  it('returns undefined when no previous custom handler', () => {
    const bus = createEventBus(testEvent);
    // Default is defaultErrorHandler
    const prev = bus.onError(vi.fn());
    expect(prev).toBe(defaultErrorHandler);

    // Setting again returns the custom one
    const prev2 = bus.onError(vi.fn());
    expect(prev2).not.toBe(defaultErrorHandler);
  });
});
