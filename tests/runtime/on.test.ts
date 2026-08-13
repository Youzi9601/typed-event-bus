/**
 * Runtime tests for on / once / off
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventBus, defineEvent, defineEvents } from '../../src/index';

describe('on', () => {
  let bus: ReturnType<typeof createEventBus>;
  const userCreated = defineEvent('user.created').payload<{ id: string; name: string }>();

  beforeEach(() => {
    bus = createEventBus(userCreated);
  });

  it('subscribes listener and returns Subscription', () => {
    const listener = vi.fn();
    const sub = bus.on(userCreated, listener);

    expect(sub).toHaveProperty('unsubscribe');
    expect(typeof sub.unsubscribe).toBe('function');
  });

  it('calls listener on emit', () => {
    const listener = vi.fn();
    bus.on(userCreated, listener);

    bus.emit(userCreated, { id: '1', name: 'Alice' });

    expect(listener).toHaveBeenCalledWith({ id: '1', name: 'Alice' });
  });

  it('unsubscribe removes listener', () => {
    const listener = vi.fn();
    const sub = bus.on(userCreated, listener);

    sub.unsubscribe();
    bus.emit(userCreated, { id: '1', name: 'Alice' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('unsubscribe called twice is idempotent', () => {
    const listener = vi.fn();
    const sub = bus.on(userCreated, listener);

    sub.unsubscribe();
    sub.unsubscribe();

    bus.emit(userCreated, { id: '1', name: 'Alice' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('supports AbortSignal option', () => {
    const listener = vi.fn();
    const controller = new AbortController();
    const sub = bus.on(userCreated, listener, { signal: controller.signal });

    controller.abort();
    bus.emit(userCreated, { id: '1', name: 'Alice' });

    expect(listener).not.toHaveBeenCalled();
    expect(sub.unsubscribed).toBe(true);
  });

  it('aborting signal after manual unsubscribe does not change state', () => {
    const listener = vi.fn();
    const controller = new AbortController();
    const sub = bus.on(userCreated, listener, { signal: controller.signal });

    sub.unsubscribe();
    controller.abort();
    bus.emit(userCreated, { id: '1', name: 'Alice' });

    expect(listener).not.toHaveBeenCalled();
    expect(sub.unsubscribed).toBe(true);
  });

  it('subscription has signal property when provided', () => {
    const listener = vi.fn();
    const controller = new AbortController();
    const sub = bus.on(userCreated, listener, { signal: controller.signal });

    expect(sub.signal).toBe(controller.signal);
  });

  it('warns when maxListeners exceeded', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const limitedBus = createEventBus(userCreated, { maxListeners: 2 });

    limitedBus.on(userCreated, vi.fn());
    limitedBus.on(userCreated, vi.fn());
    limitedBus.on(userCreated, vi.fn()); // 3rd should warn

    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('MaxListenersExceededWarning')
    );

    consoleWarn.mockRestore();
  });
});

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
});

describe('off', () => {
  let bus: ReturnType<typeof createEventBus>;
  const userCreated = defineEvent('user.created').payload<{ id: string; name: string }>();

  beforeEach(() => {
    bus = createEventBus(userCreated);
  });

  it('removes specific listener', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    bus.on(userCreated, listener1);
    bus.on(userCreated, listener2);

    bus.off(userCreated, listener1);
    bus.emit(userCreated, { id: '1', name: 'Alice' });

    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).toHaveBeenCalledOnce();
  });

  it('returns true when listener removed', () => {
    const listener = vi.fn();
    bus.on(userCreated, listener);

    const result = bus.off(userCreated, listener);

    expect(result).toBe(true);
  });

  it('returns false when listener not found', () => {
    const listener = vi.fn();
    const otherListener = vi.fn();
    bus.on(userCreated, listener);

    const result = bus.off(userCreated, otherListener);

    expect(result).toBe(false);
  });
});

describe('listenerCount', () => {
  it('returns correct count', () => {
    const userCreated = defineEvent('user.created').payload<{ id: string }>();
    const bus = createEventBus(userCreated);

    expect(bus.listenerCount(userCreated)).toBe(0);

    bus.on(userCreated, () => {});
    expect(bus.listenerCount(userCreated)).toBe(1);

    bus.on(userCreated, () => {});
    expect(bus.listenerCount(userCreated)).toBe(2);

    bus.off(userCreated, () => {}); // This won't work without reference
    // Need to use subscription
    const sub = bus.on(userCreated, () => {});
    expect(bus.listenerCount(userCreated)).toBe(3);

    sub.unsubscribe();
    expect(bus.listenerCount(userCreated)).toBe(2);
  });
});

describe('eventNames', () => {
  it('returns all registered event names', () => {
    const userCreated = defineEvent('user.created').payload<{ id: string }>();
    const userDeleted = defineEvent('user.deleted').payload<{ id: string }>();
    const bus = createEventBus({
      user: defineEvents('user', {
        created: defineEvent('created').payload<{ id: string }>(),
        deleted: defineEvent('deleted').payload<{ id: string }>(),
      }),
    });

    bus.on(userCreated, () => {});
    bus.on(userDeleted, () => {});

    const names = bus.eventNames();
    expect(names).toContain('user.created');
    expect(names).toContain('user.deleted');
  });
});

describe('removeAllListeners', () => {
  it('removes all listeners for specific event', () => {
    const userCreated = defineEvent('user.created').payload<{ id: string }>();
    const userDeleted = defineEvent('user.deleted').payload<{ id: string }>();
    const bus = createEventBus({
      user: defineEvents('user', {
        created: defineEvent('created').payload<{ id: string }>(),
        deleted: defineEvent('deleted').payload<{ id: string }>(),
      }),
    });

    bus.on(userCreated, () => {});
    bus.on(userDeleted, () => {});

    bus.removeAllListeners(userCreated);

    expect(bus.listenerCount(userCreated)).toBe(0);
    expect(bus.listenerCount(userDeleted)).toBe(1);
  });

  it('removes all listeners for all events when no argument', () => {
    const userCreated = defineEvent('user.created').payload<{ id: string }>();
    const bus = createEventBus(userCreated);

    bus.on(userCreated, () => {});
    bus.on(userCreated, () => {});

    bus.removeAllListeners();

    expect(bus.listenerCount(userCreated)).toBe(0);
  });
});
