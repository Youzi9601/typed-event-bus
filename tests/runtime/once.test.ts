/**
 * Runtime tests for once
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventBus, defineEvent } from '../../src/index';

describe('once', () => {
  let bus: ReturnType<typeof createEventBus>;
  const userCreated = defineEvent('user.created').payload<{ id: string; name: string }>();

  beforeEach(() => {
    bus = createEventBus(userCreated);
  });

  it('calls listener only once', () => {
    const listener = vi.fn();
    bus.once(userCreated, listener);

    bus.emit(userCreated, { id: '1', name: 'Alice' });
    bus.emit(userCreated, { id: '2', name: 'Bob' });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ id: '1', name: 'Alice' });
  });

  it('returns Subscription that can unsubscribe before first emit', () => {
    const listener = vi.fn();
    const sub = bus.once(userCreated, listener);

    sub.unsubscribe();
    bus.emit(userCreated, { id: '1', name: 'Alice' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('works with async listener', async () => {
    const listener = vi.fn(async (_payload: { id: string; name: string }) => {
      await new Promise(r => setTimeout(r, 10));
    });

    bus.once(userCreated, listener);

    await bus.emitAsync(userCreated, { id: '1', name: 'Alice' });
    await bus.emitAsync(userCreated, { id: '2', name: 'Bob' });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('marks subscription as unsubscribed after sync auto-removal', () => {
    const listener = vi.fn();
    const sub = bus.once(userCreated, listener);

    expect(sub.unsubscribed).toBe(false);
    bus.emit(userCreated, { id: '1', name: 'Alice' });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(sub.unsubscribed).toBe(true);
    expect(bus.listenerCount(userCreated)).toBe(0);
  });

  it('marks subscription as unsubscribed after async auto-removal', async () => {
    const listener = vi.fn(async () => {
      await new Promise(r => setTimeout(r, 10));
    });
    const sub = bus.once(userCreated, listener);

    await bus.emitAsync(userCreated, { id: '1', name: 'Alice' });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(sub.unsubscribed).toBe(true);
    expect(bus.listenerCount(userCreated)).toBe(0);
  });

  it('marks subscription as unsubscribed when sync listener throws during emit', () => {
    const listener = vi.fn(() => {
      throw new Error('once boom');
    });
    const sub = bus.once(userCreated, listener);

    bus.emit(userCreated, { id: '1', name: 'Alice' });
    bus.emit(userCreated, { id: '2', name: 'Bob' });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(sub.unsubscribed).toBe(true);
  });

  it('marks subscription as unsubscribed for async emit with sync emit', async () => {
    const listener = vi.fn();
    const sub = bus.once(userCreated, listener);

    bus.emit(userCreated, { id: '1', name: 'Alice' });
    await bus.emitAsync(userCreated, { id: '2', name: 'Bob' });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(sub.unsubscribed).toBe(true);
  });

  it('async once listener is not re-invoked by re-entrant emit', async () => {
    const order: string[] = [];
    const reentrantBus = createEventBus(userCreated);
    reentrantBus.once(userCreated, async () => {
      order.push('once');
      await new Promise(r => setTimeout(r, 10));
    });
    reentrantBus.once(userCreated, () => {
      order.push('nested-emit');
      reentrantBus.emit(userCreated, { id: '2', name: 'Bob' });
    });

    await reentrantBus.emitAsync(userCreated, { id: '1', name: 'Alice' });

    expect(order.filter(s => s === 'once')).toHaveLength(1);
  });

  it('listener registered during once execution is not dropped', () => {
    const inner = vi.fn();
    bus.once(userCreated, () => {
      bus.on(userCreated, inner);
    });

    bus.emit(userCreated, { id: '1', name: 'Alice' });
    bus.emit(userCreated, { id: '2', name: 'Bob' });

    expect(inner).toHaveBeenCalledTimes(1);
    expect(bus.listenerCount(userCreated)).toBe(1);
  });

  it('async listener registered during once execution is not dropped', async () => {
    const inner = vi.fn();
    const asyncBus = createEventBus(userCreated);
    asyncBus.once(userCreated, async () => {
      await new Promise(r => setTimeout(r, 5));
      asyncBus.on(userCreated, inner);
    });

    await asyncBus.emitAsync(userCreated, { id: '1', name: 'Alice' });
    await asyncBus.emitAsync(userCreated, { id: '2', name: 'Bob' });

    expect(inner).toHaveBeenCalledTimes(1);
    expect(asyncBus.listenerCount(userCreated)).toBe(1);
  });

  it('once-registered listener fires on the next emit even when other listeners exist', () => {
    const inner = vi.fn();
    const other = vi.fn();
    bus.once(userCreated, () => {
      bus.on(userCreated, inner);
    });
    bus.on(userCreated, other);

    bus.emit(userCreated, { id: '1', name: 'Alice' });
    expect(inner).not.toHaveBeenCalled();
    expect(other).toHaveBeenCalledTimes(1);

    bus.emit(userCreated, { id: '2', name: 'Bob' });
    expect(inner).toHaveBeenCalledTimes(1);
    expect(bus.listenerCount(userCreated)).toBe(2);
  });
});
