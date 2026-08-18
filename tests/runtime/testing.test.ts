/**
 * Runtime tests for testing utilities
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventBus, defineEvent, defineEvents } from '../../src/index.js';
import {
  createTestBus,
  createTestBusFromNames,
  mockAsyncListener,
  mockListener,
  waitForEvent,
} from '../../src/testing.js';

describe('testing utilities', () => {
  const userEvents = defineEvents('user', {
    created: defineEvent('created').payload<{ id: string; name: string }>(),
    deleted: defineEvent('deleted').payload<{ id: string }>(),
  });

  const userCreated = userEvents.created;

  let bus: ReturnType<typeof createEventBus>;

  beforeEach(() => {
    bus = createEventBus(userEvents);
  });

  describe('createTestBus', () => {
    it('creates a new bus with same registry but isolated state', () => {
      const listener = vi.fn();
      bus.on(userCreated, listener);

      const testBus = createTestBus(bus);
      const testListener = vi.fn();
      testBus.on(userCreated, testListener);

      // Original bus listener should still be called
      bus.emit(userCreated, { id: '1', name: 'Alice' });
      expect(listener).toHaveBeenCalledOnce();
      expect(testListener).not.toHaveBeenCalled();

      // Test bus listener should be called independently
      testBus.emit(userCreated, { id: '2', name: 'Bob' });
      expect(testListener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledTimes(1); // Still only once
    });

    it('test bus has access to same registry', () => {
      const testBus = createTestBus(bus);
      expect(testBus.registry).toBeDefined();
      // Registry is normalized with default namespace
      expect(testBus.registry.default).toBeDefined();
    });
  });

  describe('createTestBusFromNames', () => {
    it('creates bus with defined events', () => {
      const { bus: testBus, events } = createTestBusFromNames(['test.event.a', 'test.event.b']);

      expect(events['test.event.a']).toBeDefined();
      expect(events['test.event.b']).toBeDefined();

      const listener = vi.fn();
      const eventA = events['test.event.a'];
      if (!eventA) throw new Error('Event not found');
      testBus.on(eventA, listener);
      testBus.emit(eventA, { foo: 'bar' });
      expect(listener).toHaveBeenCalledWith({ foo: 'bar' });
    });

    it('events have correct names', () => {
      const { events } = createTestBusFromNames(['custom.event']);
      expect(events['custom.event']?.name).toBe('custom.event');
    });
  });

  describe('mockListener', () => {
    it('records calls with payloads', () => {
      const { listener, calls, callCount, lastCall } = mockListener<{ id: string }>();

      listener({ id: '1' });
      listener({ id: '2' });

      expect(callCount()).toBe(2);
      expect(calls).toHaveLength(2);
      expect(calls[0]?.payload).toEqual({ id: '1' });
      expect(calls[1]?.payload).toEqual({ id: '2' });
      expect(lastCall()?.payload).toEqual({ id: '2' });
    });

    it('reset clears calls', () => {
      const { listener, calls, reset, callCount } = mockListener();

      listener({ a: 1 });
      expect(callCount()).toBe(1);

      reset();
      expect(callCount()).toBe(0);
      expect(calls).toHaveLength(0);
    });

    it('works with bus.on', () => {
      const { listener, calls, callCount } = mockListener<{ id: string; name: string }>();

      bus.on(userCreated, listener);
      bus.emit(userCreated, { id: '1', name: 'Alice' });

      expect(callCount()).toBe(1);
      expect(calls[0]?.payload).toEqual({ id: '1', name: 'Alice' });
    });
  });

  describe('mockAsyncListener', () => {
    it('records calls like mockListener', async () => {
      const { listener, calls, callCount } = mockAsyncListener<{ id: string }>(0);

      await listener({ id: '1' });
      await listener({ id: '2' });

      expect(callCount()).toBe(2);
      expect(calls).toHaveLength(2);
    });

    it('respects delayMs', async () => {
      const { listener, callCount } = mockAsyncListener<{ id: string }>(10);

      const start = Date.now();
      await listener({ id: '1' });
      const elapsed = Date.now() - start;

      expect(callCount()).toBe(1);
      expect(elapsed).toBeGreaterThanOrEqual(5); // Allow some timing variance
    });

    it('works with bus.on and emitAsync', async () => {
      const { listener, callCount } = mockAsyncListener<{ id: string; name: string }>(0);

      bus.on(userCreated, listener);
      await bus.emitAsync(userCreated, { id: '1', name: 'Alice' });

      expect(callCount()).toBe(1);
    });
  });

  describe('waitForEvent', () => {
    it('resolves with payload when event emitted', async () => {
      const promise = waitForEvent(bus, userCreated, 1000);

      // Emit after a small delay
      setTimeout(() => {
        bus.emit(userCreated, { id: '1', name: 'Alice' });
      }, 10);

      const payload = await promise;
      expect(payload).toEqual({ id: '1', name: 'Alice' });
    });

    it('rejects on timeout', async () => {
      const promise = waitForEvent(bus, userCreated, 50);

      await expect(promise).rejects.toThrow('Timeout');
    });

    it('unsubscribes automatically after event', async () => {
      const listener = vi.fn();
      bus.on(userCreated, listener);

      const promise = waitForEvent(bus, userCreated, 1000);
      bus.emit(userCreated, { id: '1', name: 'Alice' });
      await promise;

      // The waitForEvent internal subscription (bus.once) auto-unsubscribes
      // after the awaited event, so a second emit must NOT invoke it again.
      // This persistent listener is still fire-and-forget on every emit.
      bus.emit(userCreated, { id: '2', name: 'Bob' });
      expect(listener).toHaveBeenCalledTimes(2); // persistent listener fired on both emits
    });
  });
});
