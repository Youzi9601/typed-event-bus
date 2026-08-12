/**
 * Runtime tests for onAll (wildcard)
 */

import { describe, expect, it, vi } from 'vitest';
import { createEventBus, defineEvent, defineEvents } from '../../src/index';

describe('onAll', () => {
  const userEvents = defineEvents('user', {
    created: defineEvent('created').payload<{ id: string; name: string }>(),
    deleted: defineEvent('deleted').payload<{ id: string }>(),
    updated: defineEvent('updated').payload<{ id: string; version: number }>(),
  });
  const bus = createEventBus(userEvents);

  it('subscribes to all events in namespace', () => {
    const handler = vi.fn();
    bus.onAll(userEvents, handler);

    bus.emit(userEvents.created, { id: '1', name: 'Alice' });
    bus.emit(userEvents.deleted, { id: '2' });
    bus.emit(userEvents.updated, { id: '3', version: 2 });

    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('handler receives discriminated object with event and payload', () => {
    const handler = vi.fn();
    bus.onAll(userEvents, handler);

    bus.emit(userEvents.created, { id: '1', name: 'Alice' });

    expect(handler).toHaveBeenCalledWith({
      event: 'user.created',
      payload: { id: '1', name: 'Alice' },
    });
  });

  it('different events have correct payload types', () => {
    const handler = vi.fn();
    bus.onAll(userEvents, handler);

    bus.emit(userEvents.created, { id: '1', name: 'Alice' });
    bus.emit(userEvents.deleted, { id: '2' });
    bus.emit(userEvents.updated, { id: '3', version: 2 });

    const calls = handler.mock.calls;
    expect(calls[0]?.[0]).toEqual({ event: 'user.created', payload: { id: '1', name: 'Alice' } });
    expect(calls[1]?.[0]).toEqual({ event: 'user.deleted', payload: { id: '2' } });
    expect(calls[2]?.[0]).toEqual({ event: 'user.updated', payload: { id: '3', version: 2 } });
  });

  it('returns Subscription that unsubscribes all', () => {
    const handler = vi.fn();
    const sub = bus.onAll(userEvents, handler);

    bus.emit(userEvents.created, { id: '1', name: 'Alice' });
    expect(handler).toHaveBeenCalledTimes(1);

    sub.unsubscribe();
    bus.emit(userEvents.deleted, { id: '2' });

    expect(handler).toHaveBeenCalledTimes(1); // Still 1, no new calls
  });

  it('supports AbortSignal option', () => {
    const handler = vi.fn();
    const controller = new AbortController();
    const _sub = bus.onAll(userEvents, handler, { signal: controller.signal });

    controller.abort();
    bus.emit(userEvents.created, { id: '1', name: 'Alice' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('works with async handler', async () => {
    const handler = vi.fn(async (_e: { event: string; payload: unknown }) => {
      await new Promise(r => setTimeout(r, 10));
    });
    bus.onAll(userEvents, handler);

    await bus.emitAsync(userEvents.created, { id: '1', name: 'Alice' });

    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('onAll with multiple namespaces', () => {
  it('only subscribes to events in the given namespace', () => {
    const userEvents = defineEvents('user', {
      created: defineEvent('created').payload<{ id: string }>(),
    });
    const orderEvents = defineEvents('order', {
      created: defineEvent('created').payload<{ id: string }>(),
    });
    const bus = createEventBus({ user: userEvents, order: orderEvents });

    const userHandler = vi.fn();
    const orderHandler = vi.fn();
    bus.onAll(userEvents, userHandler);
    bus.onAll(orderEvents, orderHandler);

    bus.emit(userEvents.created, { id: '1' });
    bus.emit(orderEvents.created, { id: '2' });

    expect(userHandler).toHaveBeenCalledTimes(1);
    expect(orderHandler).toHaveBeenCalledTimes(1);
    expect(userHandler).toHaveBeenCalledWith({ event: 'user.created', payload: { id: '1' } });
    expect(orderHandler).toHaveBeenCalledWith({ event: 'order.created', payload: { id: '2' } });
  });
});
