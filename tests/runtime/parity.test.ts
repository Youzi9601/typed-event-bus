/**
 * Runtime tests for Node EventEmitter parity semantics:
 * prependListener / prependOnceListener / rawListeners /
 * newListener & removeListener meta events / off most-recent-instance.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEventBus,
  defineEvent,
  type Listener,
  newListenerEvent,
  removeListenerEvent,
} from '../../src/index';

describe('prependListener / prependOnceListener', () => {
  let bus: ReturnType<typeof createEventBus>;
  const userCreated = defineEvent('user.created').payload<{ id: string }>();

  beforeEach(() => {
    bus = createEventBus(userCreated);
  });

  it('prependListener runs before listeners registered earlier', () => {
    const order: string[] = [];
    bus.on(userCreated, () => order.push('a'));
    bus.prependListener(userCreated, () => order.push('p1'));
    bus.prependListener(userCreated, () => order.push('p2'));
    bus.on(userCreated, () => order.push('b'));

    bus.emit(userCreated, { id: '1' });

    expect(order).toEqual(['p2', 'p1', 'a', 'b']);
  });

  it('prependOnceListener runs first and only once', () => {
    const order: string[] = [];
    bus.on(userCreated, () => order.push('a'));
    bus.prependOnceListener(userCreated, () => order.push('p'));

    bus.emit(userCreated, { id: '1' });
    bus.emit(userCreated, { id: '2' });

    expect(order).toEqual(['p', 'a', 'a']);
    expect(bus.listenerCount(userCreated)).toBe(1);
  });

  it('prepended subscription can be unsubscribed', () => {
    const order: string[] = [];
    const sub = bus.prependListener(userCreated, () => order.push('p'));
    bus.on(userCreated, () => order.push('a'));

    sub.unsubscribe();
    bus.emit(userCreated, { id: '1' });

    expect(order).toEqual(['a']);
  });
});

describe('rawListeners', () => {
  let bus: ReturnType<typeof createEventBus>;
  const userCreated = defineEvent('user.created').payload<{ id: string }>();

  beforeEach(() => {
    bus = createEventBus(userCreated);
  });

  it('returns plain listeners in registration order (on / once / prepend)', () => {
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();

    bus.on(userCreated, a);
    bus.once(userCreated, b);
    bus.prependListener(userCreated, c);

    expect(bus.rawListeners(userCreated)).toEqual([c, a, b]);
  });

  it('returns empty array when no listeners', () => {
    expect(bus.rawListeners(userCreated)).toEqual([]);
  });
});

describe('off removes most recently registered instance (Node semantics)', () => {
  let bus: ReturnType<typeof createEventBus>;
  const userCreated = defineEvent('user.created').payload<{ id: string }>();

  beforeEach(() => {
    bus = createEventBus(userCreated);
  });

  it('removes the latest registration of a duplicated listener', () => {
    const handler = vi.fn();
    bus.on(userCreated, handler);
    bus.on(userCreated, handler);

    expect(bus.off(userCreated, handler)).toBe(true);
    expect(bus.listenerCount(userCreated)).toBe(1);

    bus.emit(userCreated, { id: '1' });
    expect(handler).toHaveBeenCalledTimes(1);

    expect(bus.off(userCreated, handler)).toBe(true);
    expect(bus.listenerCount(userCreated)).toBe(0);
    expect(bus.off(userCreated, handler)).toBe(false);
  });
});

describe('newListener meta event', () => {
  let bus: ReturnType<typeof createEventBus>;
  const userCreated = defineEvent('user.created').payload<{ id: string }>();

  beforeEach(() => {
    bus = createEventBus(userCreated);
  });

  it('fires with the listener before it is registered (not on self-registration)', () => {
    const meta = vi.fn();
    bus.on(newListenerEvent, meta);
    expect(meta).not.toHaveBeenCalled();

    const listener = vi.fn();
    bus.on(userCreated, listener);

    expect(meta).toHaveBeenCalledTimes(1);
    expect(meta).toHaveBeenCalledWith(listener);
  });

  it('meta listeners observe earlier registrations but not their own', () => {
    const seen: Listener<unknown>[] = [];
    bus.on(newListenerEvent, (listener: Listener<unknown>) => {
      seen.push(listener);
    });
    const second = vi.fn();
    bus.on(newListenerEvent, second);

    const first = vi.fn();
    bus.on(userCreated, first);

    // meta1 observed meta2's registration (meta2 is not called for itself),
    // then both observed the real listener.
    expect(seen).toEqual([second, first]);
    expect(second).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith(first);
  });

  it('once on newListener fires exactly once', () => {
    const meta = vi.fn();
    bus.once(newListenerEvent, meta);

    bus.on(userCreated, vi.fn());
    bus.on(userCreated, vi.fn());

    expect(meta).toHaveBeenCalledTimes(1);
  });

  it('errors in meta listeners route to onError without breaking registration', () => {
    const onError = vi.fn();
    const errorBus = createEventBus(userCreated, { onError });
    errorBus.on(newListenerEvent, () => {
      throw new Error('meta boom');
    });

    expect(() => errorBus.on(userCreated, vi.fn())).not.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(errorBus.listenerCount(userCreated)).toBe(1);
  });

  it('the new listener still registers if newListener meta removes all listeners', () => {
    bus.on(newListenerEvent, () => {
      bus.removeAllListeners(userCreated);
    });

    const listener = vi.fn();
    bus.on(userCreated, listener);

    expect(bus.listenerCount(userCreated)).toBe(1);
    bus.emit(userCreated, { id: '1' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('removeListener meta event', () => {
  let bus: ReturnType<typeof createEventBus>;
  const userCreated = defineEvent('user.created').payload<{ id: string }>();

  beforeEach(() => {
    bus = createEventBus(userCreated);
  });

  it('fires on off / unsubscribe', () => {
    const removed = vi.fn();
    bus.on(removeListenerEvent, removed);

    const handler = vi.fn();
    const sub = bus.on(userCreated, handler);
    sub.unsubscribe();

    expect(removed).toHaveBeenCalledWith(handler);

    removed.mockClear();
    bus.off(userCreated, handler);
    expect(removed).not.toHaveBeenCalled();
  });

  it('fires when a once listener auto-removes', () => {
    const removed = vi.fn();
    bus.on(removeListenerEvent, removed);

    const handler = vi.fn();
    bus.once(userCreated, handler);
    bus.emit(userCreated, { id: '1' });

    expect(removed).toHaveBeenCalledWith(handler);
  });

  it('fires for every listener removed by removeAllListeners (reverse order)', () => {
    const order: string[] = [];
    bus.on(removeListenerEvent, listener => {
      order.push(listener.name);
    });

    function a(): void {}
    function b(): void {}
    bus.on(userCreated, a);
    bus.on(userCreated, b);
    bus.removeAllListeners(userCreated);

    expect(order).toEqual(['b', 'a']);
  });

  it('does not fire when removing an already-removed listener', () => {
    const removed = vi.fn();
    bus.on(removeListenerEvent, removed);

    const handler = vi.fn();
    bus.on(userCreated, handler);
    bus.off(userCreated, handler);
    bus.off(userCreated, handler);

    expect(removed).toHaveBeenCalledTimes(1);
  });

  it('keeps listeners re-registered via prepend while removeListener meta fires', () => {
    const replacement = vi.fn();
    bus.on(removeListenerEvent, () => {
      bus.prependListener(userCreated, replacement);
    });

    const handler = vi.fn();
    bus.on(userCreated, handler);
    bus.off(userCreated, handler);

    expect(bus.listenerCount(userCreated)).toBe(1);
    bus.emit(userCreated, { id: '1' });
    expect(replacement).toHaveBeenCalledTimes(1);
  });

  it('off marks the subscription unsubscribed and detaches the abort listener', () => {
    const controller = new AbortController();
    const spy = vi.spyOn(controller.signal, 'removeEventListener');
    const handler = vi.fn();
    const sub = bus.on(userCreated, handler, { signal: controller.signal });

    bus.off(userCreated, handler);

    expect(sub.unsubscribed).toBe(true);
    expect(spy).toHaveBeenCalledWith('abort', expect.any(Function));
  });
});

describe('once auto-removal removes exactly the once entry', () => {
  let bus: ReturnType<typeof createEventBus>;
  const userCreated = defineEvent('user.created').payload<{ id: string }>();

  beforeEach(() => {
    bus = createEventBus(userCreated);
  });

  it('once + on with the same listener: the persistent registration survives', () => {
    const fn = vi.fn();
    bus.once(userCreated, fn);
    bus.on(userCreated, fn);

    bus.emit(userCreated, { id: '1' });
    bus.emit(userCreated, { id: '2' });

    expect(bus.listenerCount(userCreated)).toBe(1);
    expect(fn).toHaveBeenCalledTimes(3); // once x1 + persistent x2
  });

  it('on + once with the same listener: the persistent registration survives', () => {
    const fn = vi.fn();
    bus.on(userCreated, fn);
    bus.once(userCreated, fn);

    bus.emit(userCreated, { id: '1' });
    bus.emit(userCreated, { id: '2' });

    expect(bus.listenerCount(userCreated)).toBe(1);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('duplicated once registrations auto-remove independently', () => {
    const fn = vi.fn();
    bus.once(userCreated, fn);
    bus.once(userCreated, fn);

    bus.emit(userCreated, { id: '1' });
    expect(bus.listenerCount(userCreated)).toBe(0);
    expect(fn).toHaveBeenCalledTimes(2);

    bus.emit(userCreated, { id: '2' });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('removeListener meta still fires for the auto-removed once entry', () => {
    const removed = vi.fn();
    bus.on(removeListenerEvent, removed);

    const fn = vi.fn();
    bus.once(userCreated, fn);
    bus.on(userCreated, fn);
    bus.emit(userCreated, { id: '1' });

    expect(removed).toHaveBeenCalledTimes(1);
    expect(removed).toHaveBeenCalledWith(fn);
  });
});

describe('removeAllListeners during removeListener meta', () => {
  let bus: ReturnType<typeof createEventBus>;
  const userCreated = defineEvent('user.created').payload<{ id: string }>();

  beforeEach(() => {
    bus = createEventBus(userCreated);
  });

  it('keeps listeners re-registered while removeListener meta fires', () => {
    const replacement = vi.fn();
    bus.on(removeListenerEvent, () => {
      bus.on(userCreated, replacement);
    });
    bus.on(userCreated, vi.fn());

    bus.removeAllListeners(userCreated);

    expect(bus.listenerCount(userCreated)).toBe(1);
    bus.emit(userCreated, { id: '1' });
    expect(replacement).toHaveBeenCalledTimes(1);
  });
});

describe('prepend during an emit (set-swap safety)', () => {
  let bus: ReturnType<typeof createEventBus>;
  const userCreated = defineEvent('user.created').payload<{ id: string }>();

  beforeEach(() => {
    bus = createEventBus(userCreated);
  });

  it('once listeners prepended-over during an emit are still auto-removed', () => {
    const calls: string[] = [];
    bus.on(userCreated, () => {
      bus.prependListener(userCreated, () => calls.push('p'));
    });
    bus.once(userCreated, () => calls.push('once'));

    bus.emit(userCreated, { id: '1' });
    bus.emit(userCreated, { id: '2' });

    expect(calls.filter(c => c === 'once')).toHaveLength(1);
  });

  it('emitAsync: once listeners prepended-over during an emit are still auto-removed', async () => {
    const calls: string[] = [];
    bus.on(userCreated, () => {
      bus.prependListener(userCreated, () => calls.push('p'));
    });
    bus.once(userCreated, () => calls.push('once'));

    await bus.emitAsync(userCreated, { id: '1' });
    await bus.emitAsync(userCreated, { id: '2' });

    expect(calls.filter(c => c === 'once')).toHaveLength(1);
  });

  it('once auto-removal detaches the abort listener', () => {
    const controller = new AbortController();
    const spy = vi.spyOn(controller.signal, 'removeEventListener');
    const sub = bus.once(userCreated, vi.fn(), { signal: controller.signal });

    bus.emit(userCreated, { id: '1' });

    expect(spy).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(sub.unsubscribed).toBe(true);
  });

  it('removeAllListeners marks once subscriptions unsubscribed', () => {
    const sub = bus.once(userCreated, vi.fn());
    bus.removeAllListeners(userCreated);
    expect(sub.unsubscribed).toBe(true);
  });
});
